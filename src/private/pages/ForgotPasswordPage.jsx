import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AtSign, Check, ChevronLeft, KeyRound, Lock } from "lucide-react";

import AuthShell from "@/components/AuthShell";
import Field from "@/components/halo/Field";
import Button from "@/components/halo/Button";
import Alert from "@/components/halo/Alert";
import OtpInput from "@/components/halo/OtpInput";
import PasswordMeter from "@/components/halo/PasswordMeter";
import { scorePassword } from "@/lib/password";
import { requestPasswordReset, resetPassword, verifyResetOtp } from "../services/authService";
import { maskEmail, readError } from "@/lib/format";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND_SECONDS = 60;

const STEPS = ["Email", "Code", "New password"];

/* ============================================================
   FORGOT PASSWORD

   Three steps in one component, because they share one piece of
   state that must not escape: the reset token. Splitting them into
   routes would mean either passing the token through the URL or
   parking it in storage - both worse than keeping it in memory for
   the ninety seconds it's needed.
============================================================ */

function Stepper({ current }) {
  return (
    <div className="flex items-center gap-2" style={{ marginBottom: 26 }}>
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className="mono"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 10.5,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: active ? "var(--accent)" : done ? "var(--ok)" : "var(--text-ghost)",
                fontWeight: active ? 500 : 400,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9.5,
                  background: done
                    ? "var(--ok-bg)"
                    : active
                    ? "var(--accent-wash)"
                    : "var(--surface-sunk)",
                  color: done ? "var(--ok)" : active ? "var(--accent)" : "var(--text-ghost)",
                }}
              >
                {done ? <Check size={11} strokeWidth={2.6} /> : index + 1}
              </span>
              {label}
            </div>

            {index < STEPS.length - 1 && (
              <span style={{ width: 14, height: 1, background: "var(--line-field)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // How long the reset token stays valid, counted down so the person
  // isn't surprised by an expiry mid-typing.
  const [tokenSeconds, setTokenSeconds] = useState(0);

  const submitting = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (tokenSeconds <= 0) return undefined;
    const timer = setTimeout(() => setTokenSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [tokenSeconds]);

  const clearMessages = () => {
    setError("");
    setNotice("");
    setFieldErrors({});
  };

  /* ---------- Step 1: ask for a code ---------- */

  const handleRequest = async (event) => {
    event?.preventDefault();
    clearMessages();

    if (!email.trim()) {
      setFieldErrors({ email: "Enter your email" });
      return;
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      setFieldErrors({ email: "That doesn't look like an email address" });
      return;
    }

    try {
      setLoading(true);
      const response = await requestPasswordReset(email);

      // The server answers identically whether or not the address is
      // registered, so this message must not promise an inbox delivery.
      setNotice(response?.message || "If that address has an account, a code is on its way.");
      setStep(1);
      setCooldown(RESEND_SECONDS);
      setOtp("");
    } catch (err) {
      setError(readError(err, "Couldn't send a code right now. Try again in a moment."));
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Step 2: exchange the code for a token ---------- */

  const handleVerify = async (code) => {
    const value = (code || otp).trim();

    if (value.length !== 6) {
      setError("Enter all six digits");
      return;
    }

    if (submitting.current) return;
    submitting.current = true;

    clearMessages();

    try {
      setLoading(true);
      const result = await verifyResetOtp({ email, otp: value });

      setResetToken(result.resetToken);
      setTokenSeconds(result.expiresInSeconds || 600);
      setStep(2);
    } catch (err) {
      setError(readError(err, "That code didn't work. Check it and try again."));
      setOtp("");
    } finally {
      setLoading(false);
      submitting.current = false;
    }
  };

  /* ---------- Step 3: set the new password ---------- */

  const handleReset = async (event) => {
    event?.preventDefault();
    clearMessages();

    const next = {};

    if (!newPassword) next.newPassword = "Choose a new password";
    else if (scorePassword(newPassword).score < 1) next.newPassword = "Use at least 8 characters";

    if (!confirmPassword) next.confirmPassword = "Type it again";
    else if (newPassword !== confirmPassword) next.confirmPassword = "These don't match";

    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      return;
    }

    try {
      setLoading(true);
      await resetPassword({ email, resetToken, newPassword });

      navigate("/", {
        replace: true,
        state: { notice: "Password updated. Sign in with your new one." },
      });
    } catch (err) {
      setError(readError(err, "Couldn't update your password. Request a new code and try again."));
    } finally {
      setLoading(false);
    }
  };

  const backToEmail = () => {
    clearMessages();
    setStep(0);
    setOtp("");
  };

  return (
    <AuthShell>
      {step === 0 && (
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[13.5px] font-semibold"
          style={{ color: "var(--text-muted)", marginBottom: 26 }}
        >
          <ChevronLeft size={17} strokeWidth={1.8} />
          Back to sign in
        </Link>
      )}

      {step === 1 && (
        <button
          type="button"
          onClick={backToEmail}
          className="inline-flex items-center gap-2 text-[13.5px] font-semibold"
          style={{
            color: "var(--text-muted)",
            marginBottom: 26,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <ChevronLeft size={17} strokeWidth={1.8} />
          Use a different email
        </button>
      )}

      <Stepper current={step} />

      {/* ---------- STEP 1 ---------- */}
      {step === 0 && (
        <>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 15,
              background: "var(--accent-wash)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <KeyRound size={21} strokeWidth={1.7} color="var(--accent)" />
          </div>

          <h1 className="display" style={{ fontSize: 36 }}>
            Forgot password?
          </h1>
          <p
            className="mt-2.5 text-[14.5px] leading-relaxed"
            style={{ color: "var(--text-muted)", textWrap: "pretty" }}
          >
            Enter the email tied to your account and we'll send a six-digit code.
          </p>

          {error && (
            <div className="mt-5">
              <Alert>{error}</Alert>
            </div>
          )}

          <form onSubmit={handleRequest} className="mt-6 flex flex-col gap-4">
            <Field
              label="Email"
              icon={AtSign}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearMessages();
              }}
              placeholder="you@example.com"
              autoComplete="email"
              error={fieldErrors.email}
              autoFocus
            />

            <Button type="submit" size="lg" full loading={loading} loadingLabel="Sending code…">
              Send code
            </Button>
          </form>
        </>
      )}

      {/* ---------- STEP 2 ---------- */}
      {step === 1 && (
        <>
          <h1 className="display" style={{ fontSize: 36 }}>
            Enter your code
          </h1>
          <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            If <span style={{ color: "var(--text)", fontWeight: 600 }}>{maskEmail(email)}</span> has
            an account, a six-digit code is in that inbox.
          </p>

          {error && (
            <div className="mt-5">
              <Alert>{error}</Alert>
            </div>
          )}
          {notice && !error && (
            <div className="mt-5">
              <Alert tone="ok">{notice}</Alert>
            </div>
          )}

          <div className="mt-6">
            <OtpInput
              value={otp}
              onChange={setOtp}
              onComplete={handleVerify}
              disabled={loading}
              invalid={Boolean(error)}
            />
          </div>

          <Button
            size="lg"
            full
            className="mt-6"
            loading={loading}
            loadingLabel="Checking…"
            onClick={() => handleVerify()}
          >
            Continue
          </Button>

          <p className="mt-5 text-center text-[13.5px]" style={{ color: "var(--text-muted)" }}>
            Didn't get it?{" "}
            {cooldown > 0 ? (
              <span className="mono" style={{ color: "var(--text-faint)" }}>
                resend in {cooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleRequest}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "var(--accent)",
                }}
              >
                Send another
              </button>
            )}
          </p>
        </>
      )}

      {/* ---------- STEP 3 ---------- */}
      {step === 2 && (
        <>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 15,
              background: "var(--ok-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Check size={21} strokeWidth={2} color="var(--ok)" />
          </div>

          <h1 className="display" style={{ fontSize: 36 }}>
            Set a new password
          </h1>
          <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Make it something you haven't used elsewhere.
          </p>

          {tokenSeconds > 0 && tokenSeconds < 120 && (
            <p className="mono mt-3 text-[11px]" style={{ color: "var(--danger-text)" }}>
              This code expires in {Math.floor(tokenSeconds / 60)}:
              {String(tokenSeconds % 60).padStart(2, "0")}
            </p>
          )}

          {error && (
            <div className="mt-5">
              <Alert>{error}</Alert>
            </div>
          )}

          <form onSubmit={handleReset} className="mt-6 flex flex-col gap-[14px]">
            <div>
              <Field
                label="New password"
                icon={Lock}
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setFieldErrors((c) => ({ ...c, newPassword: "" }));
                }}
                placeholder="8+ characters"
                autoComplete="new-password"
                error={fieldErrors.newPassword}
                autoFocus
              />
              {!fieldErrors.newPassword && <PasswordMeter password={newPassword} />}
            </div>

            <Field
              label="Confirm password"
              icon={Lock}
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setFieldErrors((c) => ({ ...c, confirmPassword: "" }));
              }}
              placeholder="Type it again"
              autoComplete="new-password"
              error={fieldErrors.confirmPassword}
            />

            <Button type="submit" size="lg" full loading={loading} loadingLabel="Updating…">
              Update password
            </Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
