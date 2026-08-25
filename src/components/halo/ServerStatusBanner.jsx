import { RefreshCw, WifiOff } from "lucide-react";
import { backendAddress } from "@/lib/health";

/**
 * Shown the moment the backend is unreachable, before anyone has a
 * chance to click around and conclude a feature is missing. A wrong
 * VITE_API_HOST or a CORS mismatch and a genuinely broken feature are
 * indistinguishable from inside the app otherwise - this makes the
 * network problem explicit and names exactly what to check.
 */
export default function ServerStatusBanner({ status, onRetry, dark = false }) {
  if (status !== "offline") return null;

  const color = dark ? "#E9A38C" : "var(--danger-text)";
  const background = dark ? "rgba(233,163,140,.12)" : "var(--danger-bg)";
  const border = dark ? "1px solid rgba(233,163,140,.35)" : "1px solid var(--danger-line)";
  const textColor = dark ? "#F0C4B4" : "var(--danger-text)";

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "13px 16px",
        borderRadius: 14,
        background,
        border,
        marginBottom: 18,
      }}
    >
      <WifiOff size={18} strokeWidth={1.9} style={{ color, flex: "0 0 auto", marginTop: 1 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: textColor }}>
          Can't reach the server at{" "}
          <span className="mono" style={{ fontWeight: 700 }}>
            {backendAddress()}
          </span>
        </p>
        <p style={{ fontSize: 12.5, lineHeight: 1.55, color: textColor, marginTop: 4, opacity: 0.9 }}>
          Nothing that needs the network — signing in, search, sending messages — can work until
          this is fixed. Check that the backend is running, that <code>VITE_API_HOST</code> in your{" "}
          <code>.env</code> points at it, and that its address is allowed in the backend's{" "}
          <code>app.cors.allowed-origins</code>.
        </p>
      </div>

      <button
        type="button"
        onClick={onRetry}
        aria-label="Check again"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          border: "none",
          background: "transparent",
          color: textColor,
          fontSize: 12.5,
          fontWeight: 600,
          cursor: "pointer",
          padding: "4px 6px",
          flex: "0 0 auto",
        }}
      >
        <RefreshCw size={13} strokeWidth={2.2} />
        Retry
      </button>
    </div>
  );
}
