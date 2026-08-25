import { Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "@/auth/AuthContext";
import { RedirectIfAuthed, RequireAuth } from "@/auth/RouteGuards";
import { ToastProvider } from "@/components/halo/Toast";
import SessionWatcher from "@/components/SessionWatcher";

import LoginPage from "./private/pages/LoginPage";
import SignupPage from "./private/pages/SignupPage";
import VerifyOtpPage from "./private/pages/VerifyOtpPage";
import ForgotPasswordPage from "./private/pages/ForgotPasswordPage";
import AppPage from "./private/pages/AppPage";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SessionWatcher />

        <Routes>
          {/* Public */}
          <Route
            path="/"
            element={
              <RedirectIfAuthed>
                <LoginPage />
              </RedirectIfAuthed>
            }
          />

          <Route
            path="/signup"
            element={
              <RedirectIfAuthed>
                <SignupPage />
              </RedirectIfAuthed>
            }
          />

          <Route path="/verify-otp" element={<VerifyOtpPage />} />

          <Route
            path="/forgot-password"
            element={<ForgotPasswordPage />}
          />

          {/* Signed in */}
          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppPage />
              </RequireAuth>
            }
          />

          {/* Old route */}
          <Route
            path="/home"
            element={<Navigate to="/app" replace />}
          />

          {/* Unknown route */}
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}