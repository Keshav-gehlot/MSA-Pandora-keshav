import type { Metadata } from "next";
import Link from "next/link";
import { pageTitle } from "@pandora/core";
import { attendanceSummary, getDb } from "@pandora/db";
import { Wordmark } from "@pandora/ui";
import { UserMenu } from "../../../features/admin/shell/user-menu";
import { requireStaff } from "../../../lib/session";
import { AttendanceView } from "./attendance-view";

export const metadata: Metadata = {
  title: pageTitle("Event Attendance - Console"),
};

export default async function StaffAttendancePage() {
  const staff = await requireStaff();
  const db = getDb();
  const initialRows = await attendanceSummary(db);

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
          marginBottom: "1rem",
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

        <Link
          href="/staff"
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "#2563eb",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          ← Back to Scanner
        </Link>
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
        <UserMenu name={staff.name} email={staff.email} role={staff.role} />
        <AttendanceView initialData={initialRows} />
      </main>
    </div>
  );
}
