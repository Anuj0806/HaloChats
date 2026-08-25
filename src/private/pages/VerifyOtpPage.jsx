import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, MailCheck } from "lucide-react";

import AuthShell from "@/components/AuthShell";
import Button from "@/components/halo/Button";
import Alert from "@/components/halo/Alert";
import OtpInput from "@/components/halo/OtpInput";
import { resendSignupOtp, verifySignupOtp } from "../services/authService";
import { maskEmail, readError } from "@/lib/format";

const RESEND_SECONDS = 45;

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const email = state?.email || "";

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  // Guards against the auto-submit firing twice: OtpInput calls
  // onComplete whenever the value hits six characters, which happens
  // again if the person edits and retypes the last digit.
  const submitting = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return undefined;

    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerify = useCallback(
    async (code) => {
      const value = (code || otp).trim();

      if (value.length !== 6) {
        setError("Enter all six digits");
        return;
      }

      if (submitting.current) return;
      submitting.current = true;

      setError("");
      setNotice("");

      try {
        setLoading(true);
        await verifySignupOtp({ email, otp: value });

        navigate("/", {
          replace: true,
          state: { notice: "Email confirmed. Sign in to get started." },
        });
      } catch (err) {
        setError(readError(err, "That code didn't work. Check it and try again."));
        setOtp("");
      } finally {
        setLoading(false);
        submitting.current = false;
      }
    },
    [email, navigate, otp]
  );

  const handleResend = async () => {
    if (cooldown > 0) return;

    setError("");
    setNotice("");

    try {
      setResending(true);
      await resendSignupOtp(email);
      setNotice("A fresh code is on its way.");
      setCooldown(RESEND_SECONDS);
      setOtp("");
    } catch (err) {
      setError(readError(err, "Couldn't send another code just yet."));
    } finally {
      setResending(false);
    }
  };

  // Landing here directly - a refresh, or a bookmarked URL - means
  // there's no address to verify. Say so plainly instead of showing
  // a form that can only fail.
  if (!email) {
    return (
      <AuthShell>
        <h1 className="display" style={{ fontSize: 34 }}>
          Nothing to verify
        </h1>
        <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          This page needs to know which account you're confirming. Start from
          sign-up and we'll bring you back here.
        </p>

        <div className="mt-6 flex gap-3">
          <Button onClick={() => navigate("/signup")} size="lg">
            Go to sign up
          </Button>
          <Button variant="ghost" size="lg" onClick={() => navigate("/")}>
            Sign in
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Link
        to="/signup"
        className="inline-flex items-center gap-2 text-[13.5px] font-semibold"
        style={{ color: "var(--text-muted)", marginBottom: 26 }}
      >
        <ChevronLeft size={17} strokeWidth={1.8} />
        Back
      </Link>

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
        <MailCheck size={21} strokeWidth={1.7} color="var(--accent)" />
      </div>

      <h1 className="display" style={{ fontSize: 36 }}>
        Check your inbox
      </h1>
      <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        We sent a six-digit code to{" "}
        <span style={{ color: "var(--text)", fontWeight: 600 }}>{maskEmail(email)}</span>
      </p>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}
      {notice && (
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
        loadingLabel="Verifying…"
        onClick={() => handleVerify()}
      >
        Verify code
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
            onClick={handleResend}
            disabled={resending}
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
            {resending ? "Sending…" : "Send another"}
          </button>
        )}
      </p>
    </AuthShell>
  );
}
