import type { Metadata } from "next";
import { pageTitle } from "@pandora/core";
import { Wordmark } from "@pandora/ui";
import { UserMenu } from "../../features/admin/shell/user-menu";
import { requireStaff } from "../../lib/session";

export const metadata: Metadata = {
  title: pageTitle("Staff Portal - Console"),
};

export default async function StaffPortalPage() {
  // Protect route: redirects unauthenticated requests to "/sign-in".
  // Allows both "staff" and "admin" roles.
  const staff = await requireStaff();

  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--color-background-body, #f9fafb)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "1.25rem",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          width: "100%",
          maxWidth: "480px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Wordmark size="sm" />
          <span
            style={{
              padding: "0.125rem 0.5rem",
              fontSize: "0.6875rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              borderRadius: "var(--radius-element, 0.25rem)",
              backgroundColor: "var(--color-neutral, #f3f4f6)",
              color: "var(--color-text-secondary, #4b5563)",
            }}
          >
            Staff Portal
          </span>
        </div>
      </header>

      <main
        style={{
          width: "100%",
          maxWidth: "480px",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        {/* User Card */}
        <UserMenu name={staff.name} email={staff.email} role={staff.role} />

        {/* Status Card / Placeholder */}
        <div
          style={{
            padding: "1.5rem",
            borderRadius: "var(--radius-container, 0.75rem)",
            backgroundColor: "var(--color-background-card, #ffffff)",
            border: "1px solid var(--color-border, #e5e5e5)",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "var(--color-success, #16a34a)",
              }}
            />
            <h2
              style={{
                margin: 0,
                fontSize: "1rem",
                fontWeight: 600,
                color: "var(--color-text-primary, #111827)",
              }}
            >
              Staff Check-in Portal
            </h2>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: "0.875rem",
              lineHeight: 1.5,
              color: "var(--color-text-secondary, #4b5563)",
            }}
          >
            Welcome, {staff.name}. QR code ticket scanning and manual attendee search will activate with
            Flow D (Task D3).
          </p>

          <div
            style={{
              marginTop: "0.5rem",
              padding: "0.75rem 1rem",
              borderRadius: "var(--radius-element, 0.375rem)",
              backgroundColor: "var(--color-neutral, #f3f4f6)",
              fontSize: "0.75rem",
              color: "var(--color-text-secondary, #6b7280)",
              lineHeight: 1.4,
            }}
          >
            On event day, this screen will be used on mobile devices to check in shortlisted participants.
          </div>
        </div>
      </main>
    </div>
  );
}
