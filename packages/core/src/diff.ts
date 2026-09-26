import type { Track } from "./config";
import type { Member } from "./rules";

export type TeamSnapshot = { teamName: string; track: Track; members: Array<{ id: string } & Member> };
export type FieldChange = { path: string; from: string; to: string };

const MEMBER_FIELDS = ["firstName", "lastName", "regNumber", "srmEmail", "personalEmail", "phone"] as const;
type MemberField = (typeof MEMBER_FIELDS)[number];

export function diffTeam(current: TeamSnapshot, proposed: TeamSnapshot): FieldChange[] {
  const changes: FieldChange[] = [];
  if (current.teamName !== proposed.teamName) changes.push({ path: "teamName", from: current.teamName, to: proposed.teamName });
  if (current.track !== proposed.track) changes.push({ path: "track", from: current.track, to: proposed.track });
  for (const before of current.members) {
    const after = proposed.members.find((m) => m.id === before.id);
    if (!after) continue;
    for (const field of MEMBER_FIELDS) {
      if (before[field] !== after[field]) changes.push({ path: `members.${before.id}.${field}`, from: before[field], to: after[field] });
    }
  }
  return changes;
}

export function applyChanges(snapshot: TeamSnapshot, changes: FieldChange[]): TeamSnapshot {
  const next = structuredClone(snapshot);
  for (const change of changes) {
    if (change.path === "teamName") next.teamName = change.to;
    else if (change.path === "track") next.track = change.to as Track;
    else {
      const [, id, field] = change.path.split(".");
      const member = next.members.find((m) => m.id === id);
      if (!member) throw new Error(`Unknown member ${id}`);
      if (!MEMBER_FIELDS.includes(field as MemberField)) throw new Error(`Unknown field ${field}`);
      member[field as MemberField] = change.to;
    }
  }
  return next;
}
