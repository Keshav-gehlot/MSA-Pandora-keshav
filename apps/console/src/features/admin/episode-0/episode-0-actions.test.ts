import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/cache
const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}));

// Mock @pandora/db
const listSubmissionsMock = vi.fn();
const reviewSubmissionMock = vi.fn();
const setShortlistStatusMock = vi.fn();
const issuePassesForTeamMock = vi.fn();
const getTeamDetailMock = vi.fn();

vi.mock("@pandora/db", () => ({
  listSubmissions: (...args: unknown[]) => listSubmissionsMock(...args),
  reviewSubmission: (...args: unknown[]) => reviewSubmissionMock(...args),
  setShortlistStatus: (...args: unknown[]) => setShortlistStatusMock(...args),
  issuePassesForTeam: (...args: unknown[]) => issuePassesForTeamMock(...args),
  getTeamDetail: (...args: unknown[]) => getTeamDetailMock(...args),
}));

// Mock cf-db
const getDbMock = vi.fn(() => ({}));
vi.mock("../../../lib/cf-db", () => ({
  getDb: async () => getDbMock(),
}));

// Mock session
const requireStaffMock = vi.fn();
vi.mock("../../../lib/session", () => ({
  requireStaff: (...args: unknown[]) => requireStaffMock(...args),
}));

const sendEmailMock = vi.fn();
vi.mock("@pandora/email", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

import {
  fetchSubmissions,
  resendPassEmailAction,
  submitReviewAction,
  updateShortlistAction,
} from "./episode-0-actions";

function restorePassSecret(previousSecret: string | undefined) {
  if (previousSecret === undefined) {
    delete process.env.PASS_SECRET;
  } else {
    process.env.PASS_SECRET = previousSecret;
  }
}

describe("episode-0-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireStaffMock.mockResolvedValue({
      id: "admin-1",
      email: "admin@srmist.edu.in",
      role: "admin",
      name: "Admin",
    });
  });

  describe("fetchSubmissions", () => {
    it("fetches submissions after requiring admin auth", async () => {
      const updatedAt = new Date("2026-10-01T10:00:00Z");
      listSubmissionsMock.mockResolvedValueOnce([
        {
          submissionId: "sub-1",
          teamId: "team-1",
          teamName: "Alpha",
          track: "Track A",
          repoUrl: "https://github.com/alpha/repo",
          demoUrl: "https://alpha.demo.com",
          notes: "Demo note",
          score: 85,
          reviewNote: "Good work",
          shortlistStatus: "pending",
          updatedAt,
        },
      ]);

      const items = await fetchSubmissions();
      expect(requireStaffMock).toHaveBeenCalledWith("admin");
      expect(items).toEqual([
        {
          submissionId: "sub-1",
          teamId: "team-1",
          teamName: "Alpha",
          track: "Track A",
          repoUrl: "https://github.com/alpha/repo",
          demoUrl: "https://alpha.demo.com",
          notes: "Demo note",
          score: 85,
          reviewNote: "Good work",
          shortlistStatus: "pending",
          updatedAt,
        },
      ]);
    });
  });

  describe("submitReviewAction", () => {
    it("submits a valid review, calls db, and revalidates", async () => {
      reviewSubmissionMock.mockResolvedValueOnce({ ok: true });

      const res = await submitReviewAction("sub-1", "90", "Excellent demo and docs");
      expect(res).toEqual({ ok: true });
      expect(reviewSubmissionMock).toHaveBeenCalledWith(expect.anything(), {
        submissionId: "sub-1",
        staffId: "admin-1",
        score: 90,
        reviewNote: "Excellent demo and docs",
      });
      expect(revalidatePathMock).toHaveBeenCalledWith("/episode-0");
    });

    it("rejects score over 100", async () => {
      const res = await submitReviewAction("sub-1", 101, "Great");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toContain("at most 100");
      }
      expect(reviewSubmissionMock).not.toHaveBeenCalled();
    });

    it("rejects negative score", async () => {
      const res = await submitReviewAction("sub-1", -1, "Great");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toContain("at least 0");
      }
      expect(reviewSubmissionMock).not.toHaveBeenCalled();
    });

    it("rejects non-integer score", async () => {
      const res = await submitReviewAction("sub-1", "85.5", "Great");
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toContain("whole number");
      }
      expect(reviewSubmissionMock).not.toHaveBeenCalled();
    });

    it("rejects reviewNote exceeding 1000 characters", async () => {
      const res = await submitReviewAction("sub-1", 80, "x".repeat(1001));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.message).toContain("at most 1000 characters");
      }
      expect(reviewSubmissionMock).not.toHaveBeenCalled();
    });

    it("handles unknown submission error", async () => {
      reviewSubmissionMock.mockResolvedValueOnce({ ok: false });

      const res = await submitReviewAction("sub-unknown", 75, "Okay");
      expect(res).toEqual({ ok: false, message: "Submission not found" });
    });
  });

  describe("updateShortlistAction", () => {
    it("issues passes and emails every member after shortlisting", async () => {
      setShortlistStatusMock.mockResolvedValueOnce({ ok: true });
      issuePassesForTeamMock.mockResolvedValueOnce({ ok: true, issued: 2 });
      getTeamDetailMock.mockResolvedValueOnce({
        team: { name: "Alpha" },
        members: [
          { firstName: "Ada", srmEmail: "ada@srmist.edu.in" },
          { firstName: "Lin", srmEmail: "lin@srmist.edu.in" },
        ],
      });
      sendEmailMock.mockResolvedValue({ ok: true });

      const previousSecret = process.env.PASS_SECRET;
      process.env.PASS_SECRET = "test-pass-secret";
      const res = await updateShortlistAction("team-1", "shortlisted");
      restorePassSecret(previousSecret);

      expect(res).toEqual({ ok: true });
      expect(setShortlistStatusMock).toHaveBeenCalledWith(expect.anything(), {
        teamId: "team-1",
        staffId: "admin-1",
        status: "shortlisted",
      });
      expect(issuePassesForTeamMock).toHaveBeenCalledWith(expect.anything(), {
        teamId: "team-1",
        secret: "test-pass-secret",
      });
      expect(sendEmailMock).toHaveBeenCalledTimes(2);
      expect(sendEmailMock).toHaveBeenCalledWith({
        to: "ada@srmist.edu.in",
        template: "checkin-pass-ready",
        props: {
          firstName: "Ada",
          teamName: "Alpha",
          dashboardUrl: "https://pandora.msasrm.in/team",
        },
      });
      expect(revalidatePathMock).toHaveBeenCalledWith("/episode-0");
    });

    it("does not email members again when passes already exist", async () => {
      setShortlistStatusMock.mockResolvedValue({ ok: true });
      issuePassesForTeamMock
        .mockResolvedValueOnce({ ok: true, issued: 2 })
        .mockResolvedValueOnce({ ok: true, issued: 0 });
      getTeamDetailMock.mockResolvedValueOnce({
        team: { name: "Alpha" },
        members: [
          { firstName: "Ada", srmEmail: "ada@srmist.edu.in" },
          { firstName: "Lin", srmEmail: "lin@srmist.edu.in" },
        ],
      });
      sendEmailMock.mockResolvedValue({ ok: true });

      const previousSecret = process.env.PASS_SECRET;
      process.env.PASS_SECRET = "test-pass-secret";
      try {
        await updateShortlistAction("team-1", "shortlisted");
        await updateShortlistAction("team-1", "shortlisted");
      } finally {
        restorePassSecret(previousSecret);
      }

      expect(issuePassesForTeamMock).toHaveBeenCalledTimes(2);
      expect(getTeamDetailMock).toHaveBeenCalledTimes(1);
      expect(sendEmailMock).toHaveBeenCalledTimes(2);
      expect(revalidatePathMock).toHaveBeenCalledTimes(2);
    });

    it("keeps the shortlist but warns when the pass secret is missing", async () => {
      setShortlistStatusMock.mockResolvedValueOnce({ ok: true });
      const previousSecret = process.env.PASS_SECRET;
      delete process.env.PASS_SECRET;

      const res = await updateShortlistAction("team-1", "shortlisted");
      restorePassSecret(previousSecret);

      expect(res).toEqual({
        ok: true,
        warning: "Team shortlisted, but event passes could not be issued because PASS_SECRET is not configured",
      });
      expect(issuePassesForTeamMock).not.toHaveBeenCalled();
      expect(sendEmailMock).not.toHaveBeenCalled();
      expect(revalidatePathMock).toHaveBeenCalledWith("/episode-0");
    });

    it("warns when pass-ready emails cannot be sent without undoing the shortlist", async () => {
      setShortlistStatusMock.mockResolvedValueOnce({ ok: true });
      issuePassesForTeamMock.mockResolvedValueOnce({ ok: true, issued: 2 });
      getTeamDetailMock.mockResolvedValueOnce({
        team: { name: "Alpha" },
        members: [
          { firstName: "Ada", srmEmail: "ada@srmist.edu.in" },
          { firstName: "Lin", srmEmail: "lin@srmist.edu.in" },
        ],
      });
      sendEmailMock
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, error: "Mail service unavailable" });

      const previousSecret = process.env.PASS_SECRET;
      process.env.PASS_SECRET = "test-pass-secret";
      const res = await updateShortlistAction("team-1", "shortlisted");
      restorePassSecret(previousSecret);

      expect(res).toEqual({
        ok: true,
        warning: "Team shortlisted and passes issued, but could not send email to 1 of 2 member(s). Use \"Resend pass email\" to retry",
      });
      expect(issuePassesForTeamMock).toHaveBeenCalledTimes(1);
      expect(revalidatePathMock).toHaveBeenCalledWith("/episode-0");
    });

    it("warns when pass issuance reports that the team is not shortlisted", async () => {
      setShortlistStatusMock.mockResolvedValueOnce({ ok: true });
      issuePassesForTeamMock.mockResolvedValueOnce({ ok: false, reason: "not_shortlisted" });

      const previousSecret = process.env.PASS_SECRET;
      process.env.PASS_SECRET = "test-pass-secret";
      let res: Awaited<ReturnType<typeof updateShortlistAction>>;
      try {
        res = await updateShortlistAction("team-1", "shortlisted");
      } finally {
        restorePassSecret(previousSecret);
      }

      expect(res!).toEqual({
        ok: true,
        warning: "Team shortlisted, but event passes could not be issued; shortlist again to retry",
      });
      expect(getTeamDetailMock).not.toHaveBeenCalled();
      expect(sendEmailMock).not.toHaveBeenCalled();
      expect(revalidatePathMock).toHaveBeenCalledWith("/episode-0");
    });

    it("warns when member details are unavailable after issuing passes", async () => {
      setShortlistStatusMock.mockResolvedValueOnce({ ok: true });
      issuePassesForTeamMock.mockResolvedValueOnce({ ok: true, issued: 2 });
      getTeamDetailMock.mockResolvedValueOnce(null);

      const previousSecret = process.env.PASS_SECRET;
      process.env.PASS_SECRET = "test-pass-secret";
      let res: Awaited<ReturnType<typeof updateShortlistAction>>;
      try {
        res = await updateShortlistAction("team-1", "shortlisted");
      } finally {
        restorePassSecret(previousSecret);
      }

      expect(res!).toEqual({
        ok: true,
        warning: "Team shortlisted and passes issued, but member emails could not be prepared. Use \"Resend pass email\" to retry",
      });
      expect(sendEmailMock).not.toHaveBeenCalled();
      expect(revalidatePathMock).toHaveBeenCalledWith("/episode-0");
    });

    it("warns and revalidates when pass issuance throws after shortlisting", async () => {
      setShortlistStatusMock.mockResolvedValueOnce({ ok: true });
      issuePassesForTeamMock.mockRejectedValueOnce(new Error("Database timeout"));

      const previousSecret = process.env.PASS_SECRET;
      process.env.PASS_SECRET = "test-pass-secret";
      let res: Awaited<ReturnType<typeof updateShortlistAction>>;
      try {
        res = await updateShortlistAction("team-1", "shortlisted");
      } finally {
        restorePassSecret(previousSecret);
      }

      expect(res!).toEqual({
        ok: true,
        warning: "Team shortlisted, but event passes could not be issued; shortlist again to retry",
      });
      expect(sendEmailMock).not.toHaveBeenCalled();
      expect(revalidatePathMock).toHaveBeenCalledWith("/episode-0");
    });

    it("updates shortlist status to not_shortlisted and revalidates", async () => {
      setShortlistStatusMock.mockResolvedValueOnce({ ok: true });

      const res = await updateShortlistAction("team-1", "not_shortlisted");
      expect(res).toEqual({ ok: true });
      expect(setShortlistStatusMock).toHaveBeenCalledWith(expect.anything(), {
        teamId: "team-1",
        staffId: "admin-1",
        status: "not_shortlisted",
      });
      expect(revalidatePathMock).toHaveBeenCalledWith("/episode-0");
      expect(issuePassesForTeamMock).not.toHaveBeenCalled();
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("handles unknown team gracefully", async () => {
      setShortlistStatusMock.mockResolvedValueOnce({ ok: false, reason: "not_found" });

      const res = await updateShortlistAction("team-unknown", "shortlisted");
      expect(res).toEqual({ ok: false, message: "Team not found" });
    });
  });
  describe("resendPassEmailAction", () => {
    const members = [
      { firstName: "Ada", srmEmail: "ada@srmist.edu.in" },
      { firstName: "Lin", srmEmail: "lin@srmist.edu.in" },
    ];

    it("emails every member of a shortlisted team without issuing passes", async () => {
      getTeamDetailMock.mockResolvedValueOnce({ team: { name: "Alpha", shortlistStatus: "shortlisted" }, members });
      sendEmailMock.mockResolvedValue({ ok: true });

      expect(await resendPassEmailAction("team-1")).toEqual({ ok: true });
      expect(requireStaffMock).toHaveBeenCalledWith("admin");
      expect(sendEmailMock).toHaveBeenCalledTimes(2);
      expect(issuePassesForTeamMock).not.toHaveBeenCalled();
    });

    it("refuses a team that is not shortlisted", async () => {
      getTeamDetailMock.mockResolvedValueOnce({ team: { name: "Alpha", shortlistStatus: "pending" }, members });

      expect(await resendPassEmailAction("team-1")).toEqual({
        ok: false,
        message: "Only shortlisted teams have event passes",
      });
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("reports an unknown team", async () => {
      getTeamDetailMock.mockResolvedValueOnce(null);

      expect(await resendPassEmailAction("nope")).toEqual({ ok: false, message: "Team not found" });
    });

    it("reports how many emails failed", async () => {
      getTeamDetailMock.mockResolvedValueOnce({ team: { name: "Alpha", shortlistStatus: "shortlisted" }, members });
      sendEmailMock.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "down" });

      expect(await resendPassEmailAction("team-1")).toEqual({
        ok: false,
        message: "Could not send email to 1 of 2 member(s)",
      });
    });
  });
});
