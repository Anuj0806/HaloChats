import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

import { WS_URL } from "../constant/config";
import { generateId } from "@/lib/utils";
import { isOnline, lookupByPhone } from "../services/profileService";
import { listGroups } from "../services/groupService";
import {
  clearChatMessages,
  clearUnread,
  createOrGetChat,
  deleteChat,
  deleteMessage,
  generateChatId,
  getChats,
  getMessagesByChatId,
  getTotalUnread,
  getChatById,
  getUserByPhone,
  initDatabase,
  upsertGroupChat,
  pruneStaleGroups,
  isPersistent,
  isStorageAvailable,
  markMessagesAsRead,
  saveMessage,
  saveUser,
  setChatFlag,
  updateMessageStatus,
} from "@/database";

/* ============================================================
   CHAT ENGINE

   Everything stateful about messaging lives here so the panes can
   be pure presentation. Two rules shape the whole design:

   1. The local SQLite database is the source of truth for what is
      on screen. Every action writes there first and then re-reads,
      so the UI can never show something that wasn't persisted.

   2. The network is optional. Sending while disconnected leaves the
      message as SENDING in the database rather than throwing it
      away, and it is flushed on reconnect.
============================================================ */

/** AckDTO.status is a plain int on the wire, not a string. */
const ACK_STATUS = { 1: "SENT", 2: "DELIVERED", 3: "READ" };

const PAGE_SIZE = 50;
const TYPING_STOP_DELAY = 2200;
const ONLINE_POLL_MS = 6000;

export default function useChatEngine({
  myPhone,
  myName,
  onIncoming,
  sendReadReceipts = true,
  sealedFrameRef,
}) {
  const [dbReady, setDbReady] = useState(false);
  // Two separate facts. `storageAvailable` asks whether there is a
  // database at all; `storagePersists` asks whether anything in it
  // survives a refresh. A Firefox private window answers yes then no,
  // and the UI has to say exactly that instead of claiming a total
  // failure or - worse - staying silent while data quietly evaporates.
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [storagePersists, setStoragePersists] = useState(true);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [connected, setConnected] = useState(false);
  const [typingByChat, setTypingByChat] = useState({});
  const [presence, setPresence] = useState({});
  const [groupsById, setGroupsById] = useState({});

  const stomp = useRef(null);
  const activeChatRef = useRef(null);
  const typingTimer = useRef(null);
  const wasTyping = useRef(false);
  const typingClearTimers = useRef({});
  const onIncomingRef = useRef(onIncoming);
  const myNameRef = useRef(myName);
  const readReceiptsRef = useRef(sendReadReceipts);

  useEffect(() => {
    onIncomingRef.current = onIncoming;
  }, [onIncoming]);

  useEffect(() => {
    myNameRef.current = myName;
  }, [myName]);

  useEffect(() => {
    readReceiptsRef.current = sendReadReceipts;
  }, [sendReadReceipts]);

  /* ---------- local database ---------- */

  useEffect(() => {
    let cancelled = false;

    initDatabase()
      .then(() => {
        if (cancelled) return;
        setChats(getChats());
        setStorageAvailable(isStorageAvailable());
        setStoragePersists(isPersistent());
        setDbReady(true);
      })
      .catch((error) => {
        if (cancelled) return;

        // No IndexedDB: a Firefox private window, or site data blocked.
        // Carry on in memory-only mode rather than showing a dead
        // screen - live messaging still works, it just won't persist.
        // Every read in database/index.js returns an empty result in
        // this state instead of throwing, so nothing below crashes.
        console.error("Local chat storage unavailable:", error);
        setStorageAvailable(false);
        setStoragePersists(false);
        setDbReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- groups ---------- */

  /**
   * Pulls the authoritative roster from the server and mirrors it
   * locally. Also prunes groups we're no longer in, so a thread we've
   * been removed from disappears instead of lingering and silently
   * failing to send.
   */
  const syncGroups = useCallback(async () => {
    if (!myPhone) return;

    try {
      const groups = await listGroups();

      groups.forEach((group) => {
        upsertGroupChat({
          chatId: group.groupId,
          userPhone: myPhone,
          name: group.name,
          avatarId: group.avatarId,
          members: (group.members || []).map((member) => member.phone),
        });

        // Cache member names so their messages render with a name
        // even before any one-to-one contact exists.
        (group.members || []).forEach((member) => {
          saveUser({ phone: member.phone, name: member.name, avatarId: member.avatarId });
        });
      });

      const removed = pruneStaleGroups(groups.map((group) => group.groupId));

      if (removed.includes(activeChatRef.current?.chat_id)) {
        setActiveChatId(null);
        setMessages([]);
      }

      setChats(getChats());
      setGroupsById(Object.fromEntries(groups.map((group) => [group.groupId, group])));
    } catch (error) {
      // Offline, or the token expired. The locally cached groups stay
      // usable; this is a refresh, not a prerequisite.
      console.warn("Couldn't sync groups:", error.message);
    }
  }, [myPhone]);

  const syncGroupsRef = useRef(syncGroups);

  useEffect(() => {
    syncGroupsRef.current = syncGroups;
  }, [syncGroups]);

  const refreshChats = useCallback(() => {
    try {
      setChats(getChats());
    } catch (error) {
      console.error("Couldn't read chats:", error);
    }
  }, []);

  const loadPage = useCallback((chatId, options) => {
    const page = getMessagesByChatId(chatId, options);
    setHasMoreHistory(page.length === PAGE_SIZE);
    return page;
  }, []);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.chat_id === activeChatId) || null,
    [chats, activeChatId]
  );

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  const partnerOf = useCallback(
    (chat) => chat?.members?.find((member) => member !== myPhone) || "",
    [myPhone]
  );

  /* ---------- presence polling ---------- */

  useEffect(() => {
    const phones = [
      ...new Set(chats.map((chat) => partnerOf(chat)).filter(Boolean)),
    ];

    if (phones.length === 0) return undefined;

    let cancelled = false;

    const poll = async () => {
      const entries = await Promise.all(
        phones.map(async (phone) => [phone, await isOnline(phone)])
      );

      // Merge rather than replace: a failed lookup returns false, and
      // overwriting the whole map would flash everyone offline on a
      // single dropped request.
      if (!cancelled) {
        setPresence((current) => ({ ...current, ...Object.fromEntries(entries) }));
      }
    };

    poll();
    const interval = setInterval(poll, ONLINE_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [chats, partnerOf]);

  /* ---------- receiving ---------- */

  const handleIncoming = useCallback(
    (dto, client) => {
      // A group message is filed under the group, not under whoever
      // happened to send it - otherwise every member would spawn a
      // separate one-to-one thread on the recipient's device.
      const isGroup = Boolean(dto.groupId);
      const chatId = isGroup ? dto.groupId : generateChatId(dto.sender, dto.receiver);
      const isOpen = activeChatRef.current?.chat_id === chatId;

      // Backfill the sender's name and avatar in the background. Until
      // it lands the chat shows their number, which is still usable.
      if (!getUserByPhone(dto.sender)) {
        // senderName rides along on group messages precisely so a
        // member you've never DM'd still shows a name, not a number.
        saveUser({ phone: dto.sender, name: dto.senderName || dto.sender });

        lookupByPhone(dto.sender).then((user) => {
          if (!user) return;
          saveUser({
            phone: dto.sender,
            name: user.name || dto.sender,
            avatarId: user.avatarId,
            about: user.about,
          });
          refreshChats();
        });
      }

      const known = getUserByPhone(dto.sender);

      if (isGroup) {
        // The roster is authoritative on the server; this only ensures
        // a row exists so the message has somewhere to land. The real
        // name and members arrive with the next group sync.
        const existing = getChatById(chatId);

        if (!existing) {
          upsertGroupChat({
            chatId,
            userPhone: myPhone,
            name: "Group",
            members: [myPhone, dto.sender],
          });

          // Fetch the real details rather than leaving it as "Group".
          syncGroupsRef.current?.();
        }
      } else {
        createOrGetChat({
          chatId,
          userPhone: myPhone,
          isGroup: false,
          name: known?.name || dto.sender,
          members: [myPhone, dto.sender],
        });
      }

      const { inserted } = saveMessage(
        {
          messageId: dto.messageId,
          chatId,
          senderPhone: dto.sender,
          receiverPhone: dto.receiver,
          message: dto.payload,
          // It has physically arrived on this device, which is what
          // "delivered" means locally.
          status: "DELIVERED",
          createdAt: dto.timeStamp,
          deliveredAt: Date.now(),
        },
        { bumpUnread: !isOpen }
      );

      if (inserted) {
        // Tells the server its copy can be dropped now that a durable
        // local one exists. Not a status broadcast.
        client.publish({ destination: "/app/messageDelivered", body: dto.messageId });

        if (!isOpen) {
          onIncomingRef.current?.({
            chatId,
            sender: dto.senderName || known?.name || dto.sender,
            text: dto.payload,
            isGroup,
          });
        }
      }

      refreshChats();

      if (isOpen) {
        setMessages(loadPage(chatId));

        // The message is still marked read locally either way - the
        // setting governs what the *sender* gets told, not what this
        // device knows.
        if (readReceiptsRef.current) {
          client.publish({
            destination: "/app/chat.read",
            body: JSON.stringify({
              messageId: dto.messageId,
              sender: dto.sender,
              reader: myPhone,
            }),
          });
        }
      }
    },
    [myPhone, refreshChats, loadPage]
  );

  /* ---------- websocket ---------- */

  useEffect(() => {
    if (!myPhone || !dbReady) return undefined;

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: { "user-id": myPhone },
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,

      onConnect: () => {
        setConnected(true);

        // Ask for anything queued while this device was away.
        client.publish({ destination: "/app/chat.ready", body: "" });

        // Refresh the group roster on every (re)connect. Membership can
        // change while offline, and this is the natural moment to
        // reconcile - it also keeps the call out of an effect body.
        syncGroupsRef.current?.();

        client.subscribe("/user/queue/receiveMessage", (frame) => {
          handleIncoming(JSON.parse(frame.body), client);
        });

        client.subscribe("/user/queue/ack", (frame) => {
          const ack = JSON.parse(frame.body);
          const status = ACK_STATUS[ack.status];
          if (!status) return;

          updateMessageStatus(ack.messageId, status);

          const current = activeChatRef.current;
          if (current) setMessages(loadPage(current.chat_id));
          refreshChats();
        });

        /* ----- sealed (end-to-end encrypted) chat -----
           Routed through this one socket rather than a second
           connection. The payloads are opaque to everything here;
           useSealedChat holds the only keys that can open them. */
        client.subscribe("/user/queue/sealed.receive", (frame) => {
          sealedFrameRef?.current?.("receive", JSON.parse(frame.body));
        });

        client.subscribe("/user/queue/sealed.ack", (frame) => {
          sealedFrameRef?.current?.("ack", JSON.parse(frame.body));
        });

        client.subscribe("/user/queue/sealed.undelivered", (frame) => {
          sealedFrameRef?.current?.("undelivered", JSON.parse(frame.body));
        });

        client.subscribe("/user/queue/sealed.typing", (frame) => {
          sealedFrameRef?.current?.("typing", JSON.parse(frame.body));
        });

        client.subscribe("/user/queue/sealed.closed", (frame) => {
          sealedFrameRef?.current?.("closed", JSON.parse(frame.body));
        });

        client.subscribe("/user/queue/typing", (frame) => {
          const payload = JSON.parse(frame.body);
          const chatId = payload.groupId
            ? payload.groupId
            : generateChatId(payload.sender, payload.receiver);

          setTypingByChat((current) => ({ ...current, [chatId]: !!payload.typing }));

          // A "stopped typing" frame can be lost. Without this the
          // indicator would stay on screen forever.
          clearTimeout(typingClearTimers.current[chatId]);
          if (payload.typing) {
            typingClearTimers.current[chatId] = setTimeout(() => {
              setTypingByChat((current) => ({ ...current, [chatId]: false }));
            }, 6000);
          }
        });
      },

      onDisconnect: () => setConnected(false),
      onWebSocketClose: () => setConnected(false),
      onStompError: (frame) => {
        console.error("STOMP error:", frame.headers?.message);
        setConnected(false);
      },
    });

    client.activate();
    stomp.current = client;

    // Captured now: by the time cleanup runs, typingClearTimers.current
    // may point at a different object, and the timers created by this
    // subscription would never be cleared.
    const pendingTypingTimers = typingClearTimers.current;

    return () => {
      Object.values(pendingTypingTimers).forEach(clearTimeout);
      client.deactivate();
      stomp.current = null;
      setConnected(false);
    };
  }, [myPhone, dbReady, handleIncoming, loadPage, refreshChats, sealedFrameRef]);

  /* ---------- flush anything stuck in SENDING on reconnect ---------- */

  useEffect(() => {
    if (!connected || !dbReady) return;

    const pending = chats
      .flatMap((chat) => getMessagesByChatId(chat.chat_id, { limit: PAGE_SIZE }))
      .filter((message) => message.sender_phone === myPhone && message.status === "SENDING");

    pending.forEach((message) => {
      const chat = getChatById(message.chat_id);
      const isGroup = Boolean(chat?.is_group);

      stomp.current?.publish({
        destination: "/app/chat.send",
        body: JSON.stringify({
          messageId: message.message_id,
          sender: message.sender_phone,
          receiver: isGroup ? null : message.receiver_phone,
          payload: message.message,
          timeStamp: message.created_at,
          groupId: isGroup ? message.chat_id : null,
          senderName: myNameRef.current,
        }),
      });
    });
    // Runs on the transition into "connected", not on every chat change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  /* ---------- opening a conversation ---------- */

  const openChat = useCallback(
    (chatId) => {
      if (!chatId) {
        setActiveChatId(null);
        setMessages([]);
        return;
      }

      setActiveChatId(chatId);
      setMessages(loadPage(chatId));
      clearUnread(chatId);
      refreshChats();

      if (!stomp.current?.connected) return;

      const readIds = markMessagesAsRead(chatId, myPhone);
      if (readIds.length === 0) return;

      const fresh = getMessagesByChatId(chatId, { limit: PAGE_SIZE });

      if (readReceiptsRef.current) {
        readIds.forEach((messageId) => {
          const original = fresh.find((m) => m.message_id === messageId);
          stomp.current?.publish({
            destination: "/app/chat.read",
            body: JSON.stringify({
              messageId,
              sender: original?.sender_phone,
              reader: myPhone,
            }),
          });
        });
      }

      setMessages(fresh);
    },
    [loadPage, myPhone, refreshChats]
  );

  const startChatWith = useCallback(
    (user) => {
      saveUser({
        phone: user.phone,
        name: user.name || user.phone,
        avatarId: user.avatarId,
        about: user.about,
      });

      const chatId = generateChatId(myPhone, user.phone);

      createOrGetChat({
        chatId,
        userPhone: myPhone,
        isGroup: false,
        name: user.name || user.phone,
        members: [myPhone, user.phone],
      });

      refreshChats();
      openChat(chatId);

      return chatId;
    },
    [myPhone, openChat, refreshChats]
  );

  const loadOlder = useCallback(() => {
    if (!activeChatId || messages.length === 0) return;

    const older = loadPage(activeChatId, {
      limit: PAGE_SIZE,
      beforeTimestamp: messages[0].created_at,
    });

    if (older.length > 0) {
      setMessages((current) => [...older, ...current]);
    }
  }, [activeChatId, messages, loadPage]);

  /* ---------- typing ---------- */

  const publishTyping = useCallback(
    (typing) => {
      const chat = activeChatRef.current;
      if (!chat || !stomp.current?.connected) return;

      const isGroup = Boolean(chat.is_group);
      const receiver = isGroup ? null : partnerOf(chat);

      if (!isGroup && !receiver) return;

      stomp.current.publish({
        destination: "/app/chat.typing",
        body: JSON.stringify({
          sender: myPhone,
          receiver,
          typing,
          groupId: isGroup ? chat.chat_id : null,
        }),
      });
    },
    [myPhone, partnerOf]
  );

  const notifyTyping = useCallback(() => {
    if (!wasTyping.current) {
      wasTyping.current = true;
      publishTyping(true);
    }

    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      wasTyping.current = false;
      publishTyping(false);
    }, TYPING_STOP_DELAY);
  }, [publishTyping]);

  const stopTyping = useCallback(() => {
    if (!wasTyping.current) return;
    wasTyping.current = false;
    clearTimeout(typingTimer.current);
    publishTyping(false);
  }, [publishTyping]);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  /* ---------- sending ---------- */

  const sendMessage = useCallback(
    (text) => {
      const body = String(text || "").trim();
      const chat = activeChatRef.current;

      if (!body || !chat) return false;

      const isGroup = Boolean(chat.is_group);
      const receiver = isGroup ? null : partnerOf(chat);

      // A one-to-one thread with no other member is corrupt; a group
      // needs no single receiver because the server fans it out.
      if (!isGroup && !receiver) return false;

      const messageId = generateId();
      const createdAt = Date.now();

      // Written first, drawn immediately. If the publish below fails
      // the message is still here to retry rather than lost.
      saveMessage({
        messageId,
        chatId: chat.chat_id,
        senderPhone: myPhone,
        receiverPhone: isGroup ? chat.chat_id : receiver,
        message: body,
        status: "SENDING",
        createdAt,
      });

      setMessages(loadPage(chat.chat_id));
      refreshChats();
      stopTyping();

      if (!stomp.current?.connected) return true;

      try {
        stomp.current.publish({
          destination: "/app/chat.send",
          body: JSON.stringify({
            messageId,
            sender: myPhone,
            receiver,
            payload: body,
            timeStamp: createdAt,
            groupId: isGroup ? chat.chat_id : null,
            senderName: myNameRef.current,
          }),
        });
      } catch (error) {
        console.error("Couldn't publish message:", error);
        updateMessageStatus(messageId, "FAILED");
        setMessages(loadPage(chat.chat_id));
      }

      return true;
    },
    [myPhone, partnerOf, loadPage, refreshChats, stopTyping]
  );

  const retryMessage = useCallback(
    (message) => {
      if (!stomp.current?.connected) return;

      updateMessageStatus(message.message_id, "SENDING");
      setMessages(loadPage(message.chat_id));

      const chat = getChatById(message.chat_id);
      const isGroup = Boolean(chat?.is_group);

      stomp.current.publish({
        destination: "/app/chat.send",
        body: JSON.stringify({
          messageId: message.message_id,
          sender: message.sender_phone,
          receiver: isGroup ? null : message.receiver_phone,
          payload: message.message,
          timeStamp: message.created_at,
          groupId: isGroup ? message.chat_id : null,
          senderName: myNameRef.current,
        }),
      });
    },
    [loadPage]
  );

  /* ---------- chat management (all local to this device) ---------- */

  const removeChat = useCallback(
    (chatId) => {
      deleteChat(chatId);
      if (activeChatRef.current?.chat_id === chatId) {
        setActiveChatId(null);
        setMessages([]);
      }
      refreshChats();
    },
    [refreshChats]
  );

  const emptyChat = useCallback(
    (chatId) => {
      clearChatMessages(chatId);
      if (activeChatRef.current?.chat_id === chatId) {
        setMessages([]);
      }
      refreshChats();
    },
    [refreshChats]
  );

  const removeMessage = useCallback(
    (messageId) => {
      const chat = activeChatRef.current;
      deleteMessage(messageId);
      if (chat) setMessages(loadPage(chat.chat_id));
      refreshChats();
    },
    [loadPage, refreshChats]
  );

  const toggleFlag = useCallback(
    (chatId, flag, value) => {
      setChatFlag(chatId, flag, value);
      refreshChats();
    },
    [refreshChats]
  );

  /* ---------- unread badge in the browser tab ---------- */

  useEffect(() => {
    if (!dbReady) return;

    const total = getTotalUnread();
    document.title = total > 0 ? `(${total}) Halo` : "Halo · Private messaging";
  }, [chats, dbReady]);

  return {
    // state
    dbReady,
    storageAvailable,
    storagePersists,
    chats,
    activeChat,
    activeChatId,
    messages,
    connected,
    typingByChat,
    presence,
    groupsById,
    hasMoreHistory,
    myPhone,
    myName,

    // actions
    openChat,
    startChatWith,
    sendMessage,
    retryMessage,
    loadOlder,
    notifyTyping,
    stopTyping,
    removeChat,
    emptyChat,
    removeMessage,
    toggleFlag,
    refreshChats,
    syncGroups,
    partnerOf,

    // Shared so sealed chat can publish over the same connection
    // instead of opening a second socket.
    stompRef: stomp,
  };
}
