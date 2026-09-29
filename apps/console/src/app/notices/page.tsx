import type { Metadata } from "next";
import { pageTitle } from "@pandora/core";
import { listNotifications, listNoticeTeams } from "@pandora/db";
import { NoticeComposer } from "../../features/admin/notices/notice-composer";
import { ConsoleShell } from "../../features/admin/shell/console-shell";
import { getDb } from "../../lib/cf-db";
import { requireStaff } from "../../lib/session";

export const metadata: Metadata = {
  title: pageTitle("Notices - Console"),
};

export default async function NoticesPage() {
  const admin = await requireStaff("admin");
  const db = await getDb();
  const [notices, teams] = await Promise.all([listNotifications(db), listNoticeTeams(db)]);

  return (
    <ConsoleShell staff={admin}>
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>Notices</h1>
          <p style={{ margin: "0.25rem 0 0", color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
            Send updates to every team or a specific team.
          </p>
        </div>

        <section aria-labelledby="compose-notice-heading">
          <h2 id="compose-notice-heading" style={{ margin: "0 0 1rem", fontSize: "1.125rem" }}>Compose notice</h2>
          <NoticeComposer teams={teams} />
        </section>

        <section aria-labelledby="sent-notices-heading">
          <h2 id="sent-notices-heading" style={{ margin: "0 0 1rem", fontSize: "1.125rem" }}>Sent notices</h2>
          {notices.length === 0 ? (
            <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>No notices have been sent yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {notices.map((notice) => (
                <article key={notice.id} style={{ border: "1px solid var(--color-border, #e5e5e5)", padding: "1rem", borderRadius: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                    <strong>{notice.title}</strong>
                    <span style={{ color: "var(--color-text-secondary)", fontSize: "0.8125rem" }}>
                      {notice.teamName ?? "All teams"} · {new Date(notice.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                    </span>
                  </div>
                  <p style={{ margin: "0.75rem 0 0", whiteSpace: "pre-wrap" }}>{notice.body}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </ConsoleShell>
  );
}
