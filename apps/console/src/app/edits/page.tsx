import type { Metadata } from "next";
import { pageTitle } from "@pandora/core";
import { ConsoleShell } from "../../features/admin/shell/console-shell";
import { fetchPendingEdits } from "../../features/admin/review/edit-actions";
import { EditReviewQueue } from "../../features/admin/review/edit-review-queue";
import { requireStaff } from "../../lib/session";

export const metadata: Metadata = {
  title: pageTitle("Edit Requests - Console"),
};

export default async function EditsPage() {
  const admin = await requireStaff("admin");
  const pendingItems = await fetchPendingEdits();

  return (
    <ConsoleShell staff={admin}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--color-text-primary)" }}>
            Edit Requests
          </h1>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
            Review pending team detail changes, inspect before and after values, and notify teams.
          </p>
        </div>

        <EditReviewQueue initialItems={pendingItems} />
      </div>
    </ConsoleShell>
  );
}
