import { createContext, useContext } from "react";

/* ============================================================
   SESSION STORE

   The context object and its reader live here, apart from the
   provider component, so the provider file exports nothing but a
   component. That is what lets Vite hot-reload the provider
   without tearing down the whole app on every edit.
============================================================ */

const STORAGE_KEY = "halo.session";

export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an <AuthProvider>");
  }

  return context;
}

/**
 * One record instead of the four loose keys the app used before
 * (authToken / phone / name / ...). Loose keys drift: sign-out
 * clears three, one survives, and the next screen reads a
 * half-session. A single record can only be present or absent.
 */
export function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.token && parsed?.phone) return parsed;
    }

    // Fall back to the pre-migration keys once, so upgrading doesn't
    // sign existing users out.
    const token = localStorage.getItem("authToken");
    const phone = localStorage.getItem("phone");
    const name = localStorage.getItem("name");

    if (token && phone) {
      return { token, phone, name: name || phone, email: "", avatarId: null, about: "" };
    }
  } catch {
    // Corrupted JSON means no usable session - treat that as signed
    // out rather than crashing the app on boot.
  }

  return null;
}

export function persistSession(session) {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("authToken");
    localStorage.removeItem("phone");
    localStorage.removeItem("name");
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));

  // Mirrored for any code still reading the old keys directly.
  localStorage.setItem("authToken", session.token);
  localStorage.setItem("phone", session.phone);
  localStorage.setItem("name", session.name || "");
}

export { STORAGE_KEY };
