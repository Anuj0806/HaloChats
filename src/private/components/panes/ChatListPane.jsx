import { useMemo, useState } from "react";
import {
  Archive,
  Users,
  BellOff,
  Check,
  Database,
  CheckCheck,
  Clock,
  MessageCirclePlus,
  Pin,
  Search,
  Trash2,
  TriangleAlert,
  WifiOff,
  X,
} from "lucide-react";

import Avatar from "@/components/halo/Avatar";
import { formatListTime, truncate } from "@/lib/format";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "archived", label: "Archived" },
];

/** The small tick cluster on the newest outgoing message. */
function StatusTick({ status }) {
  const value = String(status || "").toLowerCase();

  if (value === "read") return <CheckCheck size={13} strokeWidth={2} style={{ color: "var(--ok)" }} />;
  if (value === "delivered")
    return <CheckCheck size={13} strokeWidth={2} style={{ color: "var(--text-ghost)" }} />;
  if (value === "sent") return <Check size={13} strokeWidth={2} style={{ color: "var(--text-ghost)" }} />;
  if (value === "sending") return <Clock size={11} strokeWidth={2} style={{ color: "var(--text-ghost)" }} />;
  if (value === "failed")
    return <TriangleAlert size={12} strokeWidth={2} style={{ color: "var(--danger-text)" }} />;

  return null;
}

export default function ChatListPane({
  chats,
  activeChatId,
  presence,
  typingByChat,
  connected,
  storageAvailable = true,
  storagePersists = true,
  myPhone,
  onOpenChat,
  onNewChat,
  onNewGroup,
  onToggleFlag,
  onDeleteChat,
  wide,
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [menuFor, setMenuFor] = useState(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return chats
      .map((chat) => {
        const phone = chat.is_group
          ? ""
          : chat.members?.find((member) => member !== myPhone) || "";

        return {
          ...chat,
          phone,
          displayName: chat.name || phone || "Unknown",
          online: !!presence[phone],
          typing: !!typingByChat[chat.chat_id],
        };
      })
      .filter((chat) => {
        // Archived conversations are hidden from All and Unread. Being
        // archived is the whole point - a muted badge would defeat it.
        if (filter === "archived") return chat.archived;
        if (chat.archived) return false;
        if (filter === "unread") return chat.unread_count > 0;
        return true;
      })
      .filter((chat) => {
        if (!term) return true;
        return (
          chat.displayName.toLowerCase().includes(term) ||
          chat.phone.includes(term) ||
          (chat.last_message || "").toLowerCase().includes(term)
        );
      });
  }, [chats, myPhone, presence, typingByChat, search, filter]);

  const hasAnyChats = chats.length > 0;

  return (
    <div
      style={{
        width: wide ? 372 : "100%",
        flex: wide ? "0 0 auto" : 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--shell)",
        borderRight: wide ? "1px solid var(--line)" : "none",
      }}
      onClick={() => setMenuFor(null)}
    >
      {/* ---------- Header ---------- */}
      <div style={{ padding: "22px 22px 14px", borderBottom: "1px solid var(--line)", flex: "0 0 auto" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="display" style={{ fontSize: 30 }}>
              Chats
            </h1>
            <p className="eyebrow" style={{ marginTop: 2 }}>
              Saved to this device
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onNewGroup}
              title="New group"
              aria-label="Create a new group"
              className="icon-btn icon-btn-outlined"
              style={{ width: 38, height: 38 }}
            >
              <Users size={19} strokeWidth={1.8} />
            </button>

            <button
              type="button"
              onClick={onNewChat}
              title="New chat"
              aria-label="Start a new chat"
              className="icon-btn icon-btn-outlined"
              style={{ width: 38, height: 38 }}
            >
              <MessageCirclePlus size={19} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div
          className="flex items-center gap-2.5"
          style={{
            marginTop: 16,
            padding: "0 13px",
            borderRadius: "var(--r-field)",
            background: "var(--surface-sunk)",
            border: "1px solid var(--line)",
          }}
        >
          <Search size={17} strokeWidth={1.8} style={{ color: "var(--text-faint)", flex: "0 0 auto" }} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search chats and messages"
            aria-label="Search chats"
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              background: "transparent",
              padding: "12px 0",
              fontSize: 14,
              color: "var(--text)",
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", padding: 0 }}
            >
              <X size={15} strokeWidth={2} style={{ color: "var(--text-faint)" }} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-1.5" style={{ marginTop: 12 }}>
          {FILTERS.map((option) => {
            const active = filter === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                aria-pressed={active}
                style={{
                  padding: "6px 13px",
                  borderRadius: 999,
                  border: `1px solid ${active ? "transparent" : "var(--line-strong)"}`,
                  background: active ? "var(--ink)" : "transparent",
                  color: active ? "var(--on-ink)" : "var(--text-muted)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background .16s ease, color .16s ease",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------- Storage warnings ----------
          Lasting conditions, not passing ones, so they get a banner
          that stays rather than a toast that disappears. Shown above
          the reconnect notice because they're the more serious of the
          two: one costs you a delay, the other costs you the record.

          The two cases are genuinely different and must not be
          collapsed. Losing persistence is a "this session only"
          warning; losing the database entirely means history can't be
          read at all. */}
      {!storageAvailable ? (
        <div
          className="halo-alert halo-alert-error"
          style={{ margin: "14px 18px 0", fontSize: 12.8 }}
          role="alert"
        >
          <Database size={17} strokeWidth={1.8} style={{ flex: "0 0 auto", marginTop: 1 }} />
          <span>
            Chat storage failed to start, so past conversations can't be shown. Sending and
            receiving still work for now. Reloading the page usually fixes it.
          </span>
        </div>
      ) : !storagePersists ? (
        <div
          className="halo-alert"
          style={{
            margin: "14px 18px 0",
            fontSize: 12.8,
            background: "var(--surface-sunk)",
            border: "1px solid var(--line-strong)",
            color: "var(--text-muted)",
          }}
          role="status"
        >
          <Database size={17} strokeWidth={1.8} style={{ flex: "0 0 auto", marginTop: 1 }} />
          <span>
            This browser won't let Halo save chats. You can still send and receive, but nothing
            will be here after you close the tab. Private browsing and blocked site data are the
            usual causes.
          </span>
        </div>
      ) : null}

      {/* ---------- Offline notice ---------- */}
      {!connected && (
        <div
          className="halo-alert halo-alert-error animate-rise"
          style={{ margin: "14px 18px 0", fontSize: 12.8 }}
          role="status"
        >
          <WifiOff size={17} strokeWidth={1.8} style={{ flex: "0 0 auto" }} />
          <span>Reconnecting. Anything you send will go out once you're back.</span>
        </div>
      )}

      {/* ---------- List ---------- */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 12px 16px" }}>
        {rows.length === 0 ? (
          <EmptyList
            hasAnyChats={hasAnyChats}
            filtered={Boolean(search) || filter !== "all"}
            onNewChat={onNewChat}
            onClear={() => {
              setSearch("");
              setFilter("all");
            }}
          />
        ) : (
          rows.map((chat) => {
            const active = chat.chat_id === activeChatId;
            const unread = chat.unread_count > 0;

            return (
              <div key={chat.chat_id} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => onOpenChat(chat.chat_id)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenuFor(chat.chat_id);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    gap: 13,
                    alignItems: "center",
                    padding: 12,
                    marginBottom: 2,
                    borderRadius: 16,
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    background: active && wide ? "var(--surface-hover)" : "transparent",
                    transition: "background .14s ease",
                  }}
                  onMouseEnter={(event) => {
                    if (!(active && wide)) event.currentTarget.style.background = "var(--surface-sunk)";
                  }}
                  onMouseLeave={(event) => {
                    if (!(active && wide)) event.currentTarget.style.background = "transparent";
                  }}
                >
                  <Avatar
                    name={chat.displayName}
                    seed={chat.is_group ? chat.chat_id : chat.phone}
                    avatarId={chat.avatar_id}
                    size={46}
                    // Presence is a property of a person, not a group.
                    presence={!chat.is_group && chat.online ? "online" : null}
                  />

                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className="truncate-1"
                        style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}
                      >
                        {chat.displayName}
                      </span>

                      <span
                        className="mono"
                        style={{
                          fontSize: 10.5,
                          flex: "0 0 auto",
                          color: unread ? "var(--accent)" : "var(--text-ghost)",
                        }}
                      >
                        {formatListTime(chat.last_message_time)}
                      </span>
                    </span>

                    <span
                      className="flex items-center justify-between gap-2"
                      style={{ marginTop: 4 }}
                    >
                      <span className="flex items-center gap-1.5 truncate-1" style={{ minWidth: 0 }}>
                        {chat.typing ? (
                          <span style={{ fontSize: 13, color: "var(--ok)", fontWeight: 600 }}>
                            typing…
                          </span>
                        ) : (
                          <>
                            {chat.last_message_sender === myPhone && (
                              <StatusTick status={chat.last_message_status} />
                            )}
                            <span
                              className="truncate-1"
                              style={{
                                fontSize: 13,
                                color: unread ? "var(--text)" : "var(--text-subtle)",
                                fontWeight: unread ? 600 : 400,
                              }}
                            >
                              {chat.last_message ? truncate(chat.last_message, 38) : "No messages yet"}
                            </span>
                          </>
                        )}
                      </span>

                      <span className="flex items-center gap-1.5" style={{ flex: "0 0 auto" }}>
                        {chat.pinned && (
                          <Pin size={12} strokeWidth={2} style={{ color: "var(--text-ghost)" }} />
                        )}
                        {chat.muted && (
                          <BellOff size={12} strokeWidth={2} style={{ color: "var(--text-ghost)" }} />
                        )}
                        {unread && (
                          <span
                            className="mono"
                            style={{
                              minWidth: 19,
                              height: 19,
                              padding: "0 5px",
                              borderRadius: 999,
                              background: "var(--accent)",
                              color: "#FFF9F3",
                              fontSize: 10,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {chat.unread_count > 99 ? "99+" : chat.unread_count}
                          </span>
                        )}
                      </span>
                    </span>
                  </span>
                </button>

                {menuFor === chat.chat_id && (
                  <ChatRowMenu
                    chat={chat}
                    onToggleFlag={onToggleFlag}
                    onDelete={onDeleteChat}
                    onClose={() => setMenuFor(null)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ChatRowMenu({ chat, onToggleFlag, onDelete, onClose }) {
  const items = [
    {
      label: chat.pinned ? "Unpin" : "Pin to top",
      icon: Pin,
      onClick: () => onToggleFlag(chat.chat_id, "pinned", !chat.pinned),
    },
    {
      label: chat.muted ? "Unmute" : "Mute",
      icon: BellOff,
      onClick: () => onToggleFlag(chat.chat_id, "muted", !chat.muted),
    },
    {
      label: chat.archived ? "Unarchive" : "Archive",
      icon: Archive,
      onClick: () => onToggleFlag(chat.chat_id, "archived", !chat.archived),
    },
    {
      label: "Delete on this device",
      icon: Trash2,
      danger: true,
      onClick: () => onDelete(chat),
    },
  ];

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="animate-pop"
      style={{
        position: "absolute",
        right: 12,
        top: 56,
        zIndex: 30,
        width: 210,
        borderRadius: 16,
        border: "1px solid var(--line)",
        background: "var(--surface)",
        boxShadow: "0 24px 48px -22px rgba(30,27,24,.55)",
        overflow: "hidden",
      }}
    >
      {items.map(({ label, icon: Icon, onClick, danger }) => (
        <button
          key={label}
          type="button"
          onClick={() => {
            onClick();
            onClose();
          }}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: "11px 14px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
            fontSize: 13.5,
            fontWeight: 500,
            color: danger ? "var(--danger-text)" : "var(--text)",
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = danger ? "var(--danger-bg)" : "var(--surface-sunk)";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = "transparent";
          }}
        >
          <Icon size={16} strokeWidth={1.8} />
          {label}
        </button>
      ))}
    </div>
  );
}

function EmptyList({ hasAnyChats, filtered, onNewChat, onClear }) {
  return (
    <div style={{ padding: "54px 24px", textAlign: "center" }}>
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 18,
          background: "var(--surface-sunk)",
          border: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
        }}
      >
        <Search size={24} strokeWidth={1.6} style={{ color: "var(--text-ghost)" }} />
      </div>

      <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
        {filtered ? "Nothing here" : hasAnyChats ? "Nothing here" : "No conversations yet"}
      </p>

      <p
        style={{
          marginTop: 6,
          fontSize: 13.5,
          lineHeight: 1.6,
          color: "var(--text-muted)",
          textWrap: "pretty",
        }}
      >
        {filtered
          ? "No conversations match this filter or search."
          : "Find someone by name or phone number to start your first thread."}
      </p>

      <button
        type="button"
        onClick={filtered ? onClear : onNewChat}
        className="halo-btn halo-btn-quiet"
        style={{ marginTop: 18, padding: "11px 18px", fontSize: 13.5 }}
      >
        {filtered ? "Clear filters" : "Find someone"}
      </button>
    </div>
  );
}
