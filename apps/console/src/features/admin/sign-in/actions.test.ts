import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

// Mock @pandora/db
const findStaffByEmailMock = vi.fn();
const issueOtpMock = vi.fn();
const verifyOtpMock = vi.fn();
const getDbMock = vi.fn(() => ({}));

vi.mock("@pandora/db", () => ({
  findStaffByEmail: (...args: unknown[]) => findStaffByEmailMock(...args),
  issueOtp: (...args: unknown[]) => issueOtpMock(...args),
  verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
}));

// Mock the app-local database accessor (getDb lives in lib/cf-db, not @pandora/db)
vi.mock("../../../lib/cf-db", () => ({
  getDb: async () => getDbMock(),
}));

// Mock @pandora/email
const sendEmailMock = vi.fn();
vi.mock("@pandora/email", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

// Mock session
const startStaffSessionMock = vi.fn();
const endSessionMock = vi.fn();
vi.mock("../../../lib/session", () => ({
  startStaffSession: (...args: unknown[]) => startStaffSessionMock(...args),
  endSession: () => endSessionMock(),
}));

import { requestStaffCode, staffSignOut, verifyStaffSignIn } from "./actions";

describe("requestStaffCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid emails", async () => {
    const res = await requestStaffCode("not-an-email");
    expect(res).toEqual({ ok: false, message: "Enter a valid email" });
    expect(findStaffByEmailMock).not.toHaveBeenCalled();
  });

  it("returns neutral ok: true for unknown staff email without sending email", async () => {
    findStaffByEmailMock.mockResolvedValueOnce(null);
    const res = await requestStaffCode("unknown@srmist.edu.in");
    expect(res).toEqual({ ok: true });
    expect(issueOtpMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("issues OTP and sends email for registered staff", async () => {
    findStaffByEmailMock.mockResolvedValueOnce({
      id: "staff-1",
      email: "admin@srmist.edu.in",
      role: "admin",
      name: "Admin User",
    });
    issueOtpMock.mockResolvedValueOnce({ ok: true, code: "123456" });
    sendEmailMock.mockResolvedValueOnce({ ok: true, id: "email-1" });

    const res = await requestStaffCode("admin@srmist.edu.in");
    expect(res).toEqual({ ok: true });
    expect(issueOtpMock).toHaveBeenCalledWith(expect.anything(), {
      email: "admin@srmist.edu.in",
      purpose: "staff_sign_in",
    });
    expect(sendEmailMock).toHaveBeenCalledWith({
      to: "admin@srmist.edu.in",
      template: "otp-code",
      props: { code: "123456", purpose: "staff_sign_in" },
    });
  });

  it("handles too_soon rate limit gracefully", async () => {
    findStaffByEmailMock.mockResolvedValueOnce({ id: "staff-1", email: "admin@srmist.edu.in" });
    issueOtpMock.mockResolvedValueOnce({ ok: false, reason: "too_soon", retryAfterSeconds: 42 });

    const res = await requestStaffCode("admin@srmist.edu.in");
    expect(res).toEqual({ ok: false, message: "Please wait 42s before requesting another code" });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("handles daily_limit rate limit gracefully", async () => {
    findStaffByEmailMock.mockResolvedValueOnce({ id: "staff-1", email: "admin@srmist.edu.in" });
    issueOtpMock.mockResolvedValueOnce({ ok: false, reason: "daily_limit" });

    const res = await requestStaffCode("admin@srmist.edu.in");
    expect(res).toEqual({ ok: false, message: "Daily sign-in code limit reached. Please try again tomorrow." });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("handles email delivery failure gracefully", async () => {
    findStaffByEmailMock.mockResolvedValueOnce({ id: "staff-1", email: "admin@srmist.edu.in" });
    issueOtpMock.mockResolvedValueOnce({ ok: true, code: "123456" });
    sendEmailMock.mockResolvedValueOnce({
      ok: false,
      error: "SMTP transport failed",
    });

    const res = await requestStaffCode("admin@srmist.edu.in");
    expect(res).toEqual({
      ok: false,
      message: "Could not send verification email. Please try again.",
    });
  });
});

describe("verifyStaffSignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid email or code format", async () => {
    expect(await verifyStaffSignIn("bad", "123456")).toEqual({ ok: false, message: "Enter a valid email" });
    expect(await verifyStaffSignIn("admin@srmist.edu.in", "123")).toEqual({ ok: false, message: "Enter the 6-digit code" });
  });

  it("handles incorrect code", async () => {
    verifyOtpMock.mockResolvedValueOnce({ ok: false, reason: "invalid" });
    const res = await verifyStaffSignIn("admin@srmist.edu.in", "000000");
    expect(res).toEqual({ ok: false, message: "Incorrect code. Please try again." });
  });

  it("handles expired code", async () => {
    verifyOtpMock.mockResolvedValueOnce({ ok: false, reason: "expired" });
    const res = await verifyStaffSignIn("admin@srmist.edu.in", "000000");
    expect(res).toEqual({ ok: false, message: "Code has expired. Please request a new one." });
  });

  it("handles too many attempts", async () => {
    verifyOtpMock.mockResolvedValueOnce({ ok: false, reason: "too_many_attempts" });
    const res = await verifyStaffSignIn("admin@srmist.edu.in", "000000");
    expect(res).toEqual({ ok: false, message: "Too many failed attempts. Please request a new code." });
  });

  it("starts session and redirects to / on successful OTP verification", async () => {
    verifyOtpMock.mockResolvedValueOnce({ ok: true });
    findStaffByEmailMock.mockResolvedValueOnce({
      id: "staff-admin-id",
      email: "admin@srmist.edu.in",
      role: "admin",
      name: "Admin",
    });

    await expect(verifyStaffSignIn("admin@srmist.edu.in", "123456")).rejects.toThrow("REDIRECT:/");
    expect(startStaffSessionMock).toHaveBeenCalledWith("staff-admin-id");
    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});

describe("staffSignOut", () => {
  it("ends session and redirects to /sign-in", async () => {
    await expect(staffSignOut()).rejects.toThrow("REDIRECT:/sign-in");
    expect(endSessionMock).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith("/sign-in");
  });
});
