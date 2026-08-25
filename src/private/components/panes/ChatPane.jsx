import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ChevronLeft,
  Check,
  CheckCheck,
  Clock,
  Copy,
  Eraser,
  MessageCircle,
  MoreVertical,
  RefreshCw,
  Search,
  Send,
  Smile,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";

import Avatar from "@/components/halo/Avatar";
import { formatClock, formatDayDivider, sameDay } from "@/lib/format";
import { avatarColors } from "@/lib/avatar";

const EMOJI_GROUPS = [
  { label: "Smileys", items: ["😀", "😄", "😊", "🙂", "😉", "😍", "🥰", "😘", "😎", "🤔", "😌", "🙃"] },
  { label: "Gestures", items: ["👍", "👎", "👏", "🙏", "🤝", "💪", "👋", "🤞", "✌️", "🫶", "👌", "🤙"] },
  { label: "Hearts", items: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "💘", "💖", "✨"] },
  { label: "Reactions", items: ["🔥", "🎉", "💯", "🚀", "⭐", "😂", "🤣", "😭", "😢", "😡", "🥳", "🙌"] },
];

/**
 * Delivery state for an outgoing message. Read is the only state
 * that gets colour - the rest are deliberately quiet, because a
 * wall of green ticks turns into visual noise fast.
 */
function Tick({ status }) {
  const value = String(status || "").toLowerCase();

  if (value === "read") {
    return <CheckCheck size={14} strokeWidth={2} style={{ color: "var(--ok)" }} aria-label="Read" />;
  }
  if (value === "delivered") {
    return (
      <CheckCheck size={14} strokeWidth={2} style={{ color: "var(--text-ghost)" }} aria-label="Delivered" />
    );
  }
  if (value === "sent") {
    return <Check size={14} strokeWidth={2} style={{ color: "var(--text-ghost)" }} aria-label="Sent" />;
  }
  if (value === "sending") {
    return <Clock size={12} strokeWidth={2} style={{ color: "var(--text-ghost)" }} aria-label="Sending" />;
  }

  return null;
}

export default function ChatPane({
  chat,
  messages,
  myPhone,
  group,
  memberNames = {},
  typingMembers = [],
  onOpenGroupInfo,
  online,
  typing,
  connected,
  hasMoreHistory,
  onBack,
  onSend,
  onRetry,
  onLoadOlder,
  onTyping,
  onDeleteMessage,
  onClearChat,
  onCopy,
  onOpenContacts,
  wide,
}) {
  const [draft, setDraft] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [atBottom, setAtBottom] = useState(true);

  const scroller = useRef(null);
  const composer = useRef(null);
  const lastChatId = useRef(null);
  const lastCount = useRef(0);

  const isGroup = Boolean(chat?.is_group);
  const partner = chat?.members?.find((member) => member !== myPhone) || "";
  const memberCount = group?.members?.length ?? chat?.members?.length ?? 0;

  /* ---------- scrolling ---------- */

  const scrollToBottom = (behavior = "auto") => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
  };

  // Jump to the newest message when the conversation changes, and
  // follow new arrivals only if the reader is already at the bottom -
  // yanking someone away from history they're reading is hostile.
  useLayoutEffect(() => {
    if (!chat) return;

    const changedChat = lastChatId.current !== chat.chat_id;
    const grew = messages.length > lastCount.current;

    if (changedChat) {
      scrollToBottom();
    } else if (grew && atBottom) {
      scrollToBottom("smooth");
    }

    lastChatId.current = chat.chat_id;
    lastCount.current = messages.length;
  }, [chat, messages, atBottom]);

  const handleScroll = (event) => {
    const node = event.currentTarget;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    setAtBottom(distance < 80);
  };

  /* ---------- grouping ---------- */

  const visible = useMemo(() => {
    if (!searching || searchTerm.trim().length < 2) return messages;

    const term = searchTerm.trim().toLowerCase();
    return messages.filter((message) => message.message.toLowerCase().includes(term));
  }, [messages, searching, searchTerm]);

  const rendered = useMemo(() => {
    const output = [];

    visible.forEach((message, index) => {
      const previous = visible[index - 1];

      if (!previous || !sameDay(previous.created_at, message.created_at)) {
        output.push({ kind: "day", key: `day-${message.message_id}`, at: message.created_at });
      }

      // Consecutive messages from the same person within two minutes
      // are visually grouped - one avatar, tighter spacing.
      const grouped =
        previous &&
        previous.sender_phone === message.sender_phone &&
        Number(message.created_at) - Number(previous.created_at) < 120000 &&
        sameDay(previous.created_at, message.created_at);

      // In a group, the first message of each run needs a name above
      // it - otherwise a busy thread is unreadable.
      const showSender =
        isGroup && message.sender_phone !== myPhone && !grouped;

      output.push({ kind: "message", key: message.message_id, message, grouped, showSender });
    });

    return output;
  }, [visible, isGroup, myPhone]);

  /* ---------- composing ---------- */

  const submit = () => {
    const text = draft.trim();
    if (!text) return;

    onSend(text);
    setDraft("");
    setShowEmoji(false);
    setAtBottom(true);

    // Reset the auto-grown textarea back to one line.
    if (composer.current) composer.current.style.height = "auto";
    composer.current?.focus();
  };

  const handleDraftChange = (event) => {
    setDraft(event.target.value);
    onTyping();

    const node = event.currentTarget;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 132)}px`;
  };

  /* ---------- empty state ---------- */

  if (!chat) {
    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
          textAlign: "center",
          background: "var(--canvas)",
        }}
      >
        <div
          style={{
            width: 62,
            height: 62,
            borderRadius: 20,
            background: "var(--surface)",
            border: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
            boxShadow: "var(--shadow-lift)",
          }}
        >
          <MessageCircle size={27} strokeWidth={1.5} style={{ color: "var(--text-ghost)" }} />
        </div>

        <h2 className="display" style={{ fontSize: 26 }}>
          Pick a conversation
        </h2>
        <p
          style={{
            marginTop: 8,
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--text-muted)",
            maxWidth: "32ch",
            textWrap: "pretty",
          }}
        >
          Choose someone from the list, or start a new thread from your contacts.
        </p>

        <button
          type="button"
          onClick={onOpenContacts}
          className="halo-btn halo-btn-ink"
          style={{ marginTop: 22, padding: "13px 22px" }}
        >
          Find someone
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--canvas)",
        position: "relative",
      }}
      onClick={() => {
        setShowMenu(false);
        setSelectedMessage(null);
      }}
    >
      {/* ---------- Header ---------- */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 13,
          padding: "15px 20px",
          background: "rgba(252,250,246,.86)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--line)",
          flex: "0 0 auto",
          zIndex: 10,
        }}
      >
        {!wide && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to chats"
            className="icon-btn"
            style={{ width: 36, height: 36, flex: "0 0 auto", color: "var(--text)" }}
          >
            <ChevronLeft size={20} strokeWidth={1.8} />
          </button>
        )}

        <button
          type="button"
          onClick={isGroup ? onOpenGroupInfo : undefined}
          disabled={!isGroup}
          aria-label={isGroup ? "Group info" : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
            flex: 1,
            minWidth: 0,
            border: "none",
            background: "transparent",
            padding: 0,
            textAlign: "left",
            cursor: isGroup ? "pointer" : "default",
          }}
        >
          <Avatar
            name={chat.name || partner}
            seed={isGroup ? chat.chat_id : partner}
            avatarId={chat.avatar_id}
            size={40}
          />

          <span style={{ flex: 1, minWidth: 0 }}>
            <span
              className="truncate-1"
              style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--text)" }}
            >
              {chat.name || partner}
            </span>
            <span
              style={{
                display: "block",
                fontSize: 12.2,
                marginTop: 2,
                color: typing || (!isGroup && online) ? "var(--ok)" : "var(--text-faint)",
              }}
            >
              {isGroup
                ? typingMembers.length > 0
                  ? `${typingMembers.slice(0, 2).join(", ")}${
                      typingMembers.length > 2 ? ` +${typingMembers.length - 2}` : ""
                    } typing…`
                  : `${memberCount} ${memberCount === 1 ? "member" : "members"}`
                : typing
                ? "typing…"
                : online
                ? "Online"
                : connected
                ? "Offline"
                : "Reconnecting…"}
            </span>
          </span>
        </button>

        <div className="flex gap-1.5" style={{ flex: "0 0 auto" }}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSearching((value) => !value);
              setSearchTerm("");
            }}
            aria-label="Search in conversation"
            aria-pressed={searching}
            className="icon-btn"
            style={{ width: 38, height: 38, color: searching ? "var(--accent)" : undefined }}
          >
            <Search size={19} strokeWidth={1.7} />
          </button>

          <div style={{ position: "relative" }}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowMenu((value) => !value);
              }}
              aria-label="Conversation options"
              className="icon-btn"
              style={{ width: 38, height: 38 }}
            >
              <MoreVertical size={19} strokeWidth={1.9} />
            </button>

            {showMenu && (
              <div
                onClick={(event) => event.stopPropagation()}
                className="animate-pop"
                style={{
                  position: "absolute",
                  right: 0,
                  top: 44,
                  zIndex: 40,
                  width: 224,
                  borderRadius: 16,
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  boxShadow: "0 24px 48px -22px rgba(30,27,24,.55)",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onClearChat(chat);
                    setShowMenu(false);
                  }}
                  className="halo-row"
                  style={{ padding: "12px 14px", fontSize: 13.5, fontWeight: 500, gap: 11 }}
                >
                  <Eraser size={16} strokeWidth={1.8} />
                  Clear messages
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------- In-conversation search ---------- */}
      {searching && (
        <div
          className="animate-rise"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 20px",
            borderBottom: "1px solid var(--line)",
            background: "var(--shell)",
            flex: "0 0 auto",
          }}
        >
          <Search size={16} strokeWidth={1.8} style={{ color: "var(--text-faint)" }} />
          <input
            autoFocus
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Find in this conversation"
            aria-label="Find in this conversation"
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              fontSize: 13.5,
              padding: "4px 0",
              color: "var(--text)",
            }}
          />
          <span className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
            {searchTerm.trim().length < 2 ? "type 2+" : `${visible.length} found`}
          </span>
          <button
            type="button"
            onClick={() => {
              setSearching(false);
              setSearchTerm("");
            }}
            aria-label="Close search"
            className="icon-btn"
            style={{ width: 28, height: 28 }}
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* ---------- Messages ---------- */}
      <div
        ref={scroller}
        onScroll={handleScroll}
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "22px 22px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {hasMoreHistory && !searching && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <button
              type="button"
              onClick={onLoadOlder}
              className="halo-btn halo-btn-quiet"
              style={{ padding: "8px 16px", fontSize: 12.5 }}
            >
              Load earlier messages
            </button>
          </div>
        )}

        {rendered.length === 0 && (
          <div style={{ margin: "auto", textAlign: "center", padding: 30 }}>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
              {searching && searchTerm.trim().length >= 2
                ? "No messages match that."
                : "No messages yet. Say hello."}
            </p>
          </div>
        )}

        {rendered.map((entry) => {
          if (entry.kind === "day") {
            return (
              <div
                key={entry.key}
                className="mono"
                style={{
                  alignSelf: "center",
                  margin: "14px 0 10px",
                  padding: "6px 12px",
                  borderRadius: 20,
                  background: "rgba(30,27,24,.05)",
                  fontSize: 10.5,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--text-subtle)",
                }}
              >
                {formatDayDivider(entry.at)}
              </div>
            );
          }

          const message = entry.message;
          const mine = message.sender_phone === myPhone;
          const failed = String(message.status).toUpperCase() === "FAILED";
          const selected = selectedMessage === message.message_id;

          return (
            <div
              key={entry.key}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: mine ? "flex-end" : "flex-start",
                marginTop: entry.grouped ? 2 : 8,
              }}
            >
              {entry.showSender && (
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: avatarColors(message.sender_phone).foreground,
                    marginBottom: 3,
                    paddingLeft: 4,
                  }}
                >
                  {memberNames[message.sender_phone] || message.sender_phone}
                </span>
              )}

              <div
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedMessage(selected ? null : message.message_id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedMessage(selected ? null : message.message_id);
                  }
                }}
                style={{
                  maxWidth: "min(64ch, 76%)",
                  padding: "12px 16px",
                  fontSize: 14.5,
                  lineHeight: 1.55,
                  cursor: "pointer",
                  borderRadius: mine ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
                  background: mine ? "var(--ink)" : "var(--surface)",
                  color: mine ? "var(--on-ink)" : "var(--text)",
                  border: mine ? "none" : "1px solid var(--line)",
                  boxShadow: mine ? "0 10px 22px -16px rgba(30,27,24,.9)" : "none",
                  textWrap: "pretty",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  outline: selected ? "2px solid var(--accent)" : "none",
                  outlineOffset: 2,
                }}
              >
                {message.message}
              </div>

              <div
                className="mono"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 10,
                  color: "var(--text-ghost)",
                  marginTop: 5,
                  padding: "0 4px",
                }}
              >
                {formatClock(message.created_at)}
                {mine && !failed && (
                  <Tick status={message.status} />
                )}

                {mine && failed && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRetry(message);
                    }}
                    disabled={!connected}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      border: "none",
                      background: "transparent",
                      cursor: connected ? "pointer" : "not-allowed",
                      color: "var(--danger-text)",
                      fontSize: 10,
                      padding: 0,
                      fontFamily: "var(--font-body)",
                      fontWeight: 600,
                    }}
                  >
                    <TriangleAlert size={11} strokeWidth={2} />
                    Not sent · <RefreshCw size={10} strokeWidth={2.2} /> retry
                  </button>
                )}
              </div>

              {selected && (
                <div
                  className="animate-pop"
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 4,
                    padding: 4,
                    borderRadius: 12,
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    boxShadow: "var(--shadow-lift)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onCopy(message.message);
                      setSelectedMessage(null);
                    }}
                    className="icon-btn"
                    style={{ padding: "6px 10px", fontSize: 12, gap: 6, fontWeight: 600 }}
                  >
                    <Copy size={13} strokeWidth={1.9} />
                    Copy
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onDeleteMessage(message.message_id);
                      setSelectedMessage(null);
                    }}
                    className="icon-btn"
                    style={{ padding: "6px 10px", fontSize: 12, gap: 6, fontWeight: 600, color: "var(--danger-text)" }}
                  >
                    <Trash2 size={13} strokeWidth={1.9} />
                    Delete for me
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {(typing || typingMembers.length > 0) && !searching && (
          <div
            style={{
              alignSelf: "flex-start",
              display: "flex",
              gap: 5,
              alignItems: "center",
              padding: "14px 16px",
              borderRadius: "18px 18px 18px 6px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              marginTop: 8,
            }}
          >
            <span className="blip-dot" />
            <span className="blip-dot" style={{ animationDelay: ".15s" }} />
            <span className="blip-dot" style={{ animationDelay: ".3s" }} />
          </div>
        )}
      </div>

      {/* ---------- Jump to latest ---------- */}
      {!atBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom("smooth")}
          aria-label="Jump to latest message"
          className="animate-pop"
          style={{
            position: "absolute",
            right: 22,
            bottom: 96,
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "1px solid var(--line)",
            background: "var(--surface)",
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "var(--shadow-lift)",
            zIndex: 20,
          }}
        >
          <ArrowDown size={18} strokeWidth={1.9} />
        </button>
      )}

      {/* ---------- Emoji picker ---------- */}
      {showEmoji && (
        <div
          onClick={(event) => event.stopPropagation()}
          className="animate-pop"
          style={{
            position: "absolute",
            left: 20,
            bottom: 82,
            width: 296,
            maxHeight: 260,
            overflowY: "auto",
            borderRadius: 18,
            border: "1px solid var(--line)",
            background: "var(--surface)",
            boxShadow: "0 26px 50px -24px rgba(30,27,24,.6)",
            padding: 14,
            zIndex: 30,
          }}
        >
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 12 }}>
              <p className="eyebrow" style={{ marginBottom: 8 }}>
                {group.label}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
                {group.items.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setDraft((current) => current + emoji);
                      composer.current?.focus();
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 21,
                      padding: 4,
                      borderRadius: 9,
                      lineHeight: 1,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-sunk)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- Composer ---------- */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          padding: "12px 20px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          borderTop: "1px solid var(--line)",
          background: "var(--shell)",
          flex: "0 0 auto",
        }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setShowEmoji((value) => !value);
          }}
          aria-label="Insert emoji"
          aria-pressed={showEmoji}
          className="icon-btn"
          style={{ width: 40, height: 40, flex: "0 0 auto", color: showEmoji ? "var(--accent)" : undefined }}
        >
          <Smile size={20} strokeWidth={1.7} />
        </button>

        <textarea
          ref={composer}
          rows={1}
          value={draft}
          onChange={handleDraftChange}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter makes a new line - the
            // convention every messaging app shares.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="Write a message"
          aria-label="Message"
          style={{
            flex: 1,
            minWidth: 0,
            resize: "none",
            maxHeight: 132,
            padding: "11px 16px",
            borderRadius: 20,
            border: "1px solid var(--line-field)",
            background: "var(--surface)",
            fontSize: 14.5,
            lineHeight: 1.5,
            color: "var(--text)",
          }}
        />

        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim()}
          aria-label="Send message"
          style={{
            width: 42,
            height: 42,
            flex: "0 0 auto",
            borderRadius: "50%",
            border: "none",
            cursor: draft.trim() ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: draft.trim() ? "var(--accent)" : "var(--surface-sunk)",
            color: draft.trim() ? "#FFF9F3" : "var(--text-ghost)",
            boxShadow: draft.trim() ? "var(--shadow-accent)" : "none",
            transition: "background .16s ease, color .16s ease",
          }}
        >
          <Send size={18} strokeWidth={1.9} />
        </button>
      </div>
    </div>
  );
}
