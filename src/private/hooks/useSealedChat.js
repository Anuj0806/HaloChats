import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { deriveConversationKey, isSealedChatSupported, openMessage, sealMessage } from "@/lib/e2ee";
import { ensureIdentityPublished, fetchPeerKey } from "../services/keyService";
import { generateId } from "@/lib/utils";
import { readError } from "@/lib/format";

/* ============================================================
   SEALED CHAT

   Deliberately separate from useChatEngine, and deliberately not
   backed by the local database.

   A sealed conversation lives in React state for exactly as long as
   the tab is open. Nothing is written to SQLite, nothing is written
   to the server, and closing the chat or refreshing the page
   destroys it. That is the feature, not a limitation - persisting
   "messages that leave no trace" would make the name a lie.

   The cost is real and the UI says so plainly: no history, no
   delivery to someone who is offline, no second device.
============================================================ */

export default function useSealedChat({
  myPhone,
  myName,
  stompRef,
  connected,
  onNotice,
  /**
   * Owned by the caller and shared with useChatEngine, whose STOMP
   * subscriptions invoke it. The engine needs this handler and this
   * hook needs the engine's socket, so one of the two has to be passed
   * in rather than created here.
   */
  frameRef,
}) {
  const supported = isSealedChatSupported();

  const [identity, setIdentity] = useState(null);
  const [identityError, setIdentityError] = useState("");
  const [sessions, setSessions] = useState({});
  const [activePhone, setActivePhone] = useState(null);

  /**
   * Derived AES keys, held outside React state on purpose: CryptoKey
   * objects aren't serialisable, and putting them in state would
   * invite them into a devtools dump or a state snapshot.
   */
  const conversationKeys = useRef(new Map());
  const onNoticeRef = useRef(onNotice);

  useEffect(() => {
    onNoticeRef.current = onNotice;
  }, [onNotice]);

  /* ---------- identity ---------- */

  const publishIdentity = useCallback(() => {
    if (!supported || !myPhone) return undefined;

    let cancelled = false;

    ensureIdentityPublished()
      .then((result) => {
        if (cancelled) return;
        setIdentity(result);
        // Clear a stale error only once a retry actually succeeds -
        // clearing it eagerly at the start would flash the message
        // away and then immediately back if the retry fails too.
        setIdentityError("");
      })
      .catch((error) => {
        if (cancelled) return;

        console.error("Couldn't publish sealed-chat key:", error);

        // A 401 here means the session itself is gone - api.js's
        // response interceptor already fires the app-wide sign-out
        // redirect for that, so there's nothing further to show
        // here; the person is about to land on the login screen.
        if (error.response?.status === 401) return;

        setIdentityError(
          readError(
            error,
            "Sealed chat couldn't be set up. Your key didn't reach the server, so nobody can start one with you."
          )
        );
      });

    return () => {
      cancelled = true;
    };
  }, [supported, myPhone]);

  useEffect(() => publishIdentity(), [publishIdentity]);

  /* ---------- sessions ---------- */

  const activeSession = activePhone ? sessions[activePhone] || null : null;

  const patchSession = useCallback((phone, patch) => {
    setSessions((current) => {
      const existing = current[phone];
      if (!existing) return current;

      return { ...current, [phone]: { ...existing, ...patch } };
    });
  }, []);

  const appendMessage = useCallback((phone, message) => {
    setSessions((current) => {
      const existing = current[phone];
      if (!existing) return current;

      return {
        ...current,
        [phone]: { ...existing, messages: [...existing.messages, message] },
      };
    });
  }, []);

  /**
   * Opens a sealed conversation: fetches their key, derives the shared
   * secret, and creates an empty in-memory session.
   */
  const openSealedChat = useCallback(
    async (peer) => {
      if (!supported) {
        return { ok: false, reason: "Sealed chat needs a secure connection (https or localhost)." };
      }

      if (!identity) {
        return { ok: false, reason: "Your encryption key isn't ready yet. Try again in a moment." };
      }

      const phone = peer.phone;

      if (sessions[phone]) {
        setActivePhone(phone);
        return { ok: true };
      }

      const peerKey = await fetchPeerKey(phone);

      if (!peerKey) {
        return {
          ok: false,
          reason: `${peer.name || phone} hasn't opened Halo since sealed chat was added, so there's no key to encrypt to yet.`,
        };
      }

      try {
        const key = await deriveConversationKey(identity.privateKey, peerKey.publicKey);
        conversationKeys.current.set(phone, key);

        setSessions((current) => ({
          ...current,
          [phone]: {
            phone,
            name: peer.name || phone,
            messages: [],
            peerFingerprint: peerKey.fingerprint,
            myFingerprint: identity.fingerprint,
            // The server's stored fingerprint disagreeing with the key
            // it served is a genuine red flag, not a glitch.
            keyConsistent: peerKey.consistent,
            verified: false,
            startedAt: Date.now(),
          },
        }));

        setActivePhone(phone);

        return { ok: true };
      } catch (error) {
        console.error("Couldn't derive a sealed key:", error);
        return { ok: false, reason: "Couldn't set up encryption with that person." };
      }
    },
    [supported, identity, sessions]
  );

  /** Ends the session and destroys the key. Nothing is recoverable. */
  const closeSealedChat = useCallback(
    (phone, { notifyPeer = true } = {}) => {
      conversationKeys.current.delete(phone);

      setSessions((current) => {
        const next = { ...current };
        delete next[phone];
        return next;
      });

      setActivePhone((current) => (current === phone ? null : current));

      if (notifyPeer && stompRef.current?.connected) {
        stompRef.current.publish({
          destination: "/app/sealed.close",
          body: JSON.stringify({ receiver: phone }),
        });
      }
    },
    [stompRef]
  );

  const markVerified = useCallback(
    (phone, verified) => patchSession(phone, { verified }),
    [patchSession]
  );

  /* ---------- sending ---------- */

  const sendSealed = useCallback(
    async (text) => {
      const body = String(text || "").trim();
      const phone = activePhone;

      if (!body || !phone) return false;

      const key = conversationKeys.current.get(phone);

      if (!key) {
        onNoticeRef.current?.("That sealed conversation has ended.", "error");
        return false;
      }

      if (!stompRef.current?.connected) {
        onNoticeRef.current?.("You're offline. Sealed messages can't be queued.", "error");
        return false;
      }

      const messageId = generateId();

      try {
        const { ciphertext, iv } = await sealMessage(key, body);

        stompRef.current.publish({
          destination: "/app/sealed.send",
          body: JSON.stringify({
            messageId,
            receiver: phone,
            ciphertext,
            iv,
            timeStamp: Date.now(),
            senderFingerprint: identity?.fingerprint,
          }),
        });

        // Held in memory only. The plaintext is kept so the sender can
        // see what they wrote; it dies with the session.
        appendMessage(phone, {
          messageId,
          mine: true,
          text: body,
          at: Date.now(),
          status: "SENDING",
        });

        return true;
      } catch (error) {
        console.error("Couldn't seal message:", error);
        onNoticeRef.current?.("That message couldn't be encrypted and wasn't sent.", "error");
        return false;
      }
    },
    [activePhone, stompRef, identity, appendMessage]
  );

  const notifySealedTyping = useCallback(
    (typing) => {
      if (!activePhone || !stompRef.current?.connected) return;

      stompRef.current.publish({
        destination: "/app/sealed.typing",
        body: JSON.stringify({ receiver: activePhone, typing }),
      });
    },
    [activePhone, stompRef]
  );

  /* ---------- receiving ---------- */

  /**
   * Wired up by the engine's STOMP subscription. Exposed as a stable
   * ref so the socket effect doesn't need to re-subscribe whenever a
   * session changes.
   */
  const handleSealedFrame = useCallback(
    async (kind, payload) => {
      if (kind === "receive") {
        const phone = payload.sender;
        const key = conversationKeys.current.get(phone);

        if (!key) {
          // They opened a sealed chat with us but we have no session -
          // usually because we refreshed. Nothing to decrypt with.
          onNoticeRef.current?.(
            `${phone} sent a sealed message, but there's no open session to read it in.`,
            "error"
          );
          return;
        }

        try {
          const text = await openMessage(key, payload.ciphertext, payload.iv);

          appendMessage(phone, {
            messageId: payload.messageId,
            mine: false,
            text,
            at: payload.timeStamp || Date.now(),
            status: "DELIVERED",
          });
        } catch {
          appendMessage(phone, {
            messageId: payload.messageId || generateId(),
            mine: false,
            text: null,
            failed: true,
            at: Date.now(),
            status: "FAILED",
          });
        }

        return;
      }

      if (kind === "ack") {
        setSessions((current) => {
          const session = Object.values(current).find((s) =>
            s.messages.some((m) => m.messageId === payload.messageId)
          );
          if (!session) return current;

          return {
            ...current,
            [session.phone]: {
              ...session,
              messages: session.messages.map((m) =>
                m.messageId === payload.messageId ? { ...m, status: "DELIVERED" } : m
              ),
            },
          };
        });
        return;
      }

      if (kind === "undelivered") {
        setSessions((current) => {
          const session = current[payload.receiver];
          if (!session) return current;

          return {
            ...current,
            [payload.receiver]: {
              ...session,
              messages: session.messages.map((m) =>
                m.messageId === payload.messageId ? { ...m, status: "UNDELIVERED" } : m
              ),
            },
          };
        });

        onNoticeRef.current?.(
          "They're offline. Sealed messages aren't stored, so that one didn't arrive.",
          "error"
        );
        return;
      }

      if (kind === "typing") {
        patchSession(payload.sender, { peerTyping: Boolean(payload.typing) });
        return;
      }

      if (kind === "closed") {
        closeSealedChat(payload.sender, { notifyPeer: false });
        onNoticeRef.current?.("The other person ended the sealed conversation.");
      }
    },
    [appendMessage, patchSession, closeSealedChat]
  );

  useEffect(() => {
    if (frameRef) frameRef.current = handleSealedFrame;
  }, [frameRef, handleSealedFrame]);

  /* ---------- teardown ---------- */

  useEffect(() => {
    // Closing the tab must not leave keys sitting in memory for the
    // life of the process.
    const keys = conversationKeys.current;

    return () => {
      keys.clear();
    };
  }, []);

  const sessionList = useMemo(() => Object.values(sessions), [sessions]);

  return {
    supported,
    identity,
    identityError,
    sessions: sessionList,
    activeSession,
    activePhone,
    connected,
    myName,

    openSealedChat,
    closeSealedChat,
    setActivePhone,
    markVerified,
    sendSealed,
    notifySealedTyping,
    retryIdentity: publishIdentity,
  };
}
