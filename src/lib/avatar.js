/* ============================================================
   GENERATED AVATARS

   Nobody uploads a photo in this app, so every account still needs
   to look like a person rather than a grey circle. Each contact is
   assigned one of eight soft two-tone palettes, picked by hashing
   a stable key (their phone number). The same contact therefore
   gets the same colour on every device, every session, forever -
   no storage, no network request, no flash of a placeholder.

   Colours are expressed in oklch so the whole set has genuinely
   matched lightness and chroma; the only thing that varies is hue.
   Doing this in hsl would give wildly uneven perceived brightness.
============================================================ */

/** The eight hues, spread around the wheel and named for the UI. */
export const AVATAR_STYLES = [
  { id: "clay", hue: 25, label: "Clay" },
  { id: "amber", hue: 62, label: "Amber" },
  { id: "moss", hue: 118, label: "Moss" },
  { id: "sea", hue: 160, label: "Sea" },
  { id: "sky", hue: 220, label: "Sky" },
  { id: "iris", hue: 300, label: "Iris" },
  { id: "rose", hue: 340, label: "Rose" },
  { id: "slate", hue: 250, label: "Slate" },
];

const FALLBACK = AVATAR_STYLES[0];

/**
 * FNV-1a. Cheap, well-distributed, and - unlike summing char codes -
 * it doesn't collide on anagrams, so "Ana" and "Naa" get different
 * colours instead of the same one.
 */
function hash(value) {
  let h = 0x811c9dc5;

  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  return h >>> 0;
}

/**
 * @param {string} seed     stable key - use the phone number
 * @param {string} [chosen] an explicit style id the user picked
 */
export function avatarStyleFor(seed, chosen) {
  if (chosen) {
    const match = AVATAR_STYLES.find((style) => style.id === chosen);
    if (match) return match;
  }

  const key = String(seed || "");
  if (!key) return FALLBACK;

  return AVATAR_STYLES[hash(key) % AVATAR_STYLES.length];
}

export function avatarColors(seed, chosen) {
  const style = avatarStyleFor(seed, chosen);

  return {
    id: style.id,
    background: `oklch(0.84 0.055 ${style.hue})`,
    foreground: `oklch(0.36 0.075 ${style.hue})`,
    ring: `oklch(0.72 0.09 ${style.hue})`,
  };
}

/**
 * "Amara Osei" -> "AO", "amara" -> "AM", "+91 98..." -> the first two
 * digits, which at least stays stable while the name backfills.
 */
export function initialsFrom(name, fallback = "?") {
  const clean = String(name || "").trim();
  if (!clean) return fallback;

  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  return clean.slice(0, 2).toUpperCase();
}
