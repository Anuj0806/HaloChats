import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Modal dialog. Handles the three things people expect and that are
 * easy to forget: Escape closes it, clicking the backdrop closes it,
 * and Tab stays inside the dialog instead of wandering into the page
 * behind it.
 */
export default function Modal({ open, title, description, onClose, children, footer, width = 440 }) {
  const panel = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;

    const handleKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose?.();
        return;
      }

      if (event.key !== "Tab" || !panel.current) return;

      const focusable = panel.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey, true);

    const firstField = panel.current?.querySelector("input, button");
    firstField?.focus();

    return () => {
      document.removeEventListener("keydown", handleKey, true);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(30, 27, 24, 0.42)",
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-pop"
        style={{
          width: "min(100%, " + width + "px)",
          maxHeight: "calc(100vh - 40px)",
          overflowY: "auto",
          background: "var(--shell)",
          borderRadius: 22,
          border: "1px solid var(--line)",
          boxShadow: "0 40px 80px -30px rgba(30,27,24,.6)",
          padding: 24,
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="display" style={{ fontSize: 25 }}>
              {title}
            </h2>
            {description && (
              <p
                className="mt-1.5 text-[13.5px] leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="icon-btn"
            style={{ width: 34, height: 34, flex: "0 0 auto" }}
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        <div className="mt-5">{children}</div>

        {footer && (
          <div className="mt-6 flex justify-end" style={{ gap: 10 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
