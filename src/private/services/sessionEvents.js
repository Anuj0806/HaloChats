/* ============================================================
   SESSION EVENTS

   axios interceptors run outside React's tree, so they have no
   direct way to navigate or call useAuth(). This is the bridge: the
   API layer emits "the session is no longer valid," and a component
   mounted inside the router (SessionWatcher, in App.jsx) is the one
   that actually signs out and redirects.
============================================================ */

const listeners = new Set();

export function onSessionExpired(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function emitSessionExpired() {
  listeners.forEach((callback) => callback());
}
