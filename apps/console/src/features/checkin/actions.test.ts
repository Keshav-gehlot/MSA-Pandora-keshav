import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLookupPass = vi.fn();
const mockCheckIn = vi.fn();
const mockSearchCheckin = vi.fn();
const mockAttendanceSummary = vi.fn();
const mockGetDb = vi.fn();
const mockSignedUrl = vi.fn();
const mockGetStorage = vi.fn();
const mockRequireStaff = vi.fn();

vi.mock("@pandora/db", () => ({
  lookupPass: (...args: unknown[]) => mockLookupPass(...args),
  checkIn: (...args: unknown[]) => mockCheckIn(...args),
  searchCheckin: (...args: unknown[]) => mockSearchCheckin(...args),
  attendanceSummary: (...args: unknown[]) => mockAttendanceSummary(...args),
  getStorage: () => mockGetStorage(),
}));

vi.mock("../../lib/cf-db", () => ({
  getDb: () => mockGetDb(),
}));

vi.mock("../../lib/session", () => ({
  requireStaff: () => mockRequireStaff(),
}));

import { confirmCheckIn, getAttendanceSummaryAction, lookupScan, searchMembers } from "./actions";

describe("check-in server actions", () => {
  const dummyToken = "A".repeat(40) + "b-_";
  const dummyPayload = `pandora-pass:${dummyToken}`;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockReturnValue({ name: "mock-db" });
    mockGetStorage.mockReturnValue({
      signedUrl: mockSignedUrl,
    });
    mockRequireStaff.mockResolvedValue({
      id: "staff-123",
      name: "Gate One",
      role: "staff",
      email: "gate1@msasrm.in",
    });
  });

  describe("lookupScan", () => {
    it("requires staff authentication before processing scan", async () => {
      mockRequireStaff.mockRejectedValueOnce(new Error("REDIRECT:/sign-in"));

      await expect(lookupScan(dummyPayload)).rejects.toThrow("REDIRECT:/sign-in");
      expect(mockRequireStaff).toHaveBeenCalled();
      expect(mockLookupPass).not.toHaveBeenCalled();
    });

    it("returns error on invalid QR prefix", async () => {
      const result = await lookupScan("invalid-prefix:123");
      expect(result).toEqual({
        ok: false,
        error: "This isn't a valid Pandora pass.",
      });
      expect(mockLookupPass).not.toHaveBeenCalled();
    });

    it("returns error on malformed token length", async () => {
      const result = await lookupScan("pandora-pass:too-short");
      expect(result).toEqual({
        ok: false,
        error: "This isn't a valid Pandora pass.",
      });
      expect(mockLookupPass).not.toHaveBeenCalled();
    });

    it("returns error when pass is not found in database", async () => {
      mockLookupPass.mockResolvedValue(null);

      const result = await lookupScan(dummyPayload);
      expect(result).toEqual({
        ok: false,
        error: "This isn't a valid Pandora pass.",
      });
      expect(mockLookupPass).toHaveBeenCalledWith({ name: "mock-db" }, dummyToken);
    });

    it("returns cancelled message when pass is revoked", async () => {
      mockLookupPass.mockResolvedValue({
        memberId: "m-1",
        memberName: "Alice Smith",
        regNumber: "RA2411003010001",
        photoPath: null,
        teamName: "Team Alpha",
        track: "Web",
        revoked: true,
        checkedIn: null,
      });

      const result = await lookupScan(dummyPayload);
      expect(result).toEqual({
        ok: false,
        error: "This pass was cancelled.",
      });
    });

    it("returns attendee details on valid pass without photo", async () => {
      mockLookupPass.mockResolvedValue({
        memberId: "m-1",
        memberName: "Alice Smith",
        regNumber: "RA2411003010001",
        photoPath: null,
        teamName: "Team Alpha",
        track: "Web",
        revoked: false,
        checkedIn: null,
      });

      const result = await lookupScan(dummyPayload);
      expect(result).toEqual({
        ok: true,
        data: {
          memberId: "m-1",
          memberName: "Alice Smith",
          regNumber: "RA2411003010001",
          photoUrl: null,
          teamName: "Team Alpha",
          track: "Web",
          checkedIn: null,
        },
      });
      expect(mockSignedUrl).not.toHaveBeenCalled();
    });

    it("generates signed photo URL when photoPath exists", async () => {
      mockLookupPass.mockResolvedValue({
        memberId: "m-2",
        memberName: "Bob Jones",
        regNumber: "RA2411003010002",
        photoPath: "photos/m-2.jpg",
        teamName: "Team Beta",
        track: "AI",
        revoked: false,
        checkedIn: null,
      });
      mockSignedUrl.mockResolvedValue("https://storage.example.com/signed/photo.jpg");

      const result = await lookupScan(dummyPayload);
      expect(mockSignedUrl).toHaveBeenCalledWith("photos/m-2.jpg");
      expect(result).toEqual({
        ok: true,
        data: {
          memberId: "m-2",
          memberName: "Bob Jones",
          regNumber: "RA2411003010002",
          photoUrl: "https://storage.example.com/signed/photo.jpg",
          teamName: "Team Beta",
          track: "AI",
          checkedIn: null,
        },
      });
    });

    it("gracefully falls back to null photoUrl if storage fails", async () => {
      mockLookupPass.mockResolvedValue({
        memberId: "m-2",
        memberName: "Bob Jones",
        regNumber: "RA2411003010002",
        photoPath: "photos/m-2.jpg",
        teamName: "Team Beta",
        track: "AI",
        revoked: false,
        checkedIn: null,
      });
      mockSignedUrl.mockRejectedValue(new Error("Storage unavailable"));

      const result = await lookupScan(dummyPayload);
      expect(result).toEqual({
        ok: true,
        data: {
          memberId: "m-2",
          memberName: "Bob Jones",
          regNumber: "RA2411003010002",
          photoUrl: null,
          teamName: "Team Beta",
          track: "AI",
          checkedIn: null,
        },
      });
    });
  });

  describe("confirmCheckIn", () => {
    it("calls requireStaff and records check-in successfully", async () => {
      const now = new Date("2026-09-28T09:00:00Z");
      mockCheckIn.mockResolvedValue({
        ok: true,
        at: now,
      });

      const result = await confirmCheckIn("m-1");
      expect(mockRequireStaff).toHaveBeenCalled();
      expect(mockCheckIn).toHaveBeenCalledWith({ name: "mock-db" }, {
        memberId: "m-1",
        staffId: "staff-123",
      });
      expect(result).toEqual({
        ok: true,
        at: now,
      });
    });

    it("formats duplicate check-in in IST with staff name", async () => {
      // 03:42 UTC = 09:12 IST (+05:30)
      const recordedAt = new Date("2026-09-28T03:42:00Z");
      mockCheckIn.mockResolvedValue({
        ok: false,
        reason: "already",
        at: recordedAt,
        byName: "Gate One",
      });

      const result = await confirmCheckIn("m-1");
      expect(result).toEqual({
        ok: false,
        already: true,
        error: "Already checked in at 09:12 by Gate One.",
      });
    });

    it("handles revoked pass during check-in", async () => {
      mockCheckIn.mockResolvedValue({
        ok: false,
        reason: "revoked",
      });

      const result = await confirmCheckIn("m-1");
      expect(result).toEqual({
        ok: false,
        error: "This pass was cancelled.",
      });
    });

    it("handles no_pass during check-in", async () => {
      mockCheckIn.mockResolvedValue({
        ok: false,
        reason: "no_pass",
      });

      const result = await confirmCheckIn("m-1");
      expect(result).toEqual({
        ok: false,
        error: "This member does not have an active pass.",
      });
    });
  });

  describe("searchMembers", () => {
    it("requires staff authentication and calls searchCheckin", async () => {
      const searchResults = [
        {
          memberId: "m-1",
          memberName: "Alice Smith",
          regNumber: "RA2411003010001",
          teamName: "Team Alpha",
          hasPass: true,
          checkedInAt: null,
        },
      ];
      mockSearchCheckin.mockResolvedValue(searchResults);

      const result = await searchMembers("Alice");
      expect(mockRequireStaff).toHaveBeenCalled();
      expect(mockSearchCheckin).toHaveBeenCalledWith({ name: "mock-db" }, "Alice");
      expect(result).toEqual({
        ok: true,
        data: searchResults,
      });
    });
  });

  describe("getAttendanceSummaryAction", () => {
    it("requires staff authentication and calls attendanceSummary", async () => {
      const summaryRows = [
        { teamId: "t-1", teamName: "Alpha", expected: 4, present: 3 },
        { teamId: "t-2", teamName: "Beta", expected: 3, present: 3 },
      ];
      mockAttendanceSummary.mockResolvedValue(summaryRows);

      const result = await getAttendanceSummaryAction();
      expect(mockRequireStaff).toHaveBeenCalled();
      expect(mockAttendanceSummary).toHaveBeenCalledWith({ name: "mock-db" });
      expect(result).toEqual({
        ok: true,
        data: summaryRows,
      });
    });
  });
});

