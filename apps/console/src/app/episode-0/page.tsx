import type { Metadata } from "next";
import { pageTitle } from "@pandora/core";
import { ConsoleShell } from "../../features/admin/shell/console-shell";
import { fetchSubmissions } from "../../features/admin/episode-0/episode-0-actions";
import { Episode0Table } from "../../features/admin/episode-0/episode-0-table";
import { requireStaff } from "../../lib/session";

export const metadata: Metadata = {
  title: pageTitle("Episode 0 Review - Console"),
};

export default async function Episode0Page() {
  const admin = await requireStaff("admin");
  const submissions = await fetchSubmissions();
  const target = parseInt(process.env.SHORTLIST_TARGET ?? "48", 10) || 48;

  return (
    <ConsoleShell staff={admin}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: 700,
              color: "var(--color-text-primary, #111827)",
            }}
          >
            Episode 0 Submissions & Shortlisting
          </h1>
          <p
            style={{
              margin: "0.25rem 0 0",
              fontSize: "0.875rem",
              color: "var(--color-text-secondary, #4b5563)",
            }}
          >
            Review and score Episode 0 project submissions, record notes, and shortlist teams for event day.
          </p>
        </div>

        <Episode0Table initialSubmissions={submissions} target={target} />
      </div>
    </ConsoleShell>
  );
}
