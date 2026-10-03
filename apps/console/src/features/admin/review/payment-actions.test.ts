import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/cache
const revalidatePathMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}));

// Mock @pandora/db
const decidePaymentMock = vi.fn();
const listPendingPaymentsMock = vi.fn();

vi.mock("@pandora/db", () => ({
  decidePayment: (...args: unknown[]) => decidePaymentMock(...args),
  listPendingPayments: (...args: unknown[]) => listPendingPaymentsMock(...args),
  fileUrl: (path: string) => `/files/${path}`,
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

import { fetchPendingPayments, reviewPayment } from "./payment-actions";

describe("payment-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireStaffMock.mockResolvedValue({ id: "admin-1", email: "admin@srmist.edu.in", role: "admin", name: "Admin" });
  });

  describe("fetchPendingPayments", () => {
    it("fetches pending payments with a console link to each proof", async () => {
      const createdAt = new Date("2026-09-29T10:00:00Z");
      listPendingPaymentsMock.mockResolvedValueOnce([
        {
          proofId: "proof-1",
          teamId: "team-1",
          teamName: "Alpha",
          filePath: "proofs/alpha.png",
          createdAt,
        },
      ]);
      const items = await fetchPendingPayments();
      expect(requireStaffMock).toHaveBeenCalledWith("admin");
      expect(items).toEqual([
        {
          proofId: "proof-1",
          teamId: "team-1",
          teamName: "Alpha",
          filePath: "proofs/alpha.png",
          fileUrl: "/files/proofs/alpha.png",
          createdAt,
        },
      ]);
    });

  });

  describe("reviewPayment", () => {
    it("approves a payment, sends emails to all members, and revalidates", async () => {
      decidePaymentMock.mockResolvedValueOnce({
        ok: true,
        teamName: "Alpha",
        memberEmails: ["t1m1@srmist.edu.in", "t1m2@srmist.edu.in"],
      });
      sendEmailMock.mockResolvedValue({ ok: true });

      const result = await reviewPayment("proof-1", "approved");
      expect(result).toEqual({ ok: true });
      expect(decidePaymentMock).toHaveBeenCalledWith(expect.anything(), {
        proofId: "proof-1",
        staffId: "admin-1",
        decision: "approved",
        note: undefined,
      });
      expect(sendEmailMock).toHaveBeenCalledTimes(2);
      expect(sendEmailMock).toHaveBeenCalledWith({
        to: "t1m1@srmist.edu.in",
        template: "admin-payment-approved",
        props: { teamName: "Alpha" },
      });
      expect(revalidatePathMock).toHaveBeenCalledWith("/payments");
    });

    it("declines a payment with note and sends decline emails", async () => {
      decidePaymentMock.mockResolvedValueOnce({
        ok: true,
        teamName: "Alpha",
        memberEmails: ["t1m1@srmist.edu.in"],
      });
      sendEmailMock.mockResolvedValue({ ok: true });

      const result = await reviewPayment("proof-1", "declined", "Unclear screenshot");
      expect(result).toEqual({ ok: true });
      expect(decidePaymentMock).toHaveBeenCalledWith(expect.anything(), {
        proofId: "proof-1",
        staffId: "admin-1",
        decision: "declined",
        note: "Unclear screenshot",
      });
      expect(sendEmailMock).toHaveBeenCalledWith({
        to: "t1m1@srmist.edu.in",
        template: "admin-payment-declined",
        props: { teamName: "Alpha", note: "Unclear screenshot" },
      });
    });

    it("rejects decline without note before database call", async () => {
      const result = await reviewPayment("proof-1", "declined", "   ");
      expect(result).toEqual({ ok: false, message: "A note is required when declining a payment" });
      expect(decidePaymentMock).not.toHaveBeenCalled();
    });

    it("rejects decline with note exceeding length limit", async () => {
      const longNote = "x".repeat(501);
      const result = await reviewPayment("proof-1", "declined", longNote);
      expect(result).toEqual({ ok: false, message: "Note must be at most 500 characters" });
      expect(decidePaymentMock).not.toHaveBeenCalled();
    });

    it("handles already_decided gracefully", async () => {
      decidePaymentMock.mockResolvedValueOnce({ ok: false, reason: "already_decided" });

      const result = await reviewPayment("proof-1", "approved");
      expect(result).toEqual({ ok: false, message: "This payment has already been reviewed" });
      expect(revalidatePathMock).toHaveBeenCalledWith("/payments");
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("handles not_found gracefully", async () => {
      decidePaymentMock.mockResolvedValueOnce({ ok: false, reason: "not_found" });

      const result = await reviewPayment("proof-unknown", "approved");
      expect(result).toEqual({ ok: false, message: "Payment proof not found" });
      expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("returns a warning if email sending fails for some members", async () => {
      decidePaymentMock.mockResolvedValueOnce({
        ok: true,
        teamName: "Alpha",
        memberEmails: ["t1m1@srmist.edu.in", "t1m2@srmist.edu.in"],
      });
      sendEmailMock
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false, error: "SMTP timeout" });

      const result = await reviewPayment("proof-1", "approved");
      expect(result).toEqual({
        ok: true,
        warning: "Payment approved, but could not send email to 1 of 2 member(s)",
      });
    });
  });
});
