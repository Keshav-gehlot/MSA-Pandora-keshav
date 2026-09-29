import type { Metadata } from "next";
import Link from "next/link";
import { listTeams } from "@pandora/db";
import { TRACKS, pageTitle } from "@pandora/core";
import { ConsoleShell } from "../../features/admin/shell/console-shell";
import { getDb } from "../../lib/cf-db";
import { requireStaff } from "../../lib/session";

export const metadata: Metadata = { title: pageTitle("Teams - Console") };
const PAGE_SIZE = 50;
type Props = { searchParams: Promise<{ search?: string; track?: string; shortlistStatus?: string; offset?: string }> };

function href(search: string | undefined, track: string | undefined, status: string | undefined, offset: number) {
  const params = new URLSearchParams();
  if (search) params.set("search", search); if (track) params.set("track", track); if (status) params.set("shortlistStatus", status); if (offset) params.set("offset", String(offset));
  return `/teams${params.size ? `?${params}` : ""}`;
}

export default async function TeamsPage({ searchParams }: Props) {
  const admin = await requireStaff("admin");
  const params = await searchParams;
  const offset = Math.max(0, Number.parseInt(params.offset ?? "0", 10) || 0);
  const shortlistStatus = ["pending", "shortlisted", "not_shortlisted"].includes(params.shortlistStatus ?? "") ? params.shortlistStatus as "pending" | "shortlisted" | "not_shortlisted" : undefined;
  const search = params.search?.trim() || undefined;
  const track = params.track || undefined;
  const rows = await listTeams(await getDb(), { search, track, shortlistStatus, limit: PAGE_SIZE, offset });
  return <ConsoleShell staff={admin}><div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}><div><h1 style={{ margin: 0, fontSize: "1.5rem" }}>Teams</h1><p style={{ margin: "0.25rem 0 0", color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>Search teams and members.</p></div><Link href="/export">Download CSV</Link></div>
    <form action="/teams" method="get" style={{ display: "grid", gridTemplateColumns: "minmax(200px, 2fr) 1fr 1fr auto", gap: "0.75rem", padding: "1rem", border: "1px solid var(--color-border, #e5e5e5)", borderRadius: "var(--radius-container, .5rem)" }}><input name="search" defaultValue={search} placeholder="Team, member, registration number, or SRM email" aria-label="Search teams" /><select name="track" defaultValue={track ?? ""}><option value="">All tracks</option>{TRACKS.map((item) => <option key={item} value={item}>{item}</option>)}</select><select name="shortlistStatus" defaultValue={shortlistStatus ?? ""}><option value="">All statuses</option><option value="pending">Pending</option><option value="shortlisted">Shortlisted</option><option value="not_shortlisted">Not shortlisted</option></select><button type="submit">Apply</button></form>
    <div style={{ overflowX: "auto", border: "1px solid var(--color-border, #e5e5e5)", borderRadius: "var(--radius-container, .5rem)" }}><table style={{ width: "100%", minWidth: "700px", borderCollapse: "collapse", textAlign: "left" }}><thead><tr>{["Team", "Track", "Leader", "Members", "Payment", "Shortlist", "Registered"].map((title) => <th key={title} style={{ padding: ".75rem 1rem", fontSize: ".75rem" }}>{title}</th>)}</tr></thead><tbody>{rows.map((team) => <tr key={team.id} style={{ borderTop: "1px solid var(--color-border, #e5e5e5)" }}><td style={{ padding: ".75rem 1rem" }}><Link href={`/teams/${team.id}`}>{team.name}</Link></td><td>{team.track}</td><td>{team.leaderName}</td><td>{team.memberCount}</td><td>{team.paymentStatus.replaceAll("_", " ")}</td><td>{team.shortlistStatus.replaceAll("_", " ")}</td><td>{team.createdAt.toLocaleDateString("en-IN")}</td></tr>)}{rows.length === 0 && <tr><td colSpan={7} style={{ padding: "2rem", textAlign: "center" }}>No teams match these filters.</td></tr>}</tbody></table></div>
    <nav aria-label="Teams pagination" style={{ display: "flex", justifyContent: "space-between" }}>{offset > 0 ? <Link href={href(search, track, shortlistStatus, Math.max(0, offset - PAGE_SIZE))}>Previous</Link> : <span />}{rows.length === PAGE_SIZE && <Link href={href(search, track, shortlistStatus, offset + PAGE_SIZE)}>Next</Link>}</nav>
  </div></ConsoleShell>;
}
