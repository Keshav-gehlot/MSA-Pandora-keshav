import type { Track, TeamSnapshot } from "@pandora/core";

export const MEMBER_FIELDS = [
  { key: "firstName", label: "First name", type: "text" },
  { key: "lastName", label: "Last name", type: "text" },
  { key: "regNumber", label: "Registration number", type: "text" },
  { key: "srmEmail", label: "SRM email", type: "email" },
  { key: "personalEmail", label: "Personal email", type: "email" },
  { key: "phone", label: "Phone number", type: "text" },
] as const;

export type MemberFieldKey = (typeof MEMBER_FIELDS)[number]["key"];

export function memberFieldName(memberId: string, field: MemberFieldKey): string {
  return `member.${memberId}.${field}`;
}

// Overlays submitted form values on the current snapshot. A field missing from the form keeps its current value,
// and ids the team doesn't have are ignored because only the snapshot's own members are read. An unknown track
// is kept as submitted so validation can report it.
export function buildProposedSnapshot(current: TeamSnapshot, form: FormData): TeamSnapshot {
  const text = (name: string): string | undefined => {
    const value = form.get(name);
    return typeof value === "string" ? value : undefined;
  };

  const teamName = text("teamName");
  const track = text("track");

  return {
    teamName: teamName ?? current.teamName,
    track: track === undefined ? current.track : (track as Track),
    members: current.members.map((member) => {
      const next = { ...member };
      for (const { key } of MEMBER_FIELDS) {
        const value = text(memberFieldName(member.id, key));
        if (value !== undefined) next[key] = value;
      }
      return next;
    }),
  };
}

// Turns a zod-style issue path into the field key the form uses: "teamName", "track" or "members.<id>.<field>".
export function fieldKeyFromPath(path: ReadonlyArray<PropertyKey>, snapshot: TeamSnapshot): string | null {
  const [first, index, field] = path;
  if (first === "teamName" || first === "track") return first;
  if (first === "members" && typeof index === "number" && typeof field === "string") {
    const member = snapshot.members[index];
    return member ? `members.${member.id}.${field}` : null;
  }
  return null;
}

const FIELD_LABELS: Record<string, string> = Object.fromEntries(MEMBER_FIELDS.map((f) => [f.key, f.label]));

// Readable label for a change path, using the member's current name where we know it.
export function describeChangePath(path: string, members: ReadonlyArray<{ id: string; firstName: string }>): string {
  if (path === "teamName") return "Team name";
  if (path === "track") return "Track";
  const [, id, field] = path.split(".");
  const label = (field && FIELD_LABELS[field]) || "Detail";
  const index = members.findIndex((m) => m.id === id);
  return index >= 0 ? `Member ${index + 1} (${members[index]!.firstName}): ${label}` : label;
}
