import { MessageCircle } from "lucide-react";

export default function Logo({ size = 34, showWordmark = true, tone = "light" }) {
  return (
    <div className="flex items-center gap-3">
      <div
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.32),
          background: "linear-gradient(150deg, var(--accent-light), var(--accent-deep))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
        }}
      >
        <MessageCircle
          size={Math.round(size * 0.5)}
          strokeWidth={1.8}
          color="#FCF7EF"
          aria-hidden="true"
        />
      </div>

      {showWordmark && (
        <span
          className="display"
          style={{
            fontSize: Math.round(size * 0.62),
            color: tone === "light" ? "var(--on-ink)" : "var(--text)",
            lineHeight: 1,
          }}
        >
          Halo
        </span>
      )}
    </div>
  );
}
