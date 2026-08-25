import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check } from "lucide-react";

import { ToastContext } from "./toastStore";

/**
 * Confirmations that need no decision - "Copied", "Profile saved".
 * Anything the person must act on belongs in an inline Alert
 * instead, where it stays on screen next to the thing it concerns.
 */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((message, tone = "ok") => {
    if (!message) return;

    clearTimeout(timer.current);
    setToast({ message, tone, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}

      {toast && (
        <div
          key={toast.key}
          role="status"
          aria-live="polite"
          onClick={dismiss}
          className="animate-pop"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 28,
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 18px",
            borderRadius: 14,
            background: "var(--ink)",
            color: "var(--on-ink)",
            fontSize: 13.5,
            fontWeight: 500,
            boxShadow: "var(--shadow-pop)",
            zIndex: 90,
            cursor: "pointer",
            maxWidth: "min(440px, calc(100vw - 32px))",
          }}
        >
          {toast.tone === "error" ? (
            <AlertCircle size={16} strokeWidth={2.2} style={{ color: "#E9A38C", flex: "0 0 auto" }} />
          ) : (
            <Check size={16} strokeWidth={2.2} style={{ color: "var(--ok-soft)", flex: "0 0 auto" }} />
          )}
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}
