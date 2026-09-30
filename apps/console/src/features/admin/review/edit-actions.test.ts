import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/cache
const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}));

// Mock @pandora/db
const decideEditRequestMock = vi.fn();
const listPendingEditRequestsMock = vi.fn();

vi.mock("@pandora/db", () => ({
  decideEditRequest: (...args: unknown[]) => decideEditRequestMock(...args),
  listPendingEditRequests: (...args: unknown[]) => listPendingEditRequestsMock(...args),
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

// Mock @pandora/email
const sendEmailMock = vi.fn();
vi.mock("@pandora/email", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

import { fetchPendingEdits, reviewEditRequest } from "./edit-actions";

describe("edit-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireStaffMock.mockResolvedValue({
      id: "admin-1",
      email: "admin@srmist.edu.in",
      role: "admin",
      name: "Admin",
    });
  });

  describe("fetchPendingEdits", () => {
    it("fetches pending edits after requiring admin auth", async () => {
      const createdAt = new Date("2026-10-01T10:00:00Z");
      listPendingEditRequestsMock.mockResolvedValueOnce([
        {
          requestId: "req-1",
          teamId: "team-1",
          teamName: "Alpha",
          requestedByName: "M1 L",
          changes: [{ path: "teamName", from: "Alpha", to: "Alpha Prime" }],
          createdAt,
        },
      ]);

      const items = await fetchPendingEdits();
      expect(requireStaffMock).toHaveBeenCalledWith("admin");
      expect(items).toEqual([
        {
          requestId: "req-1",
          teamId: "team-1",
          teamName: "Alpha",
          requestedByName: "M1 L",
          changes: [{ path: "teamName", from: "Alpha", to: "Alpha Prime" }],
          createdAt,
        },
      ]);
    });
  });

  describe("reviewEditRequest", () => {
    it("approves an edit request, dispatches emails to all members, and revalidates", async () => {
      decideEditRequestMock.mockResolvedValueOnce({
        ok: true,
        teamName: "Alpha Prime",
        memberEmails: ["t1m1@srmist.edu.in", "t1m2@srmist.edu.in"],
      });
      sendEmailMock.mockResolvedValue({ ok: true });

      const result = await reviewEditRequest("req-1", "approved");
      expect(result).toEqual({ ok: true });
      expect(decideEditRequestMock).toHaveBeenCalledWith(expect.anything(), {
        requestId: "req-1",
        staffId: "admin-1",
        decision: "approved",
        note: undefined,
      });
      expect(sendEmailMock).toHaveBeenCalledTimes(2);
      expect(sendEmailMock).toHaveBeenCalledWith({
        to: "t1m1@srmist.edu.in",
        template: "admin-edit-decided",
        props: {
          teamName: "Alpha Prime",
          approved: true,
          note: null,
        },
      });
      expect(revalidatePathMock).toHaveBeenCalledWith("/edits");
    });

    it("declines an edit request with note and dispatches decline emails", async () => {
      decideEditRequestMock.mockResolvedValueOnce({
        ok: true,
        teamName: "Alpha",
        memberEmails: ["t1m1@srmist.edu.in"],
      });
      sendEmailMock.mockResolvedValue({ ok: true });

      const result = await reviewEditRequest("req-1", "declined", "Changes not allowed");
      expect(result).toEqual({ ok: true });
      expect(decideEditRequestMock).toHaveBeenCalledWith(expect.anything(), {
        requestId: "req-1",
        staffId: "admin-1",
        decision: "declined",
        note: "Changes not allowed",
      });
      expect(sendEmailMock).toHaveBeenCalledWith({
        to: "t1m1@srmist.edu.in",
        template: "admin-edit-decided",
        props: {
          teamName: "Alpha",
          approved: false,
          note: "Changes not allowed",
        },
      });
    });

    it("rejects note exceeding 500 characters", async () => {
      const longNote = "x".repeat(501);
      const result = await reviewEditRequest("req-1", "declined", longNote);
      expect(result).toEqual({ ok: false, message: "Note must be at most 500 characters" });
      expect(decideEditRequestMock).not.toHaveBeenCalled();
    });

    it("handles already_decided gracefully", async () => {
      decideEditRequestMock.mockResolvedValueOnce({ ok: false, reason: "already_decided" });

      const result = await reviewEditRequest("req-1", "approved");
      expect(result).toEqual({ ok: false, message: "This edit request has already been reviewed" });
      expect(revalidatePathMock).toHaveBeenCalledWith("/edits");
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("handles not_found gracefully", async () => {
      decideEditRequestMock.mockResolvedValueOnce({ ok: false, reason: "not_found" });

      const result = await reviewEditRequest("req-unknown", "approved");
      expect(result).toEqual({ ok: false, message: "Edit request not found" });
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("handles invalid validation errors gracefully", async () => {
      decideEditRequestMock.mockResolvedValueOnce({
        ok: false,
        reason: "invalid",
        message: "Phone number must be exactly 10 digits",
      });

      const result = await reviewEditRequest("req-1", "approved");
      expect(result).toEqual({
        ok: false,
        message: "Phone number must be exactly 10 digits",
      });
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("handles taken constraint errors gracefully", async () => {
      decideEditRequestMock.mockResolvedValueOnce({
        ok: false,
        reason: "taken",
        field: "teamName",
      });

      const result = await reviewEditRequest("req-1", "approved");
      expect(result).toEqual({
        ok: false,
        message: "Team name is already taken by another team",
      });
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("returns a warning if email sending fails for some members", async () => {
      decideEditRequestMock.mockResolvedValueOnce({
        ok: true,
        teamName: "Alpha",
        memberEmails: ["t1m1@srmist.edu.in", "t1m2@srmist.edu.in"],
      });
      sendEmailMock
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, error: "SMTP timeout" });

      const result = await reviewEditRequest("req-1", "approved");
      expect(result).toEqual({
        ok: true,
        warning: "Edit request approved, but could not send email to 1 of 2 member(s)",
      });
    });
  });
});
