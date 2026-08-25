import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "./authStore";

/**
 * Wraps the chat app. Someone who isn't signed in goes to sign-in,
 * and where they were heading is remembered so they land there
 * afterwards rather than on a generic home screen.
 */
export function RequireAuth({ children }) {
  const { session } = useAuth();
  const location = useLocation();

  if (!session?.token) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return children;
}

/**
 * The inverse, for sign-in and sign-up. Without it, a signed-in user
 * pressing Back lands on a login form for the account they're using.
 */
export function RedirectIfAuthed({ children }) {
  const { session } = useAuth();

  if (session?.token) {
    return <Navigate to="/app" replace />;
  }

  return children;
}
