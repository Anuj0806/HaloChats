import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AtSign, Lock, MapPin, Phone, User } from "lucide-react";

import AuthShell from "@/components/AuthShell";
import Field from "@/components/halo/Field";
import Button from "@/components/halo/Button";
import Alert from "@/components/halo/Alert";
import PasswordMeter from "@/components/halo/PasswordMeter";
import { scorePassword } from "@/lib/password";
import { signup } from "../services/authService";
import { readError } from "@/lib/format";

import { sendOTPEmail } from "../services/emailService";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9][0-9\s-]{6,17}$/;

export default function SignupPage() {
  const navigate = useNavigate();
 
  const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };


  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    city: "",   
    password: "",
    confirmPassword: "",
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
    setError("");
  };

  const validate = () => {
    const next = {};

    if (!form.name.trim()) next.name = "Enter your name";
    else if (form.name.trim().length < 2) next.name = "That name looks too short";

    if (!form.email.trim()) next.email = "Enter your email";
    else if (!EMAIL_PATTERN.test(form.email.trim())) next.email = "That doesn't look like an email address";

    if (!form.phoneNumber.trim()) next.phoneNumber = "Enter your phone number";
    else if (!PHONE_PATTERN.test(form.phoneNumber.trim()))
      next.phoneNumber = "Use 7-18 digits, optionally starting with +";

    // The backend requires 6; the meter and this check ask for 8. The
    // stricter of the two wins so nobody creates an account the
    // strength meter would immediately call weak.
    if (!form.password) next.password = "Choose a password";
    else if (scorePassword(form.password).score < 1) next.password = "Use at least 8 characters";

    if (!form.confirmPassword) next.confirmPassword = "Type your password again";
    else if (form.password !== form.confirmPassword) next.confirmPassword = "These don't match";

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!validate()) return;

    try {
      setLoading(true);
      const otp = generateOTP();
      
      // Add OTP into form
        const updatedForm = {
          ...form,
          otp: otp,
        };

        // Update React state
        setForm(updatedForm);

        console.log("Form with OTP:", updatedForm);


      // confirmPassword never leaves the browser - the server only
      // has one password field, and matching is a UI concern.
         // Send OTP through EmailJS
        await sendOTPEmail(
          updatedForm.email.trim().toLowerCase(),
          updatedForm.otp,
          updatedForm.name.trim()
        );
        
        // Signup with OTP included
        await signup(updatedForm);

      navigate("/verify-otp", {
        replace: true,
        state: {  email: updatedForm.email.trim().toLowerCase(),
                  name: updatedForm.name.trim() },
      });
    } catch (err) {
      setError(readError(err, "Couldn't create your account. Try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="display" style={{ fontSize: 36 }}>
        Create your account
      </h1>
      <p className="mt-2 text-[14.5px]" style={{ color: "var(--text-muted)" }}>
        Takes a minute. We'll email a six-digit code to confirm it's you.
      </p>

      {error && (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-[14px]">
        <Field
          label="Full name"
          icon={User}
          name="name"
          value={form.name}
          onChange={update("name")}
          placeholder="Amara Osei"
          autoComplete="name"
          error={fieldErrors.name}
        />

        <Field
          label="Email"
          icon={AtSign}
          type="email"
          name="email"
          value={form.email}
          onChange={update("email")}
          placeholder="you@example.com"
          autoComplete="email"
          error={fieldErrors.email}
        />

        <Field
          label="Phone"
          icon={Phone}
          name="phoneNumber"
          value={form.phoneNumber}
          onChange={update("phoneNumber")}
          placeholder="+91 98765 43210"
          autoComplete="tel"
          inputMode="tel"
          error={fieldErrors.phoneNumber}
          hint={!fieldErrors.phoneNumber ? "This is how other people find you." : undefined}
        />

        <Field
          label="City"
          icon={MapPin}
          name="city"
          value={form.city}
          onChange={update("city")}
          placeholder="Optional"
          autoComplete="address-level2"
          error={fieldErrors.city}
        />

        <div>
          <Field
            label="Password"
            icon={Lock}
            type="password"
            name="password"
            value={form.password}
            onChange={update("password")}
            placeholder="8+ characters"
            autoComplete="new-password"
            error={fieldErrors.password}
          />
          {!fieldErrors.password && <PasswordMeter password={form.password} />}
        </div>

        <Field
          label="Confirm password"
          icon={Lock}
          type="password"
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={update("confirmPassword")}
          placeholder="Type it again"
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
        />

        <Button type="submit" size="lg" full loading={loading} loadingLabel="Creating account…">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-[13.5px]" style={{ color: "var(--text-muted)" }}>
        Already have an account?{" "}
        <Link to="/" className="font-semibold">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
