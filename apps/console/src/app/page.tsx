import type { Metadata } from "next";
import { pageTitle } from "@pandora/core";
import { redirect } from "next/navigation";
import { ConsoleShell } from "../features/admin/shell/console-shell";
import { requireStaff } from "../lib/session";

export const metadata: Metadata = {
  title: pageTitle("Overview - Console"),
};

export default async function ConsoleHomePage() {
  // Use requireStaff() without arguments here: requireStaff("admin") redirects non-admins
  // to "/", which would cause an infinite redirect loop.
  const staff = await requireStaff();

  if (staff.role === "staff") {
    redirect("/staff");
  }

  return (
    <ConsoleShell staff={staff}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
            Overview
          </h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
            Welcome back, {staff.name}. Select a section from the navigation to manage Pandora.
          </p>
        </div>

        <div
          style={{
            padding: "2rem",
            borderRadius: "var(--radius-container, 0.75rem)",
            backgroundColor: "var(--color-background-card, #ffffff)",
            border: "1px solid var(--color-border, #e5e5e5)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: "0.5rem",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 500, color: "var(--color-text-primary)" }}>
            Admin Shell Ready
          </p>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-text-secondary)", maxWidth: "420px" }}>
            The console shell and sign-in foundation are active. Detailed overview statistics, team management, and review
            queues will connect in subsequent admin modules.
          </p>
        </div>
      </div>
    </ConsoleShell>
  );
}
