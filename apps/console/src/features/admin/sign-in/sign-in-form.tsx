"use client";

import { useEffect, useState, useTransition } from "react";
import { requestStaffCode, verifyStaffSignIn } from "./actions";

export function SignInForm() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isPending, startTransition] = useTransition();

  // Handle countdown for resending OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleRequestCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await requestStaffCode(email);
      if (res.ok) {
        setStep("code");
        setResendCooldown(60);
      } else {
        setError(res.message);
      }
    });
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await verifyStaffSignIn(email, code);
      if (res && !res.ok) {
        setError(res.message);
      }
    });
  };

  const handleResend = () => {
    if (resendCooldown > 0 || isPending) return;
    setError(null);

    startTransition(async () => {
      const res = await requestStaffCode(email);
      if (res.ok) {
        setResendCooldown(60);
      } else {
        setError(res.message);
      }
    });
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "400px",
        padding: "2rem",
        borderRadius: "var(--radius-container, 0.75rem)",
        backgroundColor: "var(--color-background-card, #ffffff)",
        border: "1px solid var(--color-border, #e5e5e5)",
        boxShadow: "var(--shadow-med, 0 4px 12px rgba(0, 0, 0, 0.05))",
      }}
    >
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0, color: "var(--color-text-primary)" }}>
          {step === "email" ? "Console Sign-in" : "Enter Verification Code"}
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", marginTop: "0.5rem", marginBottom: 0 }}>
          {step === "email"
            ? "Enter your staff email to receive a sign-in code."
            : `We sent a 6-digit code to ${email}. If the address is registered, it will arrive shortly.`}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            borderRadius: "var(--radius-element, 0.5rem)",
            backgroundColor: "var(--color-background-red, #fee2e2)",
            border: "1px solid var(--color-border-red, #fca5a5)",
            color: "var(--color-text-red, #991b1b)",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      {step === "email" ? (
        <form onSubmit={handleRequestCode} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label
              htmlFor="email"
              style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.375rem" }}
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@msasrm.in"
              disabled={isPending}
              style={{
                width: "100%",
                padding: "0.625rem 0.75rem",
                borderRadius: "var(--radius-element, 0.5rem)",
                border: "1px solid var(--color-border, #d1d5db)",
                backgroundColor: "var(--color-background-surface, #ffffff)",
                color: "var(--color-text-primary)",
                fontSize: "0.875rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isPending || !email.trim()}
            style={{
              width: "100%",
              padding: "0.625rem 1rem",
              borderRadius: "var(--radius-element, 0.5rem)",
              backgroundColor: "var(--color-accent, #2563eb)",
              color: "var(--color-on-accent, #ffffff)",
              border: "none",
              fontWeight: 500,
              fontSize: "0.875rem",
              cursor: isPending || !email.trim() ? "not-allowed" : "pointer",
              opacity: isPending || !email.trim() ? 0.7 : 1,
              transition: "opacity 0.15s ease",
            }}
          >
            {isPending ? "Sending code..." : "Send sign-in code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label
              htmlFor="otp-code"
              style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, marginBottom: "0.375rem" }}
            >
              6-digit code
            </label>
            <input
              id="otp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              disabled={isPending}
              style={{
                width: "100%",
                padding: "0.625rem 0.75rem",
                borderRadius: "var(--radius-element, 0.5rem)",
                border: "1px solid var(--color-border, #d1d5db)",
                backgroundColor: "var(--color-background-surface, #ffffff)",
                color: "var(--color-text-primary)",
                fontSize: "1.25rem",
                letterSpacing: "0.25em",
                textAlign: "center",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isPending || code.length !== 6}
            style={{
              width: "100%",
              padding: "0.625rem 1rem",
              borderRadius: "var(--radius-element, 0.5rem)",
              backgroundColor: "var(--color-accent, #2563eb)",
              color: "var(--color-on-accent, #ffffff)",
              border: "none",
              fontWeight: 500,
              fontSize: "0.875rem",
              cursor: isPending || code.length !== 6 ? "not-allowed" : "pointer",
              opacity: isPending || code.length !== 6 ? 0.7 : 1,
              transition: "opacity 0.15s ease",
            }}
          >
            {isPending ? "Verifying..." : "Verify and sign in"}
          </button>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "0.5rem",
              fontSize: "0.8125rem",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              disabled={isPending}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "var(--color-text-secondary)",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Change email
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0 || isPending}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: resendCooldown > 0 ? "var(--color-text-disabled)" : "var(--color-accent)",
                cursor: resendCooldown > 0 || isPending ? "not-allowed" : "pointer",
              }}
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
