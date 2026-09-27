import type { Metadata } from "next";
import { pageTitle } from "@pandora/core";
import { Wordmark } from "@pandora/ui";
import { redirect } from "next/navigation";
import { SignInForm } from "../../features/admin/sign-in/sign-in-form";
import { currentStaffId } from "../../lib/session";

export const metadata: Metadata = {
  title: pageTitle("Sign in - Console"),
};

export default async function SignInPage() {
  const staffId = await currentStaffId();
  if (staffId) {
    redirect("/");
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        backgroundColor: "var(--color-background-body, #f9fafb)",
        gap: "1.5rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Wordmark size="sm" />
        <span
          style={{
            padding: "0.125rem 0.5rem",
            fontSize: "0.75rem",
            fontWeight: 600,
            borderRadius: "var(--radius-element, 0.375rem)",
            backgroundColor: "var(--color-neutral, #f3f4f6)",
            color: "var(--color-text-secondary, #4b5563)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Console
        </span>
      </div>

      <SignInForm />
    </main>
  );
}
