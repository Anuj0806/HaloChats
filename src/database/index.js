import initSqlJs from "sql.js";

/*
============================================================
LOCAL SQLITE DATABASE
============================================================

Database is stored as a SQLite database in IndexedDB.

Architecture:

React
  ↓
database/index.js
  ↓
SQL.js SQLite
  ↓
SQLite binary
  ↓
IndexedDB

This means chat data survives:
- page refresh
- browser restart
- React reload
- Vite restart

The actual SQLite database is NOT stored on the Spring Boot server.
============================================================
*/

const DB_NAME = "chat_web_local";
const DB_STORE = "sqlite";
const DB_KEY = "chat_database";

let SQL = null;
let db = null;
let initialized = false;
let initPromise = null;

/*
Whether chats survive a refresh.

Two different things can go wrong, and conflating them was a bug:

  - IndexedDB unavailable (Firefox private windows, Safari with
    storage blocked, an origin the user has denied). SQLite itself is
    perfectly happy in memory, so the app stays fully usable for the
    session - it simply forgets everything on reload.

  - sql.js/WASM failing to load. There is no database at all, and
    every read has to answer with an empty result instead of throwing.

Only the second is fatal, and the UI should say so honestly rather
than pretending the first case is fine.
*/
let persistent = true;

/** False when the session is in-memory only. */
export function isPersistent() {
  return persistent;
}


/* ============================================================
   INDEXEDDB
============================================================ */

function openStorage() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined" || indexedDB === null) {
      reject(new Error("IndexedDB is unavailable in this browser context"));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(DB_STORE)) {
        database.createObjectStore(DB_STORE);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}


async function loadDatabaseBytes() {
  const storage = await openStorage();

  return new Promise((resolve, reject) => {
    const transaction = storage.transaction(DB_STORE, "readonly");
    const store = transaction.objectStore(DB_STORE);

    const request = store.get(DB_KEY);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}


async function saveDatabaseBytes() {
  if (!db || !persistent) {
    return;
  }

  const bytes = db.export();

  let storage;

  try {
    storage = await openStorage();
  } catch {
    // Storage went away mid-session (quota revoked, private mode
    // toggled). Downgrade once and stop trying on every keystroke.
    persistent = false;
    return;
  }

  return new Promise((resolve, reject) => {
    const transaction = storage.transaction(DB_STORE, "readwrite");
    const store = transaction.objectStore(DB_STORE);

    const request = store.put(bytes, DB_KEY);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}


/* ============================================================
   DATABASE INITIALIZATION
============================================================ */

export async function initDatabase() {
  if (initialized && db) {
    return db;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      SQL = await initSqlJs({
        // Resolved against Vite's configured base rather than hardcoded
        // to "/", so the app still finds its WASM when it's deployed
        // under a sub-path such as https://example.com/chat/.
        locateFile: () => import.meta.env.VITE_SQL_WASM_URL,
      });

      let savedBytes = null;

      try {
        savedBytes = await loadDatabaseBytes();
      } catch (storageError) {
        // No IndexedDB. Carry on with an in-memory database: sending
        // and receiving still work for this session, and the UI warns
        // that nothing will be kept.
        persistent = false;
        console.warn(
          "Chat history can't be saved in this browser:",
          storageError.message
        );
      }

      db = savedBytes ? new SQL.Database(savedBytes) : new SQL.Database();

      createTables();
      runMigrations();

      initialized = true;

      await saveDatabaseBytes();

      return db;
    } catch (error) {
      console.error("SQLite initialization failed:", error);
      throw error;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}


/* ============================================================
   CHECK DATABASE
============================================================ */

/**
 * For actions the user explicitly asked for (backup, restore, erase),
 * where failing loudly with a readable message is the right outcome.
 */
function requireDatabase() {
  if (!db) {
    throw new Error(
      "Chat storage isn't available in this browser. Private browsing and blocked site data both prevent it."
    );
  }

  return db;
}

/**
 * For everything the UI calls during render or from a WebSocket
 * handler.
 *
 * There are two separate failure modes and they need different
 * answers. Missing IndexedDB is handled in initDatabase() by falling
 * back to an in-memory SQLite database, so `db` still exists and
 * everything below works normally for the session.
 *
 * This guard covers the harsher case: sql.js itself failed to load,
 * so there is no database at all. Throwing from a getter would kill
 * the render that called it, turning one failed dependency into a
 * blank screen. Returning an empty result lets the app draw its
 * empty state alongside an honest warning instead.
 */
function optionalDatabase() {
  return db;
}

/** True when there is a working database of any kind. */
export function isStorageAvailable() {
  return Boolean(db);
}


/* ============================================================
   CREATE TABLES
============================================================ */

function createTables() {
  const database = requireDatabase();

  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      phone TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS chats (
      chat_id TEXT PRIMARY KEY,
      user_phone TEXT NOT NULL,
      is_group INTEGER NOT NULL DEFAULT 0,
      name TEXT,
      members TEXT NOT NULL,
      last_message TEXT,
      last_message_time INTEGER,
      unread_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  database.run(`
    CREATE TABLE IF NOT EXISTS messages (
      message_id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      sender_phone TEXT NOT NULL,
      receiver_phone TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'SENDING',
      created_at INTEGER NOT NULL,
      delivered_at INTEGER,
      read_at INTEGER
    )
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_messages_chat_id
    ON messages(chat_id)
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_messages_created_at
    ON messages(created_at)
  `);

  database.run(`
    CREATE INDEX IF NOT EXISTS idx_chats_updated_at
    ON chats(updated_at)
  `);
}


/* ============================================================
   MIGRATIONS

   createTables() only ever runs CREATE TABLE IF NOT EXISTS, so it
   cannot add a column to a database that already exists on someone's
   machine. Anything added after the first release goes here instead.

   SQLite has no "ADD COLUMN IF NOT EXISTS", so each column is checked
   against PRAGMA table_info first. That makes this safe to run on
   every single startup.
============================================================ */

const COLUMN_MIGRATIONS = [
  ["users", "avatar_id", "TEXT"],
  ["users", "about", "TEXT"],
  ["chats", "pinned", "INTEGER NOT NULL DEFAULT 0"],
  ["chats", "muted", "INTEGER NOT NULL DEFAULT 0"],
  ["chats", "archived", "INTEGER NOT NULL DEFAULT 0"],
  ["chats", "last_message_sender", "TEXT"],
  ["chats", "last_message_status", "TEXT"],
  ["chats", "avatar_id", "TEXT"],
];

function runMigrations() {
  const database = requireDatabase();

  COLUMN_MIGRATIONS.forEach(([table, column, definition]) => {
    if (columnExists(table, column)) {
      return;
    }

    try {
      database.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch (error) {
      console.warn(`Migration skipped for ${table}.${column}:`, error.message);
    }
  });
}

function columnExists(table, column) {
  const database = requireDatabase();

  try {
    const result = database.exec(`PRAGMA table_info(${table})`);
    if (!result.length) return false;
    // PRAGMA table_info columns are: cid, name, type, notnull, dflt_value, pk
    return result[0].values.some((row) => row[1] === column);
  } catch {
    return false;
  }
}


/* ============================================================
   GENERATE DETERMINISTIC CHAT ID
============================================================ */

export function generateChatId(phone1, phone2) {
  if (!phone1 || !phone2) {
    throw new Error("Both phone numbers are required");
  }

  return [String(phone1), String(phone2)]
    .sort()
    .join("_");
}


/* ============================================================
   USER FUNCTIONS
============================================================ */

export function saveUser(user) {
  const database = optionalDatabase();
  if (!database) return null;

  if (!user?.phone) {
    return null;
  }

  const phone = String(user.phone);
  const name = user.name || phone;
  const avatarId = user.avatarId ?? null;
  const about = user.about ?? null;

  // COALESCE on update so a later placeholder save (which only knows the
  // phone number) can never wipe an avatar or status we already learned
  // from a real profile lookup.
  database.run(
    `
      INSERT INTO users (
        phone,
        name,
        avatar_id,
        about,
        created_at
      )
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(phone)
      DO UPDATE SET
        name = excluded.name,
        avatar_id = COALESCE(excluded.avatar_id, users.avatar_id),
        about = COALESCE(excluded.about, users.about)
    `,
    [phone, name, avatarId, about, Date.now()]
  );

  saveDatabaseBytes().catch(console.error);

  return getUserByPhone(phone);
}


export function getUserByPhone(phone) {
  const database = optionalDatabase();
  if (!database) return null;

  if (!phone) {
    return null;
  }

  const result = database.exec(
    `
      SELECT
        phone,
        name,
        avatar_id,
        about,
        created_at
      FROM users
      WHERE phone = ?
      LIMIT 1
    `,
    [String(phone)]
  );

  if (!result.length || !result[0].values.length) {
    return null;
  }

  const row = result[0].values[0];

  return {
    phone: row[0],
    name: row[1],
    avatar_id: row[2],
    about: row[3],
    created_at: row[4],
  };
}


/* ============================================================
   CREATE / GET CHAT
============================================================ */

export function createOrGetChat({
  chatId,
  userPhone,
  isGroup = false,
  name = "",
  members = [],
}) {
  const database = optionalDatabase();
  if (!database) return null;

  if (!chatId) {
    throw new Error("chatId is required");
  }

  const now = Date.now();

  const existing = database.exec(
    `
      SELECT
        chat_id,
        user_phone,
        is_group,
        name,
        members,
        last_message,
        last_message_time,
        unread_count,
        created_at,
        updated_at,
        COALESCE(pinned, 0),
        COALESCE(muted, 0),
        COALESCE(archived, 0),
        last_message_sender,
        last_message_status,
        avatar_id
      FROM chats
      WHERE chat_id = ?
      LIMIT 1
    `,
    [chatId]
  );

  if (existing.length && existing[0].values.length) {
    const row = existing[0].values[0];

    return mapChatRow(row);
  }

  const safeMembers = Array.from(
    new Set(
      members
        .filter(Boolean)
        .map(String)
    )
  );

  database.run(
    `
      INSERT INTO chats (
        chat_id,
        user_phone,
        is_group,
        name,
        members,
        last_message,
        last_message_time,
        unread_count,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      chatId,
      userPhone || "",
      isGroup ? 1 : 0,
      name || "",
      JSON.stringify(safeMembers),
      "",
      null,
      0,
      now,
      now,
    ]
  );

  saveDatabaseBytes().catch(console.error);

  return getChatById(chatId);
}


/* ============================================================
   GET CHAT BY ID
============================================================ */

export function getChatById(chatId) {
  const database = optionalDatabase();
  if (!database || !chatId) return null;

  const result = database.exec(
    `
      SELECT
        chat_id,
        user_phone,
        is_group,
        name,
        members,
        last_message,
        last_message_time,
        unread_count,
        created_at,
        updated_at,
        COALESCE(pinned, 0),
        COALESCE(muted, 0),
        COALESCE(archived, 0),
        last_message_sender,
        last_message_status,
        avatar_id
      FROM chats
      WHERE chat_id = ?
      LIMIT 1
    `,
    [chatId]
  );

  if (!result.length || !result[0].values.length) {
    return null;
  }

  return mapChatRow(result[0].values[0]);
}


/* ============================================================
   GET ALL CHATS
============================================================ */

export function getChats() {
  const database = optionalDatabase();
  if (!database) return [];

  const result = database.exec(`
    SELECT
      chat_id,
      user_phone,
      is_group,
      name,
      members,
      last_message,
      last_message_time,
      unread_count,
      created_at,
      updated_at,
      COALESCE(pinned, 0),
      COALESCE(muted, 0),
      COALESCE(archived, 0),
      last_message_sender,
      last_message_status,
      avatar_id
    FROM chats
    ORDER BY
      COALESCE(pinned, 0) DESC,
      COALESCE(last_message_time, updated_at) DESC
  `);

  if (!result.length) {
    return [];
  }

  return result[0].values.map(mapChatRow);
}


/* ============================================================
   MAP CHAT DATABASE ROW
============================================================ */

function mapChatRow(row) {
  let members = [];

  try {
    members = JSON.parse(row[4] || "[]");
  } catch {
    members = [];
  }

  return {
    chat_id: row[0],
    user_phone: row[1],
    // snake_case to match every other column in this row. It was
    // `isGroup` here and `is_group` in every consumer, which made
    // the flag read as undefined - so groups rendered and sent as
    // one-to-one chats. Caught by test-database.mjs.
    is_group: !!row[2],
    name: row[3] || "",
    members,
    last_message: row[5] || "",
    last_message_time: row[6],
    unread_count: Number(row[7] || 0),
    created_at: row[8],
    updated_at: row[9],
    pinned: !!row[10],
    muted: !!row[11],
    archived: !!row[12],
    last_message_sender: row[13] || "",
    last_message_status: row[14] || "",
    avatar_id: row[15] || null,
  };
}


/* ============================================================
   CLEAR UNREAD
============================================================ */

export function clearUnread(chatId) {
  const database = optionalDatabase();
  if (!database) return;

  database.run(
    `
      UPDATE chats
      SET unread_count = 0,
          updated_at = ?
      WHERE chat_id = ?
    `,
    [Date.now(), chatId]
  );

  saveDatabaseBytes().catch(console.error);
}


/* ============================================================
   SAVE MESSAGE
============================================================ */

export function saveMessage(data, options = {}) {
  const database = optionalDatabase();
  if (!database) return { inserted: false, reason: "no-storage" };

  const {
    messageId,
    chatId,
    senderPhone,
    receiverPhone,
    message,
    status = "SENDING",
    createdAt = Date.now(),
    deliveredAt = null,
    readAt = null,
  } = data || {};

  if (!messageId) {
    throw new Error("messageId is required");
  }

  if (!chatId) {
    throw new Error("chatId is required");
  }

  if (!senderPhone) {
    throw new Error("senderPhone is required");
  }

  if (!receiverPhone) {
    throw new Error("receiverPhone is required");
  }

  if (message == null) {
    throw new Error("message is required");
  }

  /*
  ------------------------------------------------------------
  CHECK DUPLICATE
  ------------------------------------------------------------
  */

  const existing = database.exec(
    `
      SELECT message_id
      FROM messages
      WHERE message_id = ?
      LIMIT 1
    `,
    [messageId]
  );

  if (existing.length && existing[0].values.length) {
    return {
      inserted: false,
      message: getMessageById(messageId),
    };
  }

  /*
  ------------------------------------------------------------
  INSERT MESSAGE
  ------------------------------------------------------------
  */

  database.run(
    `
      INSERT INTO messages (
        message_id,
        chat_id,
        sender_phone,
        receiver_phone,
        message,
        status,
        created_at,
        delivered_at,
        read_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      messageId,
      chatId,
      senderPhone,
      receiverPhone,
      String(message),
      status,
      createdAt,
      deliveredAt,
      readAt,
    ]
  );

  /*
  ------------------------------------------------------------
  UPDATE CHAT LAST MESSAGE
  ------------------------------------------------------------
  */

  const bumpUnread = options.bumpUnread === true;

  database.run(
    `
      UPDATE chats
      SET
        last_message = ?,
        last_message_time = ?,
        last_message_sender = ?,
        last_message_status = ?,
        unread_count =
          CASE
            WHEN ? = 1 THEN unread_count + 1
            ELSE unread_count
          END,
        updated_at = ?
      WHERE chat_id = ?
    `,
    [
      String(message),
      createdAt,
      String(senderPhone),
      String(status),
      bumpUnread ? 1 : 0,
      Date.now(),
      chatId,
    ]
  );

  /*
  ------------------------------------------------------------
  PERSIST SQLITE
  ------------------------------------------------------------
  */

  saveDatabaseBytes().catch(console.error);

  return {
    inserted: true,
    message: getMessageById(messageId),
  };
}


/* ============================================================
   GET MESSAGE BY ID
============================================================ */

function getMessageById(messageId) {
  const database = optionalDatabase();
  if (!database) return null;

  const result = database.exec(
    `
      SELECT
        message_id,
        chat_id,
        sender_phone,
        receiver_phone,
        message,
        status,
        created_at,
        delivered_at,
        read_at
      FROM messages
      WHERE message_id = ?
      LIMIT 1
    `,
    [messageId]
  );

  if (!result.length || !result[0].values.length) {
    return null;
  }

  return mapMessageRow(result[0].values[0]);
}


/* ============================================================
   GET MESSAGES BY CHAT
============================================================ */

export function getMessagesByChatId(chatId, options = {}) {
  const database = optionalDatabase();
  if (!database) return [];

  const limit = Math.max(
    1,
    Math.min(
      Number(options.limit || 50),
      500
    )
  );

  let sql = `
    SELECT
      message_id,
      chat_id,
      sender_phone,
      receiver_phone,
      message,
      status,
      created_at,
      delivered_at,
      read_at
    FROM messages
    WHERE chat_id = ?
  `;

  const params = [chatId];

  if (options.beforeTimestamp != null) {
    sql += `
      AND created_at < ?
    `;

    params.push(Number(options.beforeTimestamp));
  }

  sql += `
    ORDER BY created_at DESC
    LIMIT ?
  `;

  params.push(limit);

  const result = database.exec(sql, params);

  if (!result.length) {
    return [];
  }

  /*
  SQL gets newest → oldest.
  UI wants oldest → newest.
  */

  return result[0].values
    .map(mapMessageRow)
    .reverse();
}


/* ============================================================
   MAP MESSAGE ROW
============================================================ */

function mapMessageRow(row) {
  return {
    message_id: row[0],
    chat_id: row[1],
    sender_phone: row[2],
    receiver_phone: row[3],
    message: row[4],
    status: row[5],
    created_at: row[6],
    delivered_at: row[7],
    read_at: row[8],
  };
}


/* ============================================================
   UPDATE MESSAGE STATUS
============================================================ */

export function updateMessageStatus(messageId, status) {
  const database = optionalDatabase();
  if (!database) return;

  const normalizedStatus = String(status || "").toUpperCase();

  let deliveredAt = null;
  let readAt = null;

  if (normalizedStatus === "DELIVERED") {
    deliveredAt = Date.now();
  }

  if (normalizedStatus === "READ") {
    readAt = Date.now();
  }

  database.run(
    `
      UPDATE messages
      SET
        status = ?,
        delivered_at =
          CASE
            WHEN ? IS NOT NULL THEN ?
            ELSE delivered_at
          END,
        read_at =
          CASE
            WHEN ? IS NOT NULL THEN ?
            ELSE read_at
          END
      WHERE message_id = ?
    `,
    [
      normalizedStatus,
      deliveredAt,
      deliveredAt,
      readAt,
      readAt,
      messageId,
    ]
  );

  // Keep the chat-list preview's tick in step with the message it is
  // previewing. Without this the row would show a single "sent" tick
  // forever even after the message was read.
  database.run(
    `
      UPDATE chats
      SET last_message_status = ?
      WHERE chat_id = (
        SELECT chat_id FROM messages WHERE message_id = ?
      )
      AND last_message_time = (
        SELECT created_at FROM messages WHERE message_id = ?
      )
    `,
    [normalizedStatus, messageId, messageId]
  );

  saveDatabaseBytes().catch(console.error);
}


/* ============================================================
   MARK MESSAGES AS READ
============================================================ */

export function markMessagesAsRead(chatId, myPhone) {
  const database = optionalDatabase();
  if (!database) return [];

  const result = database.exec(
    `
      SELECT message_id
      FROM messages
      WHERE
        chat_id = ?
        AND receiver_phone = ?
        AND status != 'READ'
    `,
    [chatId, myPhone]
  );

  const messageIds = result.length
    ? result[0].values.map((row) => row[0])
    : [];

  if (messageIds.length === 0) {
    return [];
  }

  const now = Date.now();

  database.run(
    `
      UPDATE messages
      SET
        status = 'READ',
        read_at = ?
      WHERE
        chat_id = ?
        AND receiver_phone = ?
        AND status != 'READ'
    `,
    [
      now,
      chatId,
      myPhone,
    ]
  );

  database.run(
    `
      UPDATE chats
      SET
        unread_count = 0,
        updated_at = ?
      WHERE chat_id = ?
    `,
    [
      now,
      chatId,
    ]
  );

  saveDatabaseBytes().catch(console.error);

  return messageIds;
}


/* ============================================================
   BACKUP DATABASE
============================================================ */

export async function exportDatabaseFile() {
  const database = requireDatabase();

  /*
  Make sure latest changes are persisted.
  */

  await saveDatabaseBytes();

  const bytes = database.export();

  const blob = new Blob(
    [bytes],
    {
      type: "application/x-sqlite3",
    }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = `chat-backup-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.chatdb`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}


/* ============================================================
   RESTORE DATABASE
============================================================ */

export async function importDatabaseFile(file) {
  if (!file) {
    throw new Error("No database file selected");
  }

  if (!SQL) {
    throw new Error("SQLite engine is not initialized");
  }

  const arrayBuffer = await file.arrayBuffer();

  const bytes = new Uint8Array(arrayBuffer);

  /*
  ------------------------------------------------------------
  OPEN BACKUP DATABASE FIRST
  ------------------------------------------------------------
  */

  let importedDb;

  try {
    importedDb = new SQL.Database(bytes);
  } catch {
    throw new Error(
      "Invalid SQLite backup file"
    );
  }

  /*
  ------------------------------------------------------------
  VALIDATE REQUIRED TABLES
  ------------------------------------------------------------
  */

  const tables = importedDb.exec(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
  `);

  const tableNames = tables.length
    ? tables[0].values.map((row) => row[0])
    : [];

  const requiredTables = [
    "users",
    "chats",
    "messages",
  ];

  const missingTables = requiredTables.filter(
    (table) => !tableNames.includes(table)
  );

  if (missingTables.length > 0) {
    importedDb.close();

    throw new Error(
      `Invalid backup. Missing tables: ${missingTables.join(", ")}`
    );
  }

  /*
  ------------------------------------------------------------
  REPLACE CURRENT DATABASE
  ------------------------------------------------------------
  */

  if (db) {
    db.close();
  }

  db = importedDb;

  /*
  ------------------------------------------------------------
  PERSIST RESTORED DATABASE
  ------------------------------------------------------------
  */

  await saveDatabaseBytes();

  initialized = true;

  console.log("SQLite database restored successfully");

  return true;
}


/* ============================================================
   OPTIONAL: CLEAR COMPLETE LOCAL DATABASE
============================================================ */

export async function clearDatabase() {
  if (!db) {
    return;
  }

  db.close();

  db = new SQL.Database();

  createTables();

  await saveDatabaseBytes();

  console.log("Local SQLite database cleared");
}


/* ============================================================
   OPTIONAL: GET DATABASE STATS
============================================================ */

export function getDatabaseStats() {
  const database = optionalDatabase();
  if (!database) return { users: 0, chats: 0, messages: 0 };

  const users = database.exec(`
    SELECT COUNT(*) FROM users
  `);

  const chats = database.exec(`
    SELECT COUNT(*) FROM chats
  `);

  const messages = database.exec(`
    SELECT COUNT(*) FROM messages
  `);

  return {
    users: users[0]?.values[0]?.[0] || 0,
    chats: chats[0]?.values[0]?.[0] || 0,
    messages: messages[0]?.values[0]?.[0] || 0,
  };
}

/* ============================================================
   CHAT MANAGEMENT

   Everything here is local-only. Deleting a chat removes this
   device's copy; it does not ask the server to delete anything for
   the other person, and the UI says so rather than implying a
   "delete for everyone" that doesn't exist.
============================================================ */

export function setChatFlag(chatId, flag, value) {
  const database = optionalDatabase();
  if (!database) return;

  const allowed = ["pinned", "muted", "archived"];
  if (!allowed.includes(flag)) {
    throw new Error(`Unknown chat flag: ${flag}`);
  }

  database.run(
    `UPDATE chats SET ${flag} = ?, updated_at = ? WHERE chat_id = ?`,
    [value ? 1 : 0, Date.now(), chatId]
  );

  saveDatabaseBytes().catch(console.error);
}


export function deleteChat(chatId) {
  const database = optionalDatabase();
  if (!database) return false;

  if (!chatId) {
    return false;
  }

  database.run(`DELETE FROM messages WHERE chat_id = ?`, [chatId]);
  database.run(`DELETE FROM chats WHERE chat_id = ?`, [chatId]);

  saveDatabaseBytes().catch(console.error);

  return true;
}


export function clearChatMessages(chatId) {
  const database = optionalDatabase();
  if (!database) return false;

  if (!chatId) {
    return false;
  }

  database.run(`DELETE FROM messages WHERE chat_id = ?`, [chatId]);
  database.run(
    `
      UPDATE chats
      SET last_message = NULL,
          last_message_time = NULL,
          unread_count = 0,
          updated_at = ?
      WHERE chat_id = ?
    `,
    [Date.now(), chatId]
  );

  saveDatabaseBytes().catch(console.error);

  return true;
}


export function deleteMessage(messageId) {
  const database = optionalDatabase();
  if (!database) return false;

  if (!messageId) {
    return false;
  }

  // Find the chat first so the chat list preview can be recalculated -
  // deleting the newest message must not leave a stale preview behind.
  const owner = database.exec(
    `SELECT chat_id FROM messages WHERE message_id = ? LIMIT 1`,
    [messageId]
  );

  if (!owner.length || !owner[0].values.length) {
    return false;
  }

  const chatId = owner[0].values[0][0];

  database.run(`DELETE FROM messages WHERE message_id = ?`, [messageId]);

  const newest = database.exec(
    `
      SELECT message, created_at
      FROM messages
      WHERE chat_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [chatId]
  );

  if (newest.length && newest[0].values.length) {
    const [message, createdAt] = newest[0].values[0];
    database.run(
      `UPDATE chats SET last_message = ?, last_message_time = ?, updated_at = ? WHERE chat_id = ?`,
      [message, createdAt, Date.now(), chatId]
    );
  } else {
    database.run(
      `UPDATE chats SET last_message = NULL, last_message_time = NULL, updated_at = ? WHERE chat_id = ?`,
      [Date.now(), chatId]
    );
  }

  saveDatabaseBytes().catch(console.error);

  return true;
}


/* ============================================================
   SEARCH

   Two shapes: within one conversation (for the in-chat search bar)
   and across every conversation (for the global search field).
============================================================ */

export function searchMessagesInChat(chatId, term) {
  const database = optionalDatabase();
  if (!database) return [];

  const query = String(term || "").trim();
  if (!chatId || query.length < 2) {
    return [];
  }

  const result = database.exec(
    `
      SELECT
        message_id,
        chat_id,
        sender_phone,
        receiver_phone,
        message,
        status,
        created_at
      FROM messages
      WHERE chat_id = ?
        AND message LIKE ? ESCAPE '\\'
      ORDER BY created_at DESC
      LIMIT 50
    `,
    [chatId, `%${escapeLike(query)}%`]
  );

  if (!result.length) {
    return [];
  }

  return result[0].values.map((row) => ({
    message_id: row[0],
    chat_id: row[1],
    sender_phone: row[2],
    receiver_phone: row[3],
    message: row[4],
    status: row[5],
    created_at: row[6],
  }));
}


export function searchAllMessages(term) {
  const database = optionalDatabase();
  if (!database) return [];

  const query = String(term || "").trim();
  if (query.length < 2) {
    return [];
  }

  const result = database.exec(
    `
      SELECT
        m.message_id,
        m.chat_id,
        m.sender_phone,
        m.message,
        m.created_at,
        c.name
      FROM messages m
      JOIN chats c ON c.chat_id = m.chat_id
      WHERE m.message LIKE ? ESCAPE '\\'
      ORDER BY m.created_at DESC
      LIMIT 30
    `,
    [`%${escapeLike(query)}%`]
  );

  if (!result.length) {
    return [];
  }

  return result[0].values.map((row) => ({
    message_id: row[0],
    chat_id: row[1],
    sender_phone: row[2],
    message: row[3],
    created_at: row[4],
    chat_name: row[5] || "",
  }));
}


/**
 * A user searching for "100%" or "a_b" means those characters literally,
 * not LIKE's wildcards. Without this, "%" matches every message.
 */
function escapeLike(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}


/* ============================================================
   UNREAD TOTAL - drives the browser tab badge
============================================================ */

export function getTotalUnread() {
  const database = optionalDatabase();
  if (!database) return 0;

  const result = database.exec(
    `SELECT COALESCE(SUM(unread_count), 0) FROM chats WHERE COALESCE(archived, 0) = 0`
  );

  if (!result.length || !result[0].values.length) {
    return 0;
  }

  return Number(result[0].values[0][0] || 0);
}


/* ============================================================
   GROUP CHAT METADATA

   A group's name, avatar and roster all live on the server and can
   change while this device is offline. createOrGetChat deliberately
   won't touch an existing row - correct for a one-to-one thread,
   wrong for a group - so syncing uses this instead.
============================================================ */

export function upsertGroupChat({ chatId, userPhone, name, avatarId, members = [] }) {
  const database = optionalDatabase();
  if (!database) return null;

  if (!chatId) {
    throw new Error("chatId is required");
  }

  const now = Date.now();
  const encodedMembers = JSON.stringify(members);

  database.run(
    `
      INSERT INTO chats (
        chat_id,
        user_phone,
        is_group,
        name,
        avatar_id,
        members,
        unread_count,
        created_at,
        updated_at
      )
      VALUES (?, ?, 1, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(chat_id)
      DO UPDATE SET
        name = excluded.name,
        avatar_id = excluded.avatar_id,
        members = excluded.members,
        is_group = 1,
        updated_at = excluded.updated_at
    `,
    [chatId, String(userPhone), name || "Group", avatarId || null, encodedMembers, now, now]
  );

  saveDatabaseBytes().catch(console.error);

  return getChatById(chatId);
}



/**
 * Removes any local group chat the server no longer lists us in -
 * someone removed us, or the group was deleted. Without this the
 * thread would linger forever and silently fail to send.
 */
export function pruneStaleGroups(activeGroupIds) {
  const database = optionalDatabase();
  if (!database) return [];

  const result = database.exec(
    `SELECT chat_id FROM chats WHERE is_group = 1`
  );

  if (!result.length) return [];

  const keep = new Set(activeGroupIds);
  const removed = [];

  result[0].values.forEach(([chatId]) => {
    if (!keep.has(chatId)) {
      database.run(`DELETE FROM messages WHERE chat_id = ?`, [chatId]);
      database.run(`DELETE FROM chats WHERE chat_id = ?`, [chatId]);
      removed.push(chatId);
    }
  });

  if (removed.length) {
    saveDatabaseBytes().catch(console.error);
  }

  return removed;
}
