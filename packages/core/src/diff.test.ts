import { describe, expect, it } from "vitest";
import { applyChanges, diffTeam, type TeamSnapshot } from "./diff";

const snap: TeamSnapshot = {
  teamName: "Null Pointers",
  track: "Track A",
  members: [
    { id: "m1", firstName: "A", lastName: "One", regNumber: "RA2611026010691", srmEmail: "a@srmist.edu.in", personalEmail: "a@gmail.com", phone: "9876543211" },
    { id: "m2", firstName: "B", lastName: "Two", regNumber: "RA2611026010692", srmEmail: "b@srmist.edu.in", personalEmail: "b@gmail.com", phone: "9876543212" },
  ],
};

describe("diffTeam", () => {
  it("returns nothing when nothing changed", () => {
    expect(diffTeam(snap, structuredClone(snap))).toEqual([]);
  });
  it("lists team and member field changes with stable paths", () => {
    const next = structuredClone(snap);
    next.teamName = "Segfaults";
    next.members[1]!.phone = "9000000000";
    expect(diffTeam(snap, next)).toEqual([
      { path: "teamName", from: "Null Pointers", to: "Segfaults" },
      { path: "members.m2.phone", from: "9876543212", to: "9000000000" },
    ]);
  });
});

describe("applyChanges", () => {
  it("applies a diff and leaves the original untouched", () => {
    const next = structuredClone(snap);
    next.track = "Track C";
    next.members[0]!.lastName = "Uno";
    const applied = applyChanges(snap, diffTeam(snap, next));
    expect(applied).toEqual(next);
    expect(snap.track).toBe("Track A");
  });
  it("throws on a path that does not exist", () => {
    expect(() => applyChanges(snap, [{ path: "members.m9.phone", from: "", to: "1" }])).toThrow("Unknown member m9");
  });
});
