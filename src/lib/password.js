/* ============================================================
   PASSWORD SCORING

   Kept apart from the meter component so that forms can validate
   against the same rule the meter displays. If this lived in the
   component file the two would eventually disagree.
============================================================ */

export const STRENGTH_LEVELS = [
  { label: "Too short", color: "var(--danger-text)", fill: "var(--danger-line)" },
  { label: "Weak", color: "var(--danger-text)", fill: "#E0A78F" },
  { label: "Fair", color: "#8A6D3B", fill: "#D8BE86" },
  { label: "Good", color: "var(--ok)", fill: "#8FC7B4" },
  { label: "Strong", color: "var(--ok)", fill: "var(--ok)" },
];

/** Minimum accepted length. The server allows 6; we ask for more. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Scores on the things that matter - length first, then variety -
 * and reports what is missing, so the UI can tell someone what to
 * add. "Weak" on its own tells nobody what to do.
 */
export function scorePassword(password) {
  const value = String(password || "");

  if (!value) return { score: -1, missing: [] };
  if (value.length < MIN_PASSWORD_LENGTH) {
    return { score: 0, missing: [`at least ${MIN_PASSWORD_LENGTH} characters`] };
  }

  let score = 1;
  const missing = [];

  if (value.length >= 12) score += 1;
  else missing.push("a few more characters");

  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  else missing.push("a capital letter");

  if (/\d/.test(value)) score += 1;
  else missing.push("a number");

  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  else missing.push("a symbol");

  return { score: Math.min(score, 4), missing };
}
