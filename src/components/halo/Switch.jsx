export default function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      style={{
        width: 44,
        height: 26,
        flex: "0 0 auto",
        borderRadius: 999,
        border: "none",
        padding: 3,
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "var(--accent)" : "var(--line-field)",
        transition: "background .18s ease",
        display: "flex",
        justifyContent: checked ? "flex-end" : "flex-start",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#FFFDF9",
          boxShadow: "0 1px 3px rgba(30,27,24,.3)",
          transition: "transform .18s ease",
        }}
      />
    </button>
  );
}
