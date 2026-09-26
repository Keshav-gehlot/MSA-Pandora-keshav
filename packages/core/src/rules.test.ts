import { describe, expect, it } from "vitest";
import { registrationSchema, teamNameKey, otpCodeSchema, phoneSchema } from "./rules";

const member = (n: number) => ({
  firstName: ` Member${n} `,
  lastName: "Test",
  regNumber: `ra261102601069${n}`,
  srmEmail: `M${n}@SRMIST.EDU.IN`,
  personalEmail: `m${n}@gmail.com`,
  phone: `+91 98765 4321${n}`,
});

describe("registrationSchema", () => {
  it("accepts a team of three and normalizes every field", () => {
    const r = registrationSchema.parse({ teamName: "  Null Pointers ", track: "Track A", members: [member(1), member(2), member(3)] });
    expect(r.teamName).toBe("Null Pointers");
    expect(r.members[0]).toEqual({
      firstName: "Member1",
      lastName: "Test",
      regNumber: "RA2611026010691",
      srmEmail: "m1@srmist.edu.in",
      personalEmail: "m1@gmail.com",
      phone: "9876543211",
    });
  });

  it("accepts four members and rejects two or five", () => {
    const base = { teamName: "Null Pointers", track: "Track B" };
    expect(registrationSchema.safeParse({ ...base, members: [1, 2, 3, 4].map(member) }).success).toBe(true);
    expect(registrationSchema.safeParse({ ...base, members: [1, 2].map(member) }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...base, members: [1, 2, 3, 4, 5].map(member) }).success).toBe(false);
  });

  it("rejects an email outside srmist.edu.in with a helpful message", () => {
    const r = registrationSchema.safeParse({ teamName: "Null Pointers", track: "Track A", members: [{ ...member(1), srmEmail: "a@gmail.com" }, member(2), member(3)] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Use your @srmist.edu.in email");
    expect(r.error?.issues[0]?.path).toEqual(["members", 0, "srmEmail"]);
  });

  it("rejects malformed registration numbers and phones", () => {
    const bad = registrationSchema.safeParse({ teamName: "Null Pointers", track: "Track A", members: [{ ...member(1), regNumber: "RA123" }, { ...member(2), phone: "12345" }, member(3)] });
    expect(bad.error?.issues.map((i) => i.path.join("."))).toEqual(["members.0.regNumber", "members.1.phone"]);
  });

  it("rejects the same registration number or SRM email twice in one team", () => {
    const dup = registrationSchema.safeParse({ teamName: "Null Pointers", track: "Track A", members: [member(1), { ...member(2), regNumber: "RA2611026010691" }, { ...member(3), srmEmail: "m1@srmist.edu.in" }] });
    expect(dup.error?.issues.map((i) => [i.path.join("."), i.message])).toEqual([
      ["members.1.regNumber", "Each member needs a different registration number"],
      ["members.2.srmEmail", "Each member needs a different SRM email"],
    ]);
  });

  it("rejects an unknown track", () => {
    expect(registrationSchema.safeParse({ teamName: "Null Pointers", track: "Track Z", members: [1, 2, 3].map(member) }).success).toBe(false);
  });
});

describe("helpers", () => {
  it("teamNameKey ignores case and extra spaces", () => {
    expect(teamNameKey("  Null   POINTERS ")).toBe("null pointers");
  });
  it("otpCodeSchema accepts exactly six digits", () => {
    expect(otpCodeSchema.safeParse(" 012345 ").success).toBe(true);
    expect(otpCodeSchema.safeParse("12345").success).toBe(false);
  });
  it("phoneSchema strips spaces, hyphens and +91", () => {
    expect(phoneSchema.parse("+91 98765-43210")).toBe("9876543210");
  });
});
