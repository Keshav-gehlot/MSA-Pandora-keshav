"use client";

import { Banner, Button, Heading, Text, TextInput } from "@pandora/ui";
import { useEffect, useState, type FormEvent } from "react";
import { requestSignInCode, verifySignIn } from "./sign-in-actions";

const RESEND_SECONDS = 60;

type Notice = { status: "info" | "error"; text: string } | null;

// Two screens: 1) enter the SRM email, 2) enter the 6-digit code. The "code is on its way" message is the same
// whether or not the email is registered, so the form can't be used to discover who is registered.
export function SignInForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // Counts the resend wait down once a second; the cleanup stops the timer if the page is left.
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  async function sendCode() {
    setLoading(true);
    setNotice(null);

    try {
      const result = await requestSignInCode(email);

      if (result.ok) {
        setStep("code");
        setSeconds(RESEND_SECONDS);
        setNotice({ status: "info", text: "If this email is registered, a code is on its way." });
      } else {
        setNotice({ status: "error", text: result.message });
      }
    } catch {
      setNotice({ status: "error", text: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  async function checkCode() {
    setLoading(true);
    setNotice(null);

    try {
      // On success the server action redirects to /team, so only a failure comes back here.
      const result = await verifySignIn(email, code);
      setNotice({ status: "error", text: result.message });
    } catch (error) {
      // Next.js implements redirect() by throwing an error with a `digest`; let that one through.
      if (typeof error === "object" && error !== null && "digest" in error) throw error;
      setNotice({ status: "error", text: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void (step === "email" ? sendCode() : checkCode());
  }

  function useDifferentEmail() {
    setStep("email");
    setCode("");
    setNotice(null);
    setSeconds(0);
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
        boxSizing: "border-box",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{ width: "100%", maxWidth: "24rem", display: "flex", flexDirection: "column", gap: "1rem" }}
      >
        <div>
          <Heading level={1}>Sign in</Heading>
          <Text type="supporting" as="p">
            {step === "email"
              ? "Use your SRM email to get a one-time code."
              : `Enter the 6-digit code we sent to ${email}.`}
          </Text>
        </div>

        {notice ? <Banner status={notice.status} title={notice.text} collapsible={false} /> : null}

        {step === "email" ? (
          <>
            <TextInput
              id="sign-in-email"
              type="email"
              label="SRM email"
              placeholder="ra2611026010690@srmist.edu.in"
              value={email}
              onChange={setEmail}
              isRequired
            />
            <Button
              type="submit"
              variant="primary"
              label="Send code"
              isLoading={loading}
              isDisabled={loading || email.trim() === ""}
            />
          </>
        ) : (
          <>
            <TextInput
              id="sign-in-code"
              type="text"
              label="6-digit code"
              placeholder="123456"
              value={code}
              onChange={setCode}
              isRequired
            />
            <Button
              type="submit"
              variant="primary"
              label="Sign in"
              isLoading={loading}
              isDisabled={loading || code.trim().length !== 6}
            />
            <Button
              type="button"
              variant="secondary"
              label={seconds > 0 ? `Resend code in ${seconds}s` : "Resend code"}
              isDisabled={loading || seconds > 0}
              onClick={() => void sendCode()}
            />
            <Button type="button" variant="secondary" label="Use a different email" onClick={useDifferentEmail} />
          </>
        )}
      </form>
    </main>
  );
}
