import { useCallback, useEffect, useMemo, useState } from "react";

import {
  AuthContext,
  STORAGE_KEY,
  persistSession,
  readStoredSession,
} from "./authStore";

export function AuthProvider({ children }) {
  // Read synchronously during the first render. Doing this in an
  // effect would flash the signed-out UI for one frame on every
  // reload, and briefly redirect an authenticated user to sign-in.
  const [session, setSession] = useState(readStoredSession);

  const signIn = useCallback((next) => {
    const record = {
      token: next.token,
      phone: String(next.phone || ""),
      name: next.name || next.userName || String(next.phone || ""),
      email: next.email || "",
      avatarId: next.avatarId || null,
      about: next.about || "",
    };

    persistSession(record);
    setSession(record);

    return record;
  }, []);

  const signOut = useCallback(() => {
    persistSession(null);
    setSession(null);
  }, []);

  /** Merge in fields loaded or edited later, e.g. from the profile screen. */
  const updateSession = useCallback((patch) => {
    setSession((current) => {
      if (!current) return current;

      const next = { ...current, ...patch };
      persistSession(next);
      return next;
    });
  }, []);

  // Signing out in one tab should sign out the others.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setSession(readStoredSession());
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(
    () => ({ session, user: session, signIn, signOut, updateSession }),
    [session, signIn, signOut, updateSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
