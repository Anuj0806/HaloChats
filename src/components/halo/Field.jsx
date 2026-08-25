import { useId, useState } from "react";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

/**
 * Labelled text input. Password fields grow a reveal toggle on their
 * own - callers just pass type="password" rather than wiring it up
 * each time, so the behaviour can't be inconsistent between screens.
 */
export default function Field({
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  hint,
  name,
  autoComplete,
  inputMode,
  maxLength,
  disabled = false,
  onKeyDown,
  autoFocus = false,
}) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);

  const isPassword = type === "password";
  const resolvedType = isPassword && revealed ? "text" : type;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <label htmlFor={id} className="flex flex-col gap-[7px]">
      {label && <span className="field-label">{label}</span>}

      <div className={`halo-field ${error ? "is-invalid" : ""}`}>
        {Icon && (
          <Icon
            size={17}
            strokeWidth={1.7}
            aria-hidden="true"
            style={{ color: error ? "var(--danger-text)" : "var(--text-faint)", flex: "0 0 auto" }}
          />
        )}

        <input
          id={id}
          name={name}
          type={resolvedType}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((shown) => !shown)}
            aria-label={revealed ? "Hide password" : "Show password"}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-faint)",
              display: "flex",
              padding: 0,
            }}
          >
            {revealed ? <EyeOff size={17} strokeWidth={1.7} /> : <Eye size={17} strokeWidth={1.7} />}
          </button>
        )}
      </div>

      {error ? (
        <span
          id={`${id}-error`}
          className="flex items-center gap-1.5 text-[12.5px]"
          style={{ color: "var(--danger-text)" }}
        >
          <AlertCircle size={13} strokeWidth={1.9} aria-hidden="true" />
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="text-[12.5px]" style={{ color: "var(--text-subtle)" }}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}
