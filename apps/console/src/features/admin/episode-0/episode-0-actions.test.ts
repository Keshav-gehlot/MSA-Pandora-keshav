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

vi.mock("@pandora/db", () => ({
  listSubmissions: (...args: unknown[]) => listSubmissionsMock(...args),
  reviewSubmission: (...args: unknown[]) => reviewSubmissionMock(...args),
  setShortlistStatus: (...args: unknown[]) => setShortlistStatusMock(...args),
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

import {
  fetchSubmissions,
  submitReviewAction,
  updateShortlistAction,
} from "./episode-0-actions";

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
    it("updates shortlist status to shortlisted and revalidates", async () => {
      setShortlistStatusMock.mockResolvedValueOnce({ ok: true });

      const res = await updateShortlistAction("team-1", "shortlisted");
      expect(res).toEqual({ ok: true });
      expect(setShortlistStatusMock).toHaveBeenCalledWith(expect.anything(), {
        teamId: "team-1",
        staffId: "admin-1",
        status: "shortlisted",
      });
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
    });

    it("handles unknown team gracefully", async () => {
      setShortlistStatusMock.mockResolvedValueOnce({ ok: false, reason: "not_found" });

      const res = await updateShortlistAction("team-unknown", "shortlisted");
      expect(res).toEqual({ ok: false, message: "Team not found" });
    });
  });
});
