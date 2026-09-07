import { API_BASE_PUBLIC, API_HOST, API_PORT } from "../private/constant/config";

/* ============================================================
   SERVER REACHABILITY

   A wrong VITE_API_HOST and a genuinely missing feature look
   identical from inside the app: an empty contacts list, a
   "Message" button that quietly does nothing. Neither the browser
   nor axios can tell the difference between "the server is down"
   and "CORS rejected this" - that distinction is deliberately
   hidden from JavaScript for security reasons, so there is no way
   to report it more precisely than this from the client side.

   What this CAN do is answer one question with certainty: did a
   plain, unauthenticated GET to the backend succeed at all. If it
   didn't, every other feature - search, chat, groups, everything -
   was never going to work either, and saying so immediately removes
   the guesswork of "is this a bug or is something misconfigured."
============================================================ */

const TIMEOUT_MS = 5000;

export async function pingServer() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_PUBLIC}/health`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });

    return { reachable: response.ok, status: response.status };
  } catch (error) {
    // A CORS rejection and a dead server both surface here as a
    // generic "Failed to fetch" / AbortError with no further detail
    // available to JS - that's a browser security boundary, not a
    // gap in this code.
    return { reachable: false, aborted: error.name === "AbortError" };
  } finally {
    clearTimeout(timer);
  }
}

export function backendAddress() {
  return `${API_HOST}`;
}
