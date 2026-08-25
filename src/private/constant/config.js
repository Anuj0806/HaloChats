// Centralised runtime config. Override via a .env file + Vite's
// import.meta.env in real deployments instead of hardcoding IPs.
//
// This default previously pointed at 192.168.1.41. On a different LAN
// (a different router, a different subnet) that address is simply
// unreachable, and every network call in the app - profile search,
// starting a chat, sending a message, the WebSocket itself - fails
// silently as a generic network error. There's nothing chat-specific
// about that failure; it happens before any chat logic runs. Set
// VITE_API_HOST in a .env file for your own network rather than
// relying on this fallback.
export const API_HOST = import.meta.env.VITE_API_HOST || "https://halochatsbackend.onrender.com/";
export const API_PORT = import.meta.env.VITE_API_PORT || "2000";

export const API_BASE_PUBLIC = `https://${API_HOST}/public`;
export const API_BASE = `https://${API_HOST}/private`;

export const CHAT_TYPE_PUBLIC = "public";
export const CHAT_TYPE_PRIVATE = "private";
export const WS_URL = `https://${API_HOST}/ws`;

// SECRET_KEY used to live here: a single AES key shared by every user,
// committed to both repos and shipped in the JS bundle. It is gone.
// Sealed chat now derives a per-conversation key via ECDH in the
// browser (see src/lib/e2ee.js) and the server holds no key material.
