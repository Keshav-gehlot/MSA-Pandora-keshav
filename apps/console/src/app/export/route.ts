import { exportTeamsCsv } from "@pandora/db";
import { getDb } from "../../lib/cf-db";
import { requireStaff } from "../../lib/session";

export async function GET() {
  await requireStaff("admin");
  return new Response(await exportTeamsCsv(await getDb()), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="pandora-teams.csv"' } });
}
