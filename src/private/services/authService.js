import api from "./api";

/* ============================================================
   AUTH API

   Every auth call in the app goes through here, so URLs and
   payload shapes exist in exactly one place. Screens deal in
   plain arguments and never touch axios directly.
============================================================ */

export async function signup({ name, email, phoneNumber, city, password }) {
  const { data } = await api.post("/api/auth/signup", {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phoneNumber: phoneNumber.trim(),
    city: (city || "").trim(),
    password,
  });

  return data;
}

export async function verifySignupOtp({ email, otp }) {
  const { data } = await api.post("/api/auth/verify-otp", {
    email: email.trim().toLowerCase(),
    otp: otp.trim(),
  });

  return data;
}

export async function resendSignupOtp(email) {
  const { data } = await api.post("/api/auth/sendEmailOTP", {
    email: email.trim().toLowerCase(),
  });

  return data;
}

export async function login({ username, password }) {
  const { data } = await api.post("/api/login/login-user", {
    username: username.trim(),
    password,
  });

  return data;
}

/* ---------- Forgot password: three steps ---------- */

export async function requestPasswordReset(email) {
  const { data } = await api.post("/api/auth/forgot-password", {
    email: email.trim().toLowerCase(),
  });

  return data;
}

/**
 * Returns the short-lived reset token. It's held in React state for
 * the rest of the flow and deliberately never written to
 * localStorage - a token sitting in storage outlives the screen that
 * needed it.
 */
export async function verifyResetOtp({ email, otp }) {
  const { data } = await api.post("/api/auth/forgot-password/verify", {
    email: email.trim().toLowerCase(),
    otp: otp.trim(),
  });

  return data?.data ?? data;
}

export async function resetPassword({ email, resetToken, newPassword }) {
  const { data } = await api.post("/api/auth/reset-password", {
    email: email.trim().toLowerCase(),
    resetToken,
    newPassword,
  });

  return data;
}

export async function changePassword({ currentPassword, newPassword }) {
  const { data } = await api.post("/api/auth/change-password", {
    currentPassword,
    newPassword,
  });

  return data;
}
