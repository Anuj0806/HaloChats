import { STRENGTH_LEVELS, scorePassword } from "@/lib/password";

export default function PasswordMeter({ password }) {
  const { score, missing } = scorePassword(password);

  if (score < 0) return null;

  const level = STRENGTH_LEVELS[score];
  const filled = score + 1;

  return (
    <div className="mt-2">
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((index) => (
          <span
            key={index}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 4,
              background: index < filled ? level.fill : "var(--line-field)",
              transition: "background .2s ease",
            }}
          />
        ))}
      </div>

      <p className="mt-2 text-[12.5px]" style={{ color: "var(--text-subtle)" }} aria-live="polite">
        <span style={{ color: level.color, fontWeight: 600 }}>{level.label}</span>
        {missing.length > 0 && score < 4 && <> · add {missing.slice(0, 2).join(" and ")}</>}
      </p>
    </div>
  );
}
