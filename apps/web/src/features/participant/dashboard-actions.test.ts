import type { TeamSnapshot } from "@pandora/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireMember = vi.fn();
const mockGetTeamSnapshot = vi.fn();
const mockMarkNotificationRead = vi.fn();
const mockProposeEdit = vi.fn();
const mockSaveSubmission = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock("@pandora/db", () => ({
  getTeamSnapshot: (...args: unknown[]) => mockGetTeamSnapshot(...args),
  markNotificationRead: (...args: unknown[]) => mockMarkNotificationRead(...args),
  proposeEdit: (...args: unknown[]) => mockProposeEdit(...args),
  saveSubmission: (...args: unknown[]) => mockSaveSubmission(...args),
}));
vi.mock("../../lib/cf-db", () => ({ getDb: async () => ({ fake: "db" }) }));
vi.mock("../../lib/session", () => ({ requireMember: () => mockRequireMember() }));
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => mockRevalidatePath(path) }));

import { markRead, submitEdit, submitEpisodeZero } from "./dashboard-actions";

const MEMBER_A = "11111111-1111-4111-8111-111111111111";
const MEMBER_B = "22222222-2222-4222-8222-222222222222";
const MEMBER_C = "33333333-3333-4333-8333-333333333333";
const NOTICE = "44444444-4444-4444-8444-444444444444";

const snapshot: TeamSnapshot = {
  teamName: "Alpha Team",
  track: "Track A",
  members: [MEMBER_A, MEMBER_B, MEMBER_C].map((id, i) => ({
    id,
    firstName: `Member${i + 1}`,
    lastName: "Rao",
    regNumber: `RA261102601061${i + 1}`,
    srmEmail: `member${i + 1}@srmist.edu.in`,
    personalEmail: `member${i + 1}@gmail.com`,
    phone: `987654321${i + 1}`,
  })),
};

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

const SAVED_DEADLINE = process.env.EPISODE_0_DEADLINE;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireMember.mockResolvedValue({ member: { id: "member-1" }, team: { id: "team-1" } });
  mockGetTeamSnapshot.mockResolvedValue(snapshot);
  mockProposeEdit.mockResolvedValue({ ok: true, changes: [] });
  mockSaveSubmission.mockResolvedValue({ ok: true });
  mockMarkNotificationRead.mockResolvedValue(undefined);
  delete process.env.EPISODE_0_DEADLINE;
});

afterEach(() => {
  if (SAVED_DEADLINE === undefined) delete process.env.EPISODE_0_DEADLINE;
  else process.env.EPISODE_0_DEADLINE = SAVED_DEADLINE;
});

describe("markRead", () => {
  it("marks the notice read for the signed-in member's own team, and refreshes the page", async () => {
    expect(await markRead(NOTICE)).toEqual({ ok: true });

    expect(mockRequireMember).toHaveBeenCalledTimes(1);
    expect(mockMarkNotificationRead).toHaveBeenCalledWith(expect.anything(), {
      notificationId: NOTICE,
      memberId: "member-1",
      teamId: "team-1",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/team");
  });

  it("rejects something that isn't a notice id without touching the database", async () => {
    const result = await markRead("not-a-uuid");

    expect(result.ok).toBe(false);
    expect(mockMarkNotificationRead).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("hides a database failure behind a generic message", async () => {
    mockMarkNotificationRead.mockRejectedValue(new Error("connection refused at 10.0.0.5"));

    expect(await markRead(NOTICE)).toEqual({ ok: false, message: "Something went wrong. Please try again." });
  });
});

describe("submitEdit", () => {
  it("sends only what changed for review, for the session's team and member", async () => {
    // A teamId in the form must make no difference: the team always comes from the session.
    const result = await submitEdit(form({ teamId: "someone-elses-team", teamName: "Beta Team" }));

    expect(result).toEqual({ ok: true });
    expect(mockProposeEdit).toHaveBeenCalledTimes(1);
    const input = mockProposeEdit.mock.calls[0]![1];
    expect(input.teamId).toBe("team-1");
    expect(input.memberId).toBe("member-1");
    expect(input.proposed).toEqual({ ...snapshot, teamName: "Beta Team" });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/team");
  });

  it("reports an invalid phone under that member's field and does not propose anything", async () => {
    const result = await submitEdit(form({ [`member.${MEMBER_B}.phone`]: "12" }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.fieldErrors ?? {})).toContain(`members.${MEMBER_B}.phone`);
    expect(mockProposeEdit).not.toHaveBeenCalled();
  });

  it("ignores a member id that isn't on the team", async () => {
    await submitEdit(form({ teamName: "Beta Team", "member.99999999-9999-4999-8999-999999999999.phone": "9111111111" }));

    const proposed = mockProposeEdit.mock.calls[0]![1].proposed as TeamSnapshot;
    expect(proposed.members.map((m) => m.id)).toEqual([MEMBER_A, MEMBER_B, MEMBER_C]);
  });

  it("explains when nothing was changed", async () => {
    mockProposeEdit.mockResolvedValue({ ok: false, reason: "no_changes" });

    expect(await submitEdit(form({}))).toEqual({ ok: false, message: "You haven't changed anything." });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("explains when a change is already waiting for review", async () => {
    mockProposeEdit.mockResolvedValue({ ok: false, reason: "pending_exists" });

    expect(await submitEdit(form({ teamName: "Beta Team" }))).toEqual({
      ok: false,
      message: "You already have a change waiting for review.",
    });
  });

  it("fails safely when the team can't be loaded", async () => {
    mockGetTeamSnapshot.mockResolvedValue(null);

    expect((await submitEdit(form({ teamName: "Beta Team" }))).ok).toBe(false);
    expect(mockProposeEdit).not.toHaveBeenCalled();
  });
});

describe("submitEpisodeZero", () => {
  const good = { repoUrl: "https://github.com/alpha/project", demoUrl: "", notes: "  built it  " };

  it("saves the submission for the session's team, passing the deadline from the environment", async () => {
    process.env.EPISODE_0_DEADLINE = "2026-10-15T23:59:00+05:30";

    expect(await submitEpisodeZero(form({ ...good, teamId: "someone-elses-team" }))).toEqual({ ok: true });

    expect(mockSaveSubmission).toHaveBeenCalledWith(expect.anything(), {
      teamId: "team-1",
      submission: { repoUrl: "https://github.com/alpha/project", demoUrl: null, notes: "built it" },
      deadline: "2026-10-15T23:59:00+05:30",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/team");
  });

  it("reports a bad repository link under its field and saves nothing", async () => {
    const result = await submitEpisodeZero(form({ ...good, repoUrl: "http://insecure.example" }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors).toHaveProperty("repoUrl");
    expect(mockSaveSubmission).not.toHaveBeenCalled();
  });

  it("says so when Episode 0 is closed", async () => {
    mockSaveSubmission.mockResolvedValue({ ok: false, reason: "closed" });

    expect(await submitEpisodeZero(form(good))).toEqual({ ok: false, message: "Episode 0 is closed." });
  });

  it("says the team must be verified first when the server refuses it", async () => {
    mockSaveSubmission.mockResolvedValue({ ok: false, reason: "not_verified" });

    const result = await submitEpisodeZero(form(good));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("needs to be verified");
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
