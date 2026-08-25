/*
 * Integration tests against the real SQLite layer.
 *
 * There's no IndexedDB in Node, so initDatabase() takes its
 * in-memory fallback path - which is itself worth exercising, since
 * that's what a Firefox private window gets.
 *
 *   npm run test:db
 */
import {
  clearChatMessages,
  createOrGetChat,
  deleteChat,
  deleteMessage,
  generateChatId,
  getChatById,
  getChats,
  getMessagesByChatId,
  getTotalUnread,
  getUserByPhone,
  initDatabase,
  isPersistent,
  isStorageAvailable,
  pruneStaleGroups,
  saveMessage,
  saveUser,
  searchAllMessages,
  searchMessagesInChat,
  setChatFlag,
  updateMessageStatus,
  upsertGroupChat,
} from "./src/database/index.js";

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function checkThat(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
}

const ME = "+441700900111";
const ALEX = "+441700900222";
const MIRA = "+441700900333";

await initDatabase();

console.log("\nstorage state");
checkThat("a database exists", isStorageAvailable());
check("but it isn't persistent without IndexedDB", isPersistent(), false);

console.log("\ndirect chats");

const directId = generateChatId(ME, ALEX);
check("chat id is order-independent", generateChatId(ALEX, ME), directId);

saveUser({ phone: ALEX, name: "Alex Mwangi", avatarId: "sea" });
createOrGetChat({
  chatId: directId,
  userPhone: ME,
  isGroup: false,
  name: "Alex Mwangi",
  members: [ME, ALEX],
});

saveMessage({
  messageId: "m1",
  chatId: directId,
  senderPhone: ME,
  receiverPhone: ALEX,
  message: "Are we still on for Thursday?",
  status: "SENDING",
  createdAt: Date.now() - 60000,
});

check("message is stored", getMessagesByChatId(directId).length, 1);
check("chat preview updates", getChatById(directId).last_message, "Are we still on for Thursday?");
check("preview records the sender", getChatById(directId).last_message_sender, ME);
check("preview records the status", getChatById(directId).last_message_status, "SENDING");

// This is the bug that shipped ticks stuck on "sent" - the preview
// row wasn't updated alongside the message.
updateMessageStatus("m1", "READ");
check("preview status follows the message", getChatById(directId).last_message_status, "READ");

console.log("\nunread counting");

saveMessage(
  {
    messageId: "m2",
    chatId: directId,
    senderPhone: ALEX,
    receiverPhone: ME,
    message: "Yes, 7pm",
    status: "DELIVERED",
    createdAt: Date.now(),
  },
  { bumpUnread: true }
);

check("unread increments", getChatById(directId).unread_count, 1);
check("total unread sees it", getTotalUnread(), 1);

console.log("\ngroups");

const GROUP_ID = "grp_test000000000001";

upsertGroupChat({
  chatId: GROUP_ID,
  userPhone: ME,
  name: "Thursday Club",
  avatarId: "iris",
  members: [ME, ALEX, MIRA],
});

const group = getChatById(GROUP_ID);
checkThat("group chat is created", Boolean(group));
check("group is flagged as such", group.is_group, true);
check("group keeps its name", group.name, "Thursday Club");
check("group keeps its avatar", group.avatar_id, "iris");
check("group keeps its roster", group.members.length, 3);

// createOrGetChat deliberately ignores changes to an existing row.
// upsertGroupChat must not, or a rename would never land.
upsertGroupChat({
  chatId: GROUP_ID,
  userPhone: ME,
  name: "Friday Club",
  avatarId: "moss",
  members: [ME, ALEX],
});

check("rename lands on an existing group", getChatById(GROUP_ID).name, "Friday Club");
check("roster change lands too", getChatById(GROUP_ID).members.length, 2);

saveMessage(
  {
    messageId: "g1",
    chatId: GROUP_ID,
    senderPhone: MIRA,
    receiverPhone: GROUP_ID,
    message: "Running ten minutes late",
    status: "DELIVERED",
    createdAt: Date.now(),
  },
  { bumpUnread: true }
);

check("group message lands in the group thread", getMessagesByChatId(GROUP_ID).length, 1);
check(
  "group message does not leak into the direct thread",
  getMessagesByChatId(directId).length,
  2
);

console.log("\npruning");

// Someone removed us from a group, or it was deleted server-side.
const removed = pruneStaleGroups(["grp_some_other_group"]);
check("stale group is pruned", removed, [GROUP_ID]);
checkThat("pruned group is gone", getChatById(GROUP_ID) === null);
check("its messages go too", getMessagesByChatId(GROUP_ID).length, 0);
checkThat(
  "direct chats survive pruning",
  getChatById(directId) !== null,
  "pruneStaleGroups removed a one-to-one chat"
);

console.log("\nsearch");

check("in-chat search finds a match", searchMessagesInChat(directId, "Thursday").length, 1);
check("in-chat search ignores 1-char terms", searchMessagesInChat(directId, "T").length, 0);
check("global search works", searchAllMessages("7pm").length, 1);

// A literal % must not behave as a LIKE wildcard.
saveMessage({
  messageId: "m3",
  chatId: directId,
  senderPhone: ME,
  receiverPhone: ALEX,
  message: "Battery at 50% already",
  status: "SENT",
  createdAt: Date.now(),
});
check("percent is matched literally", searchMessagesInChat(directId, "50%").length, 1);
checkThat(
  "a bare percent doesn't match everything",
  searchMessagesInChat(directId, "%%").length === 0,
  "LIKE wildcards are leaking through"
);

console.log("\nflags and deletion");

setChatFlag(directId, "pinned", true);
check("pin sticks", getChatById(directId).pinned, true);
check("pinned chat sorts first", getChats()[0].chat_id, directId);

setChatFlag(directId, "archived", true);
check("archived chats leave the unread total", getTotalUnread(), 0);
setChatFlag(directId, "archived", false);

deleteMessage("m3");
check("message is deleted", getMessagesByChatId(directId).length, 2);
check(
  "preview falls back to the previous message",
  getChatById(directId).last_message,
  "Yes, 7pm"
);

clearChatMessages(directId);
check("clearing empties the thread", getMessagesByChatId(directId).length, 0);
// mapChatRow coerces a NULL preview to "" so the list can treat it
// as falsy without null checks at every call site.
check("clearing empties the preview", getChatById(directId).last_message, "");
checkThat("clearing keeps the chat", getChatById(directId) !== null);

deleteChat(directId);
checkThat("deleting removes the chat", getChatById(directId) === null);

console.log("\nusers");
check("saved user is readable", getUserByPhone(ALEX).name, "Alex Mwangi");
check("avatar survives", getUserByPhone(ALEX).avatar_id, "sea");

// A later placeholder save knows only the phone number and must not
// wipe the name we already learned.
saveUser({ phone: ALEX, name: ALEX });
check("placeholder save keeps the avatar", getUserByPhone(ALEX).avatar_id, "sea");

check("unknown user is null", getUserByPhone("+000"), null);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
