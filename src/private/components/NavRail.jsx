import { LogOut, Lock, MessageCircle, Settings, User, Users } from "lucide-react";

const TABS = [
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "private", label: "Private", icon: Lock },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "profile", label: "Profile", icon: User },
  { id: "settings", label: "Settings", icon: Settings },
];

/** Desktop: a 78px espresso rail down the left edge. */
export function NavRail({ current, onNavigate, onSignOut, unread = 0 }) {
  return (
    <nav
      aria-label="Main"
      style={{
        width: 78,
        flex: "0 0 auto",
        background: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "22px 0",
        gap: 8,
      }}
    >
      <div
        aria-hidden="true"
        className="display"
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          border: "1px solid rgba(246,242,234,.22)",
          background: "rgba(246,242,234,.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 21,
          color: "var(--on-ink)",
          lineHeight: 1,
        }}
      >
        H
      </div>

      <div style={{ width: 22, height: 1, background: "var(--on-ink-faint)", margin: "12px 0 6px" }} />

      {TABS.map(({ id, label, icon: Icon }) => {
        const active = current === id;

        return (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            onClick={() => onNavigate(id)}
            style={{
              position: "relative",
              width: 44,
              height: 44,
              borderRadius: 14,
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: active ? "var(--accent)" : "transparent",
              color: active ? "#FFF9F3" : "rgba(246,242,234,.45)",
              transition: "background .16s ease, color .16s ease",
            }}
          >
            <Icon size={21} strokeWidth={1.7} />

            {id === "chats" && unread > 0 && (
              <span
                className="mono"
                aria-label={`${unread} unread`}
                style={{
                  position: "absolute",
                  top: 5,
                  right: 5,
                  minWidth: 17,
                  height: 17,
                  padding: "0 4px",
                  borderRadius: 999,
                  background: active ? "#FFF9F3" : "var(--accent)",
                  color: active ? "var(--accent)" : "#FFF9F3",
                  fontSize: 9.5,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      <button
        type="button"
        title="Sign out"
        aria-label="Sign out"
        onClick={onSignOut}
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          border: "none",
          background: "transparent",
          color: "rgba(246,242,234,.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <LogOut size={20} strokeWidth={1.7} />
      </button>
    </nav>
  );
}

/** Mobile: the same destinations as a bottom bar. */
export function TabBar({ current, onNavigate, unread = 0 }) {
  return (
    <nav
      aria-label="Main"
      style={{
        display: "flex",
        gap: 4,
        padding: "8px 10px",
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        borderTop: "1px solid var(--line)",
        background: "var(--shell)",
        flex: "0 0 auto",
      }}
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = current === id;

        return (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-current={active ? "page" : undefined}
            onClick={() => onNavigate(id)}
            style={{
              position: "relative",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "8px 0",
              borderRadius: 14,
              border: "none",
              cursor: "pointer",
              background: active ? "rgba(169,88,58,.10)" : "transparent",
              color: active ? "var(--accent)" : "var(--text-faint)",
            }}
          >
            <Icon size={20} strokeWidth={1.7} />
            <span style={{ fontSize: 10.5, fontWeight: 600 }}>{label}</span>

            {id === "chats" && unread > 0 && (
              <span
                className="mono"
                style={{
                  position: "absolute",
                  top: 4,
                  right: "50%",
                  marginRight: -22,
                  minWidth: 16,
                  height: 16,
                  padding: "0 4px",
                  borderRadius: 999,
                  background: "var(--accent)",
                  color: "#FFF9F3",
                  fontSize: 9,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
