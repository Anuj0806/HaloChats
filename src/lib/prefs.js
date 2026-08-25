/* ============================================================
   DEVICE PREFERENCES

   These describe how this browser behaves - whether it makes a
   sound, whether it raises notifications - so they live in
   localStorage rather than on the account. Signing in elsewhere
   should not inherit this machine's speaker settings.
============================================================ */

const PREF_KEY = "halo.prefs";

export const DEFAULT_PREFS = {
  notifications: true,
  sounds: true,
  readReceipts: true,
};

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    // Spread over the defaults so a preference added in a later
    // release is present even for someone with an older stored blob.
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    // Private browsing can refuse writes. The setting still applies
    // for this session; it just won't be remembered.
  }
}
