import { useEffect, useRef } from "react";

/**
 * N single-character cells that behave like one field. Used for both
 * 6-digit verification codes and the 4-digit Private Room PIN - the
 * fiddly behaviour below is identical either way, only the length
 * and what the code means to a human differs.
 *
 * The fiddly parts, all of which people hit constantly on real code
 * entry screens and which a naive implementation gets wrong:
 *
 *  - Pasting the whole code into any cell fills every cell.
 *  - Backspace on an empty cell steps back and clears the previous.
 *  - Arrow keys move between cells.
 *  - Typing over a filled cell replaces it instead of being ignored.
 *  - Autofill from an SMS/email suggestion drops in the full string.
 */
export default function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  invalid = false,
  length = 6,
  mask = false,
  ariaLabel,
}) {
  const inputs = useRef([]);
  const digits = String(value || "")
    .padEnd(length, " ")
    .slice(0, length)
    .split("");

  useEffect(() => {
    if (value.length === length && onComplete) {
      onComplete(value);
    }
    // Only fire when the code itself changes, not when the callback identity does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, length]);

  const setDigit = (index, char) => {
    const next = digits.map((d) => (d === " " ? "" : d));
    next[index] = char;
    onChange(next.join("").slice(0, length));
  };

  const focusCell = (index) => {
    const target = inputs.current[Math.max(0, Math.min(length - 1, index))];
    target?.focus();
    target?.select();
  };

  const handleChange = (index, raw) => {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) return;

    // A paste or autofill arrives as several characters at once.
    if (cleaned.length > 1) {
      const merged = (value.slice(0, index) + cleaned).replace(/\D/g, "").slice(0, length);
      onChange(merged);
      focusCell(merged.length);
      return;
    }

    setDigit(index, cleaned);
    if (index < length - 1) focusCell(index + 1);
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace") {
      event.preventDefault();

      if (digits[index] && digits[index] !== " ") {
        setDigit(index, "");
        return;
      }

      if (index > 0) {
        const next = digits.map((d) => (d === " " ? "" : d));
        next[index - 1] = "";
        onChange(next.join(""));
        focusCell(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusCell(index - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusCell(index + 1);
    }
  };

  const handlePaste = (index, event) => {
    event.preventDefault();
    const pasted = (event.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;

    onChange(pasted);
    focusCell(pasted.length);
  };

  return (
    <div
      className="flex gap-[10px]"
      role="group"
      aria-label={ariaLabel || `${length}-digit code`}
    >
      {digits.map((digit, index) => {
        const filled = digit.trim().length > 0;

        return (
          <input
            key={index}
            ref={(el) => {
              inputs.current[index] = el;
            }}
            type={mask ? "password" : "text"}
            value={digit.trim()}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            onFocus={(event) => event.target.select()}
            disabled={disabled}
            maxLength={length}
            inputMode="numeric"
            // A PIN is memorised, not sent by SMS/email, so it doesn't
            // fit the "one-time-code" autofill hint a 6-digit
            // verification code does - and a browser offering to save
            // it as a password is exactly what mask=true wants to
            // avoid inviting.
            autoComplete={mask ? "off" : index === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${index + 1}`}
            style={{
            width: 58,
minWidth: 58,
maxWidth: 58,
flex: "0 0 58px",
              height: 58,
              textAlign: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 21,
              fontWeight: 500,
              color: "var(--text)",
              borderRadius: "var(--r-field)",
              border: `1px solid ${
                invalid ? "var(--danger-line)" : filled ? "var(--accent)" : "var(--line-field)"
              }`,
              background: invalid ? "var(--danger-bg)" : filled ? "var(--accent-wash)" : "var(--surface)",
              transition: "border-color .16s ease, background .16s ease",
            }}
          />
        );
      })}
    </div>
  );
}
