import type { TeamSnapshot } from "@pandora/core";
import { describe, expect, it } from "vitest";
import { buildProposedSnapshot, describeChangePath, fieldKeyFromPath, memberFieldName } from "./edit-form";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const snapshot: TeamSnapshot = {
  teamName: "Alpha",
  track: "Track A",
  members: [
    {
      id: A,
      firstName: "Asha",
      lastName: "Rao",
      regNumber: "RA2611026010611",
      srmEmail: "asha@srmist.edu.in",
      personalEmail: "asha@gmail.com",
      phone: "9876543211",
    },
    {
      id: B,
      firstName: "Ben",
      lastName: "Das",
      regNumber: "RA2611026010612",
      srmEmail: "ben@srmist.edu.in",
      personalEmail: "ben@gmail.com",
      phone: "9876543212",
    },
  ],
};

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

describe("buildProposedSnapshot", () => {
  it("overlays only the submitted fields and keeps everything else", () => {
    const proposed = buildProposedSnapshot(
      snapshot,
      form({ teamName: "Beta", [memberFieldName(B, "phone")]: "9000000002" }),
    );

    expect(proposed.teamName).toBe("Beta");
    expect(proposed.track).toBe("Track A");
    expect(proposed.members[0]).toEqual(snapshot.members[0]);
    expect(proposed.members[1]).toEqual({ ...snapshot.members[1], phone: "9000000002" });
  });

  it("does not change the snapshot it was given", () => {
    buildProposedSnapshot(snapshot, form({ teamName: "Beta" }));
    expect(snapshot.teamName).toBe("Alpha");
  });

  it("ignores member ids the team does not have, so nobody else's row can be edited", () => {
    const stranger = "33333333-3333-4333-8333-333333333333";
    const proposed = buildProposedSnapshot(snapshot, form({ [memberFieldName(stranger, "phone")]: "9111111111" }));

    expect(proposed.members.map((m) => m.id)).toEqual([A, B]);
    expect(proposed).toEqual(snapshot);
  });

  it("keeps an unknown track as submitted so validation can reject it", () => {
    expect(buildProposedSnapshot(snapshot, form({ track: "Track Z" })).track).toBe("Track Z");
  });
});

describe("fieldKeyFromPath", () => {
  it("maps team-level paths to their field name", () => {
    expect(fieldKeyFromPath(["teamName"], snapshot)).toBe("teamName");
    expect(fieldKeyFromPath(["track"], snapshot)).toBe("track");
  });

  it("maps a member path to members.<id>.<field> using the member at that position", () => {
    expect(fieldKeyFromPath(["members", 1, "phone"], snapshot)).toBe(`members.${B}.phone`);
  });

  it("returns null for paths it can't place on a field", () => {
    expect(fieldKeyFromPath(["members"], snapshot)).toBeNull();
    expect(fieldKeyFromPath(["members", 9, "phone"], snapshot)).toBeNull();
    expect(fieldKeyFromPath(["somethingElse"], snapshot)).toBeNull();
  });
});

describe("describeChangePath", () => {
  it("describes team-level changes", () => {
    expect(describeChangePath("teamName", snapshot.members)).toBe("Team name");
    expect(describeChangePath("track", snapshot.members)).toBe("Track");
  });

  it("describes a member change with the member's position and first name", () => {
    expect(describeChangePath(`members.${B}.phone`, snapshot.members)).toBe("Member 2 (Ben): Phone number");
  });

  it("falls back to a plain label when the member is unknown", () => {
    expect(describeChangePath("members.nobody.phone", snapshot.members)).toBe("Phone number");
  });
});
