import type { Metadata } from "next";
import { getOverview } from "@pandora/db";
import { pageTitle } from "@pandora/core";
import { redirect } from "next/navigation";
import { ConsoleShell } from "../features/admin/shell/console-shell";
import { getDb } from "../lib/cf-db";
import { requireStaff } from "../lib/session";

export const metadata: Metadata = { title: pageTitle("Overview - Console") };

export default async function ConsoleHomePage() {
  const staff = await requireStaff();
  if (staff.role === "staff") redirect("/staff");
  const overview = await getOverview(await getDb());
  const cards = [["Teams", overview.teams], ["Members", overview.members], ["Payments pending", overview.paymentPending], ["Edit requests pending", overview.editRequestsPending], ["Episode 0 submissions", overview.submissions], ["Shortlisted teams", overview.shortlisted]] as const;

  return <ConsoleShell staff={staff}><div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
    <div><h1 style={{ margin: 0, fontSize: "1.5rem" }}>Overview</h1><p style={{ margin: "0.25rem 0 0", color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>Current registration and review activity for Pandora.</p></div>
    <section aria-label="Registration summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>{cards.map(([label, value]) => <div key={label} style={{ padding: "1rem", border: "1px solid var(--color-border, #e5e5e5)", borderRadius: "var(--radius-container, 0.5rem)", backgroundColor: "var(--color-background-card, #fff)" }}><p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>{label}</p><p style={{ margin: "0.375rem 0 0", fontSize: "1.75rem", fontWeight: 700 }}>{value.toLocaleString("en-IN")}</p></div>)}</section>
    <section style={{ border: "1px solid var(--color-border, #e5e5e5)", borderRadius: "var(--radius-container, 0.5rem)", backgroundColor: "var(--color-background-card, #fff)" }}><h2 style={{ margin: 0, padding: "1rem", fontSize: "1rem", borderBottom: "1px solid var(--color-border, #e5e5e5)" }}>Teams by track</h2>{Object.keys(overview.byTrack).length === 0 ? <p style={{ margin: 0, padding: "1rem", color: "var(--color-text-secondary)" }}>No teams have registered yet.</p> : Object.entries(overview.byTrack).sort(([a], [b]) => a.localeCompare(b)).map(([track, count]) => <div key={track} style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 1rem", borderTop: "1px solid var(--color-border, #e5e5e5)" }}><span>{track}</span><strong>{count}</strong></div>)}</section>
  </div></ConsoleShell>;
}
