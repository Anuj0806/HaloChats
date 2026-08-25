import { avatarColors, initialsFrom } from "@/lib/avatar";

/**
 * The one avatar in the app. Bigger avatars use a squircle and
 * smaller ones a circle - that's the reference design's rule, and
 * keeping it here means no caller has to remember it.
 *
 * @param {string} name     shown as initials
 * @param {string} seed     stable colour key - pass the phone number
 * @param {string} avatarId an explicit style the user chose
 * @param {number} size     pixels
 * @param {"online"|"offline"|null} presence
 */
export default function Avatar({
  name,
  seed,
  avatarId,
  size = 46,
  presence = null,
  ring = false,
  className = "",
  style = {},
}) {
  const colors = avatarColors(seed || name, avatarId);
  const squircle = size >= 48;

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size, ...style }}
    >
      <div
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: squircle ? Math.round(size * 0.33) : "50%",
          background: colors.background,
          color: colors.foreground,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.max(11, Math.round(size * 0.37)),
          fontWeight: 700,
          letterSpacing: "0.01em",
          lineHeight: 1,
          border: ring ? "2px solid var(--shell)" : "none",
        }}
      >
        {initialsFrom(name)}
      </div>

      {presence && (
        <span
          title={presence === "online" ? "Online" : "Offline"}
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: Math.max(9, Math.round(size * 0.24)),
            height: Math.max(9, Math.round(size * 0.24)),
            borderRadius: "50%",
            background: presence === "online" ? "var(--ok)" : "var(--text-ghost)",
            border: "2px solid var(--shell)",
          }}
        />
      )}
    </div>
  );
}
