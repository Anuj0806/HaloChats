import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AtSign, Lock } from "lucide-react";

import AuthShell from "@/components/AuthShell";
import Field from "@/components/halo/Field";
import Button from "@/components/halo/Button";
import Alert from "@/components/halo/Alert";
import { useAuth } from "@/auth/authStore";
import { login } from "../services/authService";
import { readError } from "@/lib/format";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const [form, setForm] = useState({ username: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Set by the OTP screen after a successful verification, and by the
  // reset flow after a password change, so the person gets a reason
  // for being sent back here rather than a bare form.
  const notice = location.state?.notice;

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
    setError("");
  };

  const validate = () => {
    const next = {};

    if (!form.username.trim()) next.username = "Enter your email or phone number";
    if (!form.password) next.password = "Enter your password";

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!validate()) return;

    try {
      setLoading(true);

      const response = await login(form);

      signIn({
        token: response.token,
        phone: response.phone,
        name: response.userName,
        email: form.username.includes("@") ? form.username.trim().toLowerCase() : "",
      });

      navigate(location.state?.from || "/app", { replace: true });
    } catch (err) {
      setError(readError(err, "Couldn't sign you in. Check your details and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="display" style={{ fontSize: 36 }}>
        Welcome back
      </h1>
      <p className="mt-2 text-[14.5px]" style={{ color: "var(--text-muted)" }}>
        Sign in to pick up where you left off.
      </p>

      {notice && (
        <div className="mt-5">
          <Alert tone="ok">{notice}</Alert>
        </div>
      )}

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-[14px]">
        <Field
          label="Email or phone"
          icon={AtSign}
          name="username"
          value={form.username}
          onChange={update("username")}
          placeholder="you@example.com"
          autoComplete="username"
          error={fieldErrors.username}
        />

        <Field
          label="Password"
          icon={Lock}
          type="password"
          name="password"
          value={form.password}
          onChange={update("password")}
          placeholder="Your password"
          autoComplete="current-password"
          error={fieldErrors.password}
        />

        <div className="flex justify-end -mt-1">
          <Link to="/forgot-password" className="text-[13.5px] font-semibold">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" full loading={loading} loadingLabel="Signing in…">
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-[13.5px]" style={{ color: "var(--text-muted)" }}>
        New here?{" "}
        <Link to="/signup" className="font-semibold">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
