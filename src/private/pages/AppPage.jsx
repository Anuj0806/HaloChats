import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";

import AppFrame from "@/components/halo/AppFrame";
import { useToast } from "@/components/halo/toastStore";
import { useAuth } from "@/auth/authStore";

import { NavRail, TabBar } from "../components/NavRail";
import ChatListPane from "../components/panes/ChatListPane";
import ChatPane from "../components/panes/ChatPane";
import ContactsPane from "../components/panes/ContactsPane";
import PrivateRoomsPane from "../components/panes/PrivateRoomsPane";
import PrivateRoomPinGate from "../components/PrivateRoomPinGate";
import ProfilePane from "../components/panes/ProfilePane";
import SettingsPane from "../components/panes/SettingsPane";
import { ChangePasswordModal, ConfirmModal } from "../components/modals/AccountModals";
import NewGroupModal, { AddMembersModal } from "../components/modals/GroupModals";
import GroupInfoModal from "../components/modals/GroupInfoModal";

import useChatEngine from "../hooks/useChatEngine";
import useSealedChat from "../hooks/useSealedChat";
import SealedChatPane, { SafetyNumberPanel } from "../components/panes/SealedChatPane";
import Modal from "@/components/halo/Modal";
import ServerStatusBanner from "@/components/halo/ServerStatusBanner";
import useServerStatus from "@/lib/useServerStatus";
import useMediaQuery from "../hooks/useMediaQuery";
import { clearDatabase, exportDatabaseFile, importDatabaseFile } from "@/database";
import { truncate } from "@/lib/format";
import { loadPrefs, savePrefs } from "@/lib/prefs";

/* ============================================================
   APP SHELL

   Owns navigation between the four destinations, the modals, and
   the browser-level concerns (notifications, sound). All messaging
   state lives in useChatEngine; this file only wires it to panes.
============================================================ */

export default function AppPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { session, signOut, updateSession } = useAuth();

  const wide = useMediaQuery("(min-width: 900px)");

  const [tab, setTab] = useState("chats");
  const serverStatus = useServerStatus();
  const [prefs, setPrefs] = useState(loadPrefs);
  const [confirm, setConfirm] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showSafetyNumber, setShowSafetyNumber] = useState(false);

  // In-memory only, on purpose - stays true for the rest of this
  // session so switching tabs doesn't re-prompt, but resets the
  // instant AppPage unmounts (sign-out, session expiry), so a fresh
  // sign-in always has to unlock again.
  const [privateRoomUnlocked, setPrivateRoomUnlocked] = useState(false);

  const restoreInput = useRef(null);

  /* ---------- notifications ---------- */

  const [notifyPermission, setNotifyPermission] = useState(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission
  );

  useEffect(() => {
    if (!prefs.notifications || notifyPermission !== "default") return;

    Notification.requestPermission()
      .then(setNotifyPermission)
      .catch(() => setNotifyPermission("denied"));
  }, [prefs.notifications, notifyPermission]);

  /**
   * A short synthesised blip via WebAudio. An <audio> tag would need
   * a binary asset committed to the repo for a 120ms sound.
   */
  const playBlip = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const context = new AudioCtx();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.09);

      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.24);

      oscillator.onended = () => context.close();
    } catch {
      // Audio is a nicety - never let it break message delivery.
    }
  }, []);

  const handleIncoming = useCallback(
    ({ sender, text }) => {
      if (prefs.sounds) playBlip();

      // Only notify when the tab isn't the thing the person is looking
      // at. A notification for a message they can already see is noise.
      if (
        prefs.notifications &&
        notifyPermission === "granted" &&
        document.visibilityState !== "visible"
      ) {
        try {
          new Notification(sender, { body: truncate(text, 120), tag: "halo-message" });
        } catch {
          // Some browsers block constructing Notification outside a
          // service worker; there's nothing to recover from.
        }
      }
    },
    [prefs.notifications, prefs.sounds, notifyPermission, playBlip]
  );

  // useSealedChat needs the engine's socket; the engine needs the
  // sealed hook's frame handler. A ref created here and passed to both
  // breaks the circular dependency without an extra connection.
  const sealedFrameRef = useRef(null);

  const engine = useChatEngine({
    myPhone: session?.phone || "",
    myName: session?.name || "",
    onIncoming: handleIncoming,
    sendReadReceipts: prefs.readReceipts,
    sealedFrameRef,
  });

  const {
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
    openChat,
    startChatWith,
    sendMessage,
    retryMessage,
    loadOlder,
    notifyTyping,
    removeChat,
    emptyChat,
    removeMessage,
    toggleFlag,
    refreshChats,
    syncGroups,
    partnerOf,
  } = engine;

  const sealed = useSealedChat({
    myPhone: session?.phone || "",
    myName: session?.name || "",
    stompRef: engine.stompRef,
    connected,
    onNotice: (message, tone) => toast.show(message, tone),
    frameRef: sealedFrameRef,
  });

  const startSealedChat = useCallback(
    async (person) => {
      const result = await sealed.openSealedChat(person);

      if (!result.ok) {
        toast.show(result.reason, "error");
        return;
      }

      // Private Room is its own destination, not a variant of Chats -
      // opening one from the Contacts shortcut should land there.
      setTab("private");
    },
    [sealed, toast]
  );

  const activeGroup = activeChat?.is_group ? groupsById[activeChat.chat_id] : null;

  /** phone -> display name, for the sender labels above group bubbles. */
  const memberNames = useMemo(() => {
    if (!activeGroup) return {};

    return Object.fromEntries(
      (activeGroup.members || []).map((member) => [member.phone, member.name])
    );
  }, [activeGroup]);

  /**
   * Who is typing in the open group. typingByChat is keyed by chat, so
   * for a group it only says "somebody" - the names come from matching
   * that against the roster.
   */
  const typingMembers = useMemo(() => {
    if (!activeChat?.is_group || !typingByChat[activeChat.chat_id]) return [];

    const who = typingByChat[activeChat.chat_id];
    if (typeof who !== "string") return [];

    return [memberNames[who] || who];
  }, [activeChat, typingByChat, memberNames]);

  const contactsForGroup = useMemo(
    () =>
      chats
        .filter((chat) => !chat.is_group && !chat.archived)
        .map((chat) => {
          const phone = chat.members?.find((member) => member !== session.phone) || "";
          return { phone, name: chat.name || phone };
        })
        .filter((person) => person.phone),
    [chats, session.phone]
  );

  const unreadTotal = useMemo(
    () => chats.filter((c) => !c.archived).reduce((total, c) => total + (c.unread_count || 0), 0),
    [chats]
  );



  /* ---------- navigation ---------- */

  const goTo = (destination) => {
    setTab(destination);
    // On a phone the list and the conversation are the same column,
    // so leaving the chats tab has to close the open conversation or
    // coming back would land in it again.
    if (!wide && destination !== "chats") openChat(null);
  };

  const handleStartChat = (person) => {
    startChatWith(person);
    setTab("chats");
  };

  const handleSignOut = () => {
    setConfirm({
      title: "Sign out?",
      description:
        "Your chats stay on this device and will be here when you sign back in on this browser.",
      confirmLabel: "Sign out",
      action: () => {
        signOut();
        navigate("/", { replace: true });
      },
    });
  };

  /* ---------- backup ---------- */

  const handleBackup = async () => {
    try {
      await exportDatabaseFile();
      toast.show("Backup downloaded");
    } catch (error) {
      toast.show(error.message || "Backup failed", "error");
    }
  };

  const handleRestoreFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setConfirm({
      title: "Restore this backup?",
      description: `"${file.name}" will replace every chat currently on this device. This can't be undone.`,
      confirmLabel: "Restore",
      action: async () => {
        try {
          // importDatabaseFile validates the file's schema before it
          // touches anything, so a bad file leaves the current data intact.
          await importDatabaseFile(file);
          refreshChats();
          openChat(null);
          toast.show("Chats restored");
        } catch (error) {
          toast.show(error.message || "That file couldn't be restored", "error");
        }
      },
    });
  };

  const handleEraseLocal = () => {
    setConfirm({
      title: "Erase chats on this device?",
      description:
        "Every message and conversation stored in this browser is removed. Your account and the other person's copy are untouched.",
      confirmLabel: "Erase",
      action: async () => {
        try {
          await clearDatabase();
          refreshChats();
          openChat(null);
          toast.show("Local chats erased");
        } catch (error) {
          toast.show(error.message || "Couldn't erase local chats", "error");
        }
      },
    });
  };

  /* ---------- per-chat destructive actions ---------- */

  const confirmDeleteChat = (chat) => {
    setConfirm({
      title: `Delete this conversation?`,
      description: `Your copy of the chat with ${
        chat.name || partnerOf(chat)
      } is removed from this device. They keep theirs.`,
      confirmLabel: "Delete",
      action: () => {
        removeChat(chat.chat_id);
        toast.show("Conversation deleted");
      },
    });
  };

  const confirmClearChat = (chat) => {
    setConfirm({
      title: "Clear these messages?",
      description: "The conversation stays in your list, but its messages are removed from this device.",
      confirmLabel: "Clear",
      action: () => {
        emptyChat(chat.chat_id);
        toast.show("Messages cleared");
      },
    });
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.show("Copied");
    } catch {
      toast.show("Your browser blocked copying", "error");
    }
  };

  /* ---------- loading ---------- */

  if (!dbReady) {
    return (
      <AppFrame>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            background: "var(--ink)",
          }}
        >
          <div
            className="animate-breathe"
            style={{
              width: 62,
              height: 62,
              borderRadius: 20,
              background: "linear-gradient(150deg, var(--accent-light), var(--accent-deep))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 20px 40px -14px rgba(196,106,70,.7)",
            }}
          >
            <Loader2 size={26} className="animate-spin-slow" color="#FCF7EF" />
          </div>

          <p
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: "rgba(246,242,234,.5)",
            }}
          >
            opening your chats
          </p>
        </div>
      </AppFrame>
    );
  }

  /* ---------- panes ---------- */

  const partnerPhone = activeChat ? partnerOf(activeChat) : "";

  const chatPane = (
    <ChatPane
      /* Keying on the conversation makes React remount this subtree
         when you switch chats, which resets the draft, emoji picker
         and in-chat search without an effect to keep them in sync. */
      key={activeChatId || "empty"}
      chat={activeChat}
      messages={messages}
      myPhone={session.phone}
      group={activeGroup}
      memberNames={memberNames}
      typingMembers={typingMembers}
      onOpenGroupInfo={() => setShowGroupInfo(true)}
      online={!!presence[partnerPhone]}
      typing={!!typingByChat[activeChatId]}
      connected={connected}
      hasMoreHistory={hasMoreHistory}
      wide={wide}
      onBack={() => openChat(null)}
      onSend={sendMessage}
      onRetry={retryMessage}
      onLoadOlder={loadOlder}
      onTyping={notifyTyping}
      onDeleteMessage={removeMessage}
      onClearChat={confirmClearChat}
      onCopy={handleCopy}
      onOpenContacts={() => goTo("contacts")}
    />
  );

  const listPane = (
    <ChatListPane
      chats={chats}
      activeChatId={activeChatId}
      presence={presence}
      typingByChat={typingByChat}
      connected={connected}
      storageAvailable={storageAvailable}
      storagePersists={storagePersists}
      myPhone={session.phone}
      wide={wide}
      onOpenChat={openChat}
      onNewChat={() => goTo("contacts")}
      onNewGroup={() => setShowNewGroup(true)}
      onToggleFlag={toggleFlag}
      onDeleteChat={confirmDeleteChat}
    />
  );

  const sealedPane = sealed.activeSession ? (
    <SealedChatPane
      session={sealed.activeSession}
      connected={connected}
      wide={wide}
      onBack={() => sealed.setActivePhone(null)}
      onSend={sealed.sendSealed}
      onTyping={sealed.notifySealedTyping}
      onVerify={() => setShowSafetyNumber(true)}
      onClose={() =>
        setConfirm({
          title: "End this private room?",
          description:
            "The room is erased on both devices immediately. It was never saved anywhere, so there's nothing to recover.",
          confirmLabel: "End room",
          action: () => sealed.closeSealedChat(sealed.activePhone),
        })
      }
    />
  ) : null;

  const privateRoomListPane = (
    <PrivateRoomsPane
      sealed={sealed}
      myPhone={session.phone}
      wide={wide}
      onOpenRoom={(phone) => sealed.setActivePhone(phone)}
      onBack={() => goTo("chats")}
    />
  );

  let body;

  if (tab === "private") {
    if (!privateRoomUnlocked) {
      // The PIN gate replaces the entire tab, not just a corner of it -
      // there's nothing in Private Room worth showing a glimpse of
      // before it's unlocked.
      body = <PrivateRoomPinGate onUnlock={() => setPrivateRoomUnlocked(true)} />;
    } else if (wide) {
      // Same list-then-conversation pattern as Chats: both columns on a
      // wide screen, one column at a time on a phone.
      body = (
        <>
          {privateRoomListPane}
          {sealedPane || (
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--canvas)",
                padding: 40,
                textAlign: "center",
              }}
            >
              <div>
                <Lock size={26} strokeWidth={1.5} style={{ color: "var(--text-ghost)", margin: "0 auto 14px" }} />
                <p style={{ fontSize: 14, color: "var(--text-muted)", maxWidth: "30ch" }}>
                  Search for someone on the left to start an encrypted room. Nothing here is saved.
                </p>
              </div>
            </div>
          )}
        </>
      );
    } else {
      body = sealedPane || privateRoomListPane;
    }
  } else if (tab === "contacts") {
    body = (
      <ContactsPane
        chats={chats}
        myPhone={session.phone}
        wide={wide}
        onStartChat={handleStartChat}
        onStartSealedChat={startSealedChat}
        sealedSupported={sealed.supported}
        onBack={() => goTo("chats")}
      />
    );
  } else if (tab === "profile") {
    body = (
      <ProfilePane
        session={session}
        chats={chats}
        wide={wide}
        onSessionChange={updateSession}
        onToast={(message) => toast.show(message)}
        onBack={() => goTo("chats")}
      />
    );
  } else if (tab === "settings") {
    body = (
      <SettingsPane
        prefs={prefs}
        wide={wide}
        notificationsBlocked={notifyPermission === "denied" || notifyPermission === "unsupported"}
        onPrefsChange={(next) => {
          setPrefs(next);
          savePrefs(next);
        }}
        onBack={() => goTo("chats")}
        onChangePassword={() => setShowPasswordModal(true)}
        onBackup={handleBackup}
        onRestore={() => restoreInput.current?.click()}
        onEraseLocal={handleEraseLocal}
        onSignOut={handleSignOut}
      />
    );
  } else if (wide) {
    body = (
      <>
        {listPane}
        {chatPane}
      </>
    );
  } else {
    // Phone: one column at a time.
    body = activeChat ? chatPane : listPane;
  }

  return (
    <AppFrame>
      {wide && (
        <NavRail current={tab} onNavigate={goTo} onSignOut={handleSignOut} unread={unreadTotal} />
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {serverStatus.status === "offline" && (
          <div style={{ padding: "14px 20px 0" }}>
            <ServerStatusBanner status={serverStatus.status} onRetry={serverStatus.recheck} />
          </div>
        )}

        <div style={{ flex: 1, display: "flex", minWidth: 0, minHeight: 0 }}>{body}</div>

        {/* The tab bar is hidden while a conversation is open - either
            an ordinary chat or an open private room - so the composer
            sits at the bottom of the screen where it belongs. */}
        {!wide && !activeChat && !(tab === "private" && sealed.activeSession) && (
          <TabBar current={tab} onNavigate={goTo} unread={unreadTotal} />
        )}
      </div>

      <input
        ref={restoreInput}
        type="file"
        accept=".chatdb,.db,.sqlite"
        onChange={handleRestoreFile}
        style={{ display: "none" }}
        aria-hidden="true"
        tabIndex={-1}
      />

      {showNewGroup && (
        <NewGroupModal
          open
          onCreated={async (group) => {
            await syncGroups();
            openChat(group.groupId);
            setTab("chats");
          }}
          onClose={() => setShowNewGroup(false)}
          contacts={contactsForGroup}
          myPhone={session.phone}
          onToast={(message) => toast.show(message)}
        />
      )}

      <GroupInfoModal
        open={showGroupInfo}
        group={activeGroup}
        myPhone={session.phone}
        onClose={() => setShowGroupInfo(false)}
        onToast={(message, tone) => toast.show(message, tone)}
        onConfirm={setConfirm}
        onAddPeople={() => {
          setShowGroupInfo(false);
          setShowAddMembers(true);
        }}
        onUpdated={() => syncGroups()}
        onLeft={() => {
          syncGroups();
          openChat(null);
        }}
      />

      {showAddMembers && activeGroup && (
        <AddMembersModal
          open
          groupId={activeGroup.groupId}
          existingPhones={(activeGroup.members || []).map((member) => member.phone)}
          myPhone={session.phone}
          onClose={() => setShowAddMembers(false)}
          onToast={(message, tone) => toast.show(message, tone)}
          onUpdated={() => syncGroups()}
        />
      )}

      {showSafetyNumber && sealed.activeSession && (
        <Modal
          open
          width={460}
          title="Safety number"
          onClose={() => setShowSafetyNumber(false)}
        >
          <SafetyNumberPanel
            session={sealed.activeSession}
            onVerify={(verified) => sealed.markVerified(sealed.activePhone, verified)}
          />
        </Modal>
      )}

      <ChangePasswordModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onDone={(message) => toast.show(message)}
      />

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const action = confirm?.action;
          setConfirm(null);
          action?.();
        }}
      />
    </AppFrame>
  );
}
