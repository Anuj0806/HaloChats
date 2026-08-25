import { useRef, useState } from "react";
import { ChevronLeft, Lock, Send, ShieldAlert, ShieldCheck, TriangleAlert, X } from "lucide-react";

import Avatar from "@/components/halo/Avatar";
import Button from "@/components/halo/Button";
import { formatClock } from "@/lib/format";

/* ============================================================
   SEALED CHAT PANE

   Visually distinct from an ordinary conversation on purpose. The
   rules here are genuinely different - nothing is saved, nothing
   reaches an offline recipient - and a pane that looked identical
   would set exactly the wrong expectation.
============================================================ */

export default function SealedChatPane({
  session,
  connected,
  onBack,
  onSend,
  onTyping,
  onClose,
  onVerify,
  wide,
}) {
  const [draft, setDraft] = useState("");
  const composer = useRef(null);
  const scroller = useRef(null);

  if (!session) return null;

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;

    const sent = await onSend(text);
    if (sent === false) return;

    setDraft("");
    if (composer.current) composer.current.style.height = "auto";
    composer.current?.focus();

    requestAnimationFrame(() => {
      scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
    });
  };

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--ink)",
        color: "var(--on-ink)",
        position: "relative",
      }}
    >
      {/* ---------- Header ---------- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 13,
          padding: "15px 20px",
          borderBottom: "1px solid rgba(246,242,234,.10)",
          flex: "0 0 auto",
        }}
      >
        {!wide && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: "none",
              background: "transparent",
              color: "var(--on-ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronLeft size={20} strokeWidth={1.8} />
          </button>
        )}

        <Avatar name={session.name} seed={session.phone} size={40} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center gap-1.5">
            <span
              className="truncate-1"
              style={{ fontSize: 15, fontWeight: 600, color: "var(--on-ink)" }}
            >
              {session.name}
            </span>
            <Lock size={13} strokeWidth={2.2} style={{ color: "var(--ok-soft)", flex: "0 0 auto" }} />
          </div>
          <div style={{ fontSize: 12.2, marginTop: 2, color: "rgba(246,242,234,.5)" }}>
            {session.peerTyping ? "typing…" : "Sealed · not saved anywhere"}
          </div>
        </div>

        <button
          type="button"
          onClick={onVerify}
          aria-label="Verify safety number"
          title="Verify safety number"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            border: "none",
            background: "rgba(246,242,234,.08)",
            color: session.verified ? "var(--ok-soft)" : "rgba(246,242,234,.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flex: "0 0 auto",
          }}
        >
          {session.verified ? (
            <ShieldCheck size={18} strokeWidth={1.9} />
          ) : (
            <ShieldAlert size={18} strokeWidth={1.9} />
          )}
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label="End sealed chat"
          title="End sealed chat"
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            border: "none",
            background: "rgba(246,242,234,.08)",
            color: "#E9A38C",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flex: "0 0 auto",
          }}
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      {/* ---------- Key mismatch warning ---------- */}
      {session.keyConsistent === false && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            margin: "14px 20px 0",
            padding: "12px 14px",
            borderRadius: 12,
            background: "rgba(233,163,140,.12)",
            border: "1px solid rgba(233,163,140,.35)",
            fontSize: 12.8,
            lineHeight: 1.55,
            color: "#F0C4B4",
          }}
        >
          <TriangleAlert size={17} strokeWidth={1.9} style={{ flex: "0 0 auto", marginTop: 1 }} />
          <span>
            The server's record of this key doesn't match the key it sent. Compare safety numbers
            with {session.name} before saying anything sensitive.
          </span>
        </div>
      )}

      {/* ---------- Messages ---------- */}
      <div
        ref={scroller}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "22px 20px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            alignSelf: "center",
            maxWidth: "44ch",
            textAlign: "center",
            padding: "16px 18px",
            marginBottom: 8,
            borderRadius: 16,
            background: "rgba(246,242,234,.05)",
            border: "1px solid rgba(246,242,234,.10)",
          }}
        >
          <Lock
            size={20}
            strokeWidth={1.7}
            style={{ color: "var(--ok-soft)", margin: "0 auto 8px", display: "block" }}
          />
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(246,242,234,.68)" }}>
            Messages here are encrypted on your device and decrypted on theirs. The server relays
            them without being able to read them.
          </p>
          <p style={{ fontSize: 12.2, lineHeight: 1.6, color: "rgba(246,242,234,.42)", marginTop: 8 }}>
            Nothing is saved. Closing this chat or refreshing the page erases it for good, and
            messages won't reach {session.name} while they're offline.
          </p>
        </div>

        {session.messages.map((message) => (
          <div
            key={message.messageId}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: message.mine ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "min(60ch, 78%)",
                padding: "11px 15px",
                fontSize: 14.5,
                lineHeight: 1.55,
                borderRadius: message.mine ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
                background: message.failed
                  ? "rgba(233,163,140,.14)"
                  : message.mine
                  ? "var(--accent)"
                  : "rgba(246,242,234,.10)",
                color: message.failed ? "#F0C4B4" : message.mine ? "#FFF9F3" : "var(--on-ink)",
                border: message.failed ? "1px solid rgba(233,163,140,.35)" : "none",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontStyle: message.failed ? "italic" : "normal",
              }}
            >
              {message.failed ? "This message couldn't be decrypted." : message.text}
            </div>

            <span
              className="mono"
              style={{ fontSize: 10, color: "rgba(246,242,234,.35)", marginTop: 4, padding: "0 4px" }}
            >
              {formatClock(message.at)}
              {message.mine && message.status === "UNDELIVERED" && " · not delivered"}
              {message.mine && message.status === "DELIVERED" && " · delivered"}
            </span>
          </div>
        ))}
      </div>

      {/* ---------- Composer ---------- */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          padding: "12px 20px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          borderTop: "1px solid rgba(246,242,234,.10)",
          flex: "0 0 auto",
        }}
      >
        <textarea
          ref={composer}
          rows={1}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            onTyping(true);

            const node = event.currentTarget;
            node.style.height = "auto";
            node.style.height = `${Math.min(node.scrollHeight, 120)}px`;
          }}
          onBlur={() => onTyping(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={connected ? "Sealed message" : "Offline — sealed messages can't be queued"}
          aria-label="Sealed message"
          disabled={!connected}
          style={{
            flex: 1,
            minWidth: 0,
            resize: "none",
            maxHeight: 120,
            padding: "11px 16px",
            borderRadius: 20,
            border: "1px solid rgba(246,242,234,.16)",
            background: "rgba(246,242,234,.06)",
            fontSize: 14.5,
            lineHeight: 1.5,
            color: "var(--on-ink)",
          }}
        />

        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim() || !connected}
          aria-label="Send sealed message"
          style={{
            width: 42,
            height: 42,
            flex: "0 0 auto",
            borderRadius: "50%",
            border: "none",
            cursor: draft.trim() && connected ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: draft.trim() && connected ? "var(--accent)" : "rgba(246,242,234,.08)",
            color: draft.trim() && connected ? "#FFF9F3" : "rgba(246,242,234,.3)",
          }}
        >
          <Send size={18} strokeWidth={1.9} />
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   SAFETY NUMBER

   The one defence against a server that hands each side a key it
   controls. Code can't verify this - only two people comparing the
   same digits over a channel the server doesn't control can - so
   the copy says exactly that instead of implying the app has it
   covered.
============================================================ */

export function SafetyNumberPanel({ session, onVerify }) {
  if (!session) return null;

  return (
    <div>
      <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--text-muted)", marginBottom: 18 }}>
        Compare these two numbers with {session.name} in person or over a call. If they match on
        both screens, nobody is sitting in the middle of this conversation.
      </p>

      <FingerprintBlock label="Yours" value={session.myFingerprint} />
      <FingerprintBlock label={session.name} value={session.peerFingerprint} />

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          marginTop: 18,
          cursor: "pointer",
          fontSize: 13.5,
          color: "var(--text)",
        }}
      >
        <input
          type="checkbox"
          checked={session.verified}
          onChange={(event) => onVerify(event.target.checked)}
          style={{ marginTop: 3, accentColor: "var(--accent)", width: 16, height: 16 }}
        />
        <span>
          I've compared these and they match.
          <span style={{ display: "block", color: "var(--text-subtle)", fontSize: 12.5, marginTop: 2 }}>
            This only marks it on your device — it doesn't check anything for you.
          </span>
        </span>
      </label>
    </div>
  );
}

function FingerprintBlock({ label, value }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p className="eyebrow" style={{ marginBottom: 6 }}>
        {label}
      </p>
      <p
        className="mono"
        style={{
          fontSize: 13.5,
          letterSpacing: ".06em",
          lineHeight: 1.8,
          color: "var(--text)",
          background: "var(--surface-sunk)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: "12px 14px",
          wordSpacing: ".3em",
        }}
      >
        {value || "—"}
      </p>
    </div>
  );
}
