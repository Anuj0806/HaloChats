import { useState } from "react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  Lock,
  LogOut,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";

import Switch from "@/components/halo/Switch";
import { getDatabaseStats } from "@/database";

/* ============================================================
   SETTINGS

   Preferences are stored per-device (see lib/prefs.js), because
   that is what they describe - how this browser behaves. Nothing
   here is synced to the server, and the copy says so rather than
   implying an account-wide setting.
============================================================ */

export default function SettingsPane({
  prefs,
  onPrefsChange,
  onBack,
  onChangePassword,
  onBackup,
  onRestore,
  onEraseLocal,
  onSignOut,
  notificationsBlocked,
  wide,
}) {
  // Read once, during the first render, rather than in an effect -
  // the numbers are a snapshot for this visit and re-reading them on
  // every render would hit SQLite for no reason.
  const [stats] = useState(() => {
    try {
      return getDatabaseStats();
    } catch {
      return null;
    }
  });

  const toggles = [
    {
      key: "notifications",
      icon: Bell,
      label: "Desktop notifications",
      hint: notificationsBlocked
        ? "Blocked by your browser. Allow notifications in site settings to use this."
        : "Alerts for messages that arrive while Halo isn't focused",
      disabled: notificationsBlocked,
    },
    {
      key: "sounds",
      icon: Volume2,
      label: "Message sound",
      hint: "A short tone when a message arrives",
    },
    {
      key: "readReceipts",
      icon: Eye,
      label: "Read receipts",
      hint: "Let people see when you've read their message",
    },
  ];

  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: "auto", background: "var(--shell)" }}>
      <div
        style={{
          padding: "24px 26px 18px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {!wide && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="icon-btn"
            style={{ width: 36, height: 36, color: "var(--text)" }}
          >
            <ChevronLeft size={20} strokeWidth={1.8} />
          </button>
        )}
        <h1 className="display" style={{ fontSize: 30 }}>
          Settings
        </h1>
      </div>

      <div style={{ padding: "22px 26px 40px", maxWidth: 620, margin: "0 auto" }}>
        {/* ---------- Preferences ---------- */}
        <p className="eyebrow" style={{ marginBottom: 12 }}>
          On this device
        </p>

        <div className="halo-card">
          {toggles.map(({ key, icon: Icon, label, hint, disabled }) => (
            <div
              key={key}
              className="halo-row"
              style={{ cursor: "default" }}
              onClick={() => {
                if (!disabled) onPrefsChange({ ...prefs, [key]: !prefs[key] });
              }}
            >
              <span className="halo-row-icon">
                <Icon size={18} strokeWidth={1.7} />
              </span>

              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}>
                  {label}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 12.8,
                    color: disabled ? "var(--danger-text)" : "var(--text-subtle)",
                    marginTop: 2,
                    textWrap: "pretty",
                  }}
                >
                  {hint}
                </span>
              </span>

              <Switch
                checked={Boolean(prefs[key]) && !disabled}
                disabled={disabled}
                label={label}
                onChange={(value) => onPrefsChange({ ...prefs, [key]: value })}
              />
            </div>
          ))}
        </div>

        {/* ---------- Chat storage ---------- */}
        <p className="eyebrow" style={{ margin: "26px 0 12px" }}>
          Chat storage
        </p>

        <div
          className="halo-alert"
          style={{
            background: "var(--surface-sunk)",
            border: "1px solid var(--line)",
            color: "var(--text-muted)",
            marginBottom: 12,
          }}
        >
          <Database size={17} strokeWidth={1.7} style={{ flex: "0 0 auto", marginTop: 1 }} />
          <span>
            Your messages are stored only in this browser, never on our servers. Clearing site data
            or switching device loses them unless you back them up first.
            {stats && (
              <>
                {" "}
                <span className="mono" style={{ fontSize: 11.5 }}>
                  {stats.messages ?? 0} messages · {stats.chats ?? 0} chats
                </span>
              </>
            )}
          </span>
        </div>

        <div className="halo-card">
          <button type="button" onClick={onBackup} className="halo-row">
            <span className="halo-row-icon">
              <Download size={18} strokeWidth={1.7} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}>
                Back up chats
              </span>
              <span style={{ display: "block", fontSize: 12.8, color: "var(--text-subtle)", marginTop: 2 }}>
                Download everything as a single file
              </span>
            </span>
            <ChevronRight size={18} strokeWidth={1.8} style={{ color: "var(--text-ghost)" }} />
          </button>

          <button type="button" onClick={onRestore} className="halo-row">
            <span className="halo-row-icon">
              <Upload size={18} strokeWidth={1.7} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}>
                Restore from a backup
              </span>
              <span style={{ display: "block", fontSize: 12.8, color: "var(--text-subtle)", marginTop: 2 }}>
                Replaces what's on this device
              </span>
            </span>
            <ChevronRight size={18} strokeWidth={1.8} style={{ color: "var(--text-ghost)" }} />
          </button>
        </div>

        {/* ---------- Account ---------- */}
        <p className="eyebrow" style={{ margin: "26px 0 12px" }}>
          Account
        </p>

        <div className="halo-card">
          <button type="button" onClick={onChangePassword} className="halo-row">
            <span className="halo-row-icon">
              <Lock size={18} strokeWidth={1.7} />
            </span>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}>
              Change password
            </span>
            <ChevronRight size={18} strokeWidth={1.8} style={{ color: "var(--text-ghost)" }} />
          </button>

          <button
            type="button"
            onClick={onEraseLocal}
            className="halo-row"
            style={{ color: "var(--danger-text)" }}
          >
            <span className="halo-row-icon" style={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}>
              <Trash2 size={18} strokeWidth={1.7} />
            </span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 600 }}>
                Erase chats on this device
              </span>
              <span style={{ display: "block", fontSize: 12.8, color: "var(--text-subtle)", marginTop: 2 }}>
                Your account stays; only local history goes
              </span>
            </span>
          </button>

          <button type="button" onClick={onSignOut} className="halo-row">
            <span className="halo-row-icon">
              <LogOut size={18} strokeWidth={1.7} />
            </span>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}>
              Sign out
            </span>
            <ChevronRight size={18} strokeWidth={1.8} style={{ color: "var(--text-ghost)" }} />
          </button>
        </div>

        <p
          className="mono"
          style={{ marginTop: 26, fontSize: 10.5, letterSpacing: ".12em", color: "var(--text-ghost)", textAlign: "center" }}
        >
          HALO · PRIVATE MESSAGING
        </p>
      </div>
    </div>
  );
}
