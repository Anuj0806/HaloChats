/* ============================================================
   FORMATTING

   All the "how does this read to a human" logic lives here so the
   chat list, chat window and search results can't drift apart.
============================================================ */

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatClock(timestamp) {
  if (!timestamp) return "";

  return new Date(Number(timestamp)).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Chat-list timestamps compress as they age: a time today, a weekday
 * this week, then a date. Showing "14:32" against a message from
 * March would be actively misleading.
 */
export function formatListTime(timestamp) {
  if (!timestamp) return "";

  const date = new Date(Number(timestamp));
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return formatClock(timestamp);
  }

  const yesterday = new Date(now.getTime() - DAY_MS);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  if (now - date < 7 * DAY_MS) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  return date.toLocaleDateString([], { day: "numeric", month: "short" });
}

/** The pill that separates one day's messages from the next. */
export function formatDayDivider(timestamp) {
  if (!timestamp) return "";

  const date = new Date(Number(timestamp));
  const now = new Date();

  if (date.toDateString() === now.toDateString()) return "Today";

  const yesterday = new Date(now.getTime() - DAY_MS);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  if (now - date < 7 * DAY_MS) {
    return date.toLocaleDateString([], { weekday: "long" });
  }

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "long",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function sameDay(a, b) {
  if (!a || !b) return false;
  return new Date(Number(a)).toDateString() === new Date(Number(b)).toDateString();
}

export function truncate(text, max = 40) {
  const value = String(text || "");
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}…`;
}

/**
 * a***a@example.com - enough for someone to recognise their own
 * address on the OTP screen without printing it in full for anyone
 * reading over their shoulder.
 */
export function maskEmail(email) {
  const value = String(email || "");
  const at = value.indexOf("@");

  if (at < 1) return value;

  const name = value.slice(0, at);
  const domain = value.slice(at);

  if (name.length <= 2) return `${name[0]}***${domain}`;

  return `${name[0]}${"*".repeat(Math.min(name.length - 2, 5))}${name[name.length - 1]}${domain}`;
}

/**
 * Server errors arrive in a few shapes depending on which layer
 * rejected the call. One place to unwrap them means no screen ever
 * shows "[object Object]".
 */
export function readError(error, fallback = "Something went wrong. Try again.") {
  if (!error) return fallback;

  const data = error.response?.data;

  if (typeof data === "string" && data.trim()) return data;
  if (data?.message) return data.message;
  if (data?.error) return data.error;

  if (error.code === "ERR_NETWORK") {
    return "Can't reach the server. Check your connection and try again.";
  }

  return error.message || fallback;
}
