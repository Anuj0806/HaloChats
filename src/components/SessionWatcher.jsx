import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/authStore";
import { onSessionExpired } from "../private/services/sessionEvents";

/**
 * Rendered once, inside the router, purely for its effect. It's the
 * other half of api.js's response interceptor: axios can detect a
 * 401 from outside React's tree but can't navigate or call
 * useAuth(), so it emits an event and this is the component that
 * actually acts on it - signing out and sending the person back to
 * the login screen with an explanation, using the same `notice`
 * pattern already used after email verification and password reset.
 */
export default function SessionWatcher() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    return onSessionExpired(() => {
      signOut();
      navigate("/", {
        replace: true,
        state: { notice: "Your session expired. Sign in again to continue." },
      });
    });
  }, [signOut, navigate]);

  return null;
}
