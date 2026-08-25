import { useState } from "react";
import { Lock } from "lucide-react";

import Modal from "@/components/halo/Modal";
import Field from "@/components/halo/Field";
import Button from "@/components/halo/Button";
import Alert from "@/components/halo/Alert";
import PasswordMeter from "@/components/halo/PasswordMeter";
import { scorePassword } from "@/lib/password";
import { changePassword } from "../../services/authService";
import { readError } from "@/lib/format";

export function ChangePasswordModal({ open, onClose, onDone }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setErrors({});
    setError("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    const next = {};

    if (!form.currentPassword) next.currentPassword = "Enter your current password";

    if (!form.newPassword) next.newPassword = "Choose a new password";
    else if (scorePassword(form.newPassword).score < 1) next.newPassword = "Use at least 8 characters";
    else if (form.newPassword === form.currentPassword)
      next.newPassword = "That's the password you already have";

    if (form.newPassword !== form.confirmPassword) next.confirmPassword = "These don't match";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setError("");

    try {
      setSaving(true);
      await changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      reset();
      onDone("Password updated");
      onClose();
    } catch (err) {
      setError(readError(err, "Couldn't update your password."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Change password"
      description="You'll stay signed in on this device."
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} loadingLabel="Updating…">
            Update password
          </Button>
        </>
      }
    >
      {error && (
        <div style={{ marginBottom: 14 }}>
          <Alert>{error}</Alert>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field
          label="Current password"
          icon={Lock}
          type="password"
          value={form.currentPassword}
          onChange={(e) => {
            setForm((c) => ({ ...c, currentPassword: e.target.value }));
            setErrors((c) => ({ ...c, currentPassword: "" }));
          }}
          autoComplete="current-password"
          error={errors.currentPassword}
        />

        <div>
          <Field
            label="New password"
            icon={Lock}
            type="password"
            value={form.newPassword}
            onChange={(e) => {
              setForm((c) => ({ ...c, newPassword: e.target.value }));
              setErrors((c) => ({ ...c, newPassword: "" }));
            }}
            placeholder="8+ characters"
            autoComplete="new-password"
            error={errors.newPassword}
          />
          {!errors.newPassword && <PasswordMeter password={form.newPassword} />}
        </div>

        <Field
          label="Confirm new password"
          icon={Lock}
          type="password"
          value={form.confirmPassword}
          onChange={(e) => {
            setForm((c) => ({ ...c, confirmPassword: e.target.value }));
            setErrors((c) => ({ ...c, confirmPassword: "" }));
          }}
          autoComplete="new-password"
          error={errors.confirmPassword}
        />
      </div>
    </Modal>
  );
}

/**
 * Destructive confirmation. The action's own verb goes on the button
 * ("Delete", "Erase") rather than a generic "OK", so the last thing
 * someone reads before clicking is what will actually happen.
 */
export function ConfirmModal({ open, title, description, confirmLabel = "Confirm", onConfirm, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      width={400}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div />
    </Modal>
  );
}
