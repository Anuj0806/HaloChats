import { useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";

import Button from "@/components/halo/Button";
import Field from "@/components/halo/Field";
import Alert from "@/components/halo/Alert";
import OtpInput from "@/components/halo/OtpInput";
import { readError } from "@/lib/format";
import {
  fetchPinStatus,
  resetPrivateRoomPin,
  setPrivateRoomPin,
  verifyPrivateRoomPin,
} from "../services/privateRoomPinService";

/* ============================================================
   PRIVATE ROOM PIN GATE

   Purely an access-control screen in front of the Private Room tab,
   backed by a 4-digit PIN stored (hashed, throttled) on the server.
   It is NOT part of the sealed chat's encryption - opening a room
   still depends entirely on the ECDH key exchange in useSealedChat.
   This only decides whether this browser gets to render that screen
   at all, the same way a phone's app lock sits in front of an app
   without being part of what the app itself protects.

   Unlocking lasts for the rest of this session (component state one
   level up in AppPage) - not persisted, so a fresh sign-in always
   asks again.
============================================================ */

export default function PrivateRoomPinGate({ onUnlock }) {
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState("");

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [stage, setStage] = useState("enter"); // enter | choose | confirm | reset
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  const [resetPin, setResetPin] = useState("");
  const [lockedForSeconds, setLockedForSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchPinStatus()
      .then((result) => {
        if (cancelled) return;
        setStage(result.hasPin ? "enter" : "choose");
        setLockedForSeconds(result.lockedForSeconds || 0);
      })
      .catch((err) => {
        if (!cancelled) setStatusError(readError(err, "Couldn't check your Private Room lock."));
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Count the lockout down locally so the person can see it ticking
  // rather than guessing when to try again.
  useEffect(() => {
    if (lockedForSeconds <= 0) return undefined;

    const timer = setTimeout(() => setLockedForSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [lockedForSeconds]);

  const handleEnterComplete = async (value) => {
    const code = (value || pin).trim();
    if (code.length !== 4) return;

    setError("");
    setSubmitting(true);

    try {
      await verifyPrivateRoomPin(code);
      onUnlock();
    } catch (err) {
      const message = readError(err, "That PIN didn't work.");
      setError(message);
      setPin("");

      // The server's lockout message includes a duration; re-poll the
      // real status rather than parsing it out of prose.
      if (err.response?.status === 429) {
        fetchPinStatus().then((result) => setLockedForSeconds(result.lockedForSeconds || 0));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleChooseComplete = (value) => {
    const code = (value || pin).trim();
    if (code.length !== 4) return;

    setError("");
    setStage("confirm");
  };

  const handleConfirmComplete = async (value) => {
    const code = (value || confirmPin).trim();
    if (code.length !== 4) return;

    if (code !== pin) {
      setError("Those don't match. Choose a PIN again.");
      setPin("");
      setConfirmPin("");
      setStage("choose");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await setPrivateRoomPin({ newPin: code });
      onUnlock();
    } catch (err) {
      setError(readError(err, "Couldn't save that PIN."));
      setPin("");
      setConfirmPin("");
      setStage("choose");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (event) => {
    event.preventDefault();

    if (!accountPassword) {
      setError("Enter your account password");
      return;
    }

    if (resetPin.trim().length !== 4) {
      setError("Choose a 4-digit PIN");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      await resetPrivateRoomPin({ accountPassword, newPin: resetPin.trim() });
      onUnlock();
    } catch (err) {
      setError(readError(err, "Couldn't reset your PIN."));
    } finally {
      setSubmitting(false);
    }
  };

  const locked = lockedForSeconds > 0;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        background: "var(--canvas)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: 18,
          background: "var(--ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 22,
        }}
      >
        {stage === "enter" ? (
          <Lock size={24} strokeWidth={1.7} color="var(--on-ink)" />
        ) : (
          <ShieldCheck size={24} strokeWidth={1.7} color="var(--on-ink)" />
        )}
      </div>

      {loadingStatus ? (
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Checking…</p>
      ) : statusError ? (
        <Alert>{statusError}</Alert>
      ) : (
        <div style={{ width: "100%", maxWidth: 340 }} className="animate-rise">
          {stage === "enter" && (
            <>
              <h2 className="display" style={{ fontSize: 26 }}>
                Enter your PIN
              </h2>
              <p style={{ marginTop: 6, fontSize: 13.5, color: "var(--text-muted)" }}>
                Private Room is locked separately from your account password.
              </p>
            </>
          )}

          {stage === "choose" && (
            <>
              <h2 className="display" style={{ fontSize: 26 }}>
                Choose a PIN
              </h2>
              <p style={{ marginTop: 6, fontSize: 13.5, color: "var(--text-muted)" }}>
                Four digits. You'll need this every time you open Private Room.
              </p>
            </>
          )}

          {stage === "confirm" && (
            <>
              <h2 className="display" style={{ fontSize: 26 }}>
                Confirm your PIN
              </h2>
              <p style={{ marginTop: 6, fontSize: 13.5, color: "var(--text-muted)" }}>
                Type it once more.
              </p>
            </>
          )}

          {stage === "reset" && (
            <>
              <h2 className="display" style={{ fontSize: 26 }}>
                Reset your PIN
              </h2>
              <p style={{ marginTop: 6, fontSize: 13.5, color: "var(--text-muted)" }}>
                Confirm it's you with your account password, then choose a new PIN.
              </p>
            </>
          )}

          {error && !locked && (
            <div style={{ marginTop: 16 }}>
              <Alert>{error}</Alert>
            </div>
          )}

          {locked && (
            <div style={{ marginTop: 16 }}>
              <Alert>
                Too many wrong PINs. Try again in{" "}
                {Math.floor(lockedForSeconds / 60) > 0
                  ? `${Math.floor(lockedForSeconds / 60)}m `
                  : ""}
                {lockedForSeconds % 60}s.
              </Alert>
            </div>
          )}

          <div style={{  marginTop: 22,
    display: "flex",
    justifyContent: "center",
    width: "100%",
    overflow: "hidden", }}>
            {stage === "enter" && (
              <OtpInput
                length={4}
                mask
                value={pin}
                onChange={setPin}
                onComplete={handleEnterComplete}
                disabled={submitting || locked}
                invalid={Boolean(error) && !locked}
                ariaLabel="4-digit Private Room PIN"
              />
            )}

            {stage === "choose" && (
              <OtpInput
                length={4}
                mask
                value={pin}
                onChange={setPin}
                onComplete={handleChooseComplete}
                disabled={submitting}
                ariaLabel="Choose a 4-digit PIN"
              />
            )}

            {stage === "confirm" && (
              <OtpInput
                length={4}
                mask
                value={confirmPin}
                onChange={setConfirmPin}
                onComplete={handleConfirmComplete}
                disabled={submitting}
                invalid={Boolean(error)}
                ariaLabel="Confirm your 4-digit PIN"
              />
            )}
          </div>

          {stage === "reset" && (
            <form onSubmit={handleReset} style={{ textAlign: "left" }}>
              <Field
                label="Account password"
                type="password"
                value={accountPassword}
                onChange={(event) => {
                  setAccountPassword(event.target.value);
                  setError("");
                }}
                placeholder="Your account password"
                autoComplete="current-password"
                autoFocus
              />

              <div style={{ marginTop: 16 }}>
                <span className="field-label">New PIN</span>
                <div style={{ marginTop: 7, display: "flex", justifyContent: "center" }}>
                  <OtpInput
                    length={4}
                    mask
                    value={resetPin}
                    onChange={(value) => {
                      setResetPin(value);
                      setError("");
                    }}
                    disabled={submitting}
                    ariaLabel="New 4-digit PIN"
                  />
                </div>
              </div>

              <Button type="submit" full loading={submitting} loadingLabel="Resetting…" style={{ marginTop: 20 }}>
                Reset PIN
              </Button>
            </form>
          )}

          {submitting && stage !== "reset" && (
            <p className="mono" style={{ marginTop: 16, fontSize: 11, color: "var(--text-faint)" }}>
              checking…
            </p>
          )}

          {stage === "confirm" && !submitting && (
            <Button
              variant="ghost"
              size="sm"
              style={{ marginTop: 18 }}
              onClick={() => {
                setStage("choose");
                setPin("");
                setConfirmPin("");
                setError("");
              }}
            >
              Start over
            </Button>
          )}

          {stage === "enter" && !submitting && (
            <button
              type="button"
              onClick={() => {
                setStage("reset");
                setError("");
                setPin("");
              }}
              style={{
                marginTop: 18,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--text-muted)",
              }}
            >
              Forgot your PIN?
            </button>
          )}

          {stage === "reset" && !submitting && (
            <Button
              variant="ghost"
              size="sm"
              style={{ marginTop: 14 }}
              onClick={() => {
                setStage("enter");
                setError("");
                setAccountPassword("");
                setResetPin("");
              }}
            >
              Back
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
