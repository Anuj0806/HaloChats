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
// <<<<<<< Updated upstream
const isProduction = import.meta.env.PROD;

export const API_HOST = isProduction
  ? "halochatsbackend.onrender.com"
  : "192.168.1.41";

export const API_PORT = isProduction ? "" : "2000";

export const API_PROTOCOL = isProduction ? "https" : "http";

export const API_BASE_PUBLIC = isProduction
  ? `${API_PROTOCOL}://${API_HOST}/public`
  : `${API_PROTOCOL}://${API_HOST}:${API_PORT}/public`;

export const API_BASE = isProduction
  ? `${API_PROTOCOL}://${API_HOST}/private`
  : `${API_PROTOCOL}://${API_HOST}:${API_PORT}/private`;


export const WS_URL = import.meta.env.PROD
  ? `${API_PROTOCOL}://${API_HOST}/ws`
  : `${API_PROTOCOL}://${API_HOST}:${API_PORT}/ws`;

// SECRET_KEY used to live here: a single AES key shared by every user,
// committed to both repos and shipped in the JS bundle. It is gone.
// Sealed chat now derives a per-conversation key via ECDH in the
// browser (see src/lib/e2ee.js) and the server holds no key material.
