import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMemberByEmail = vi.fn();
const mockIssueOtp = vi.fn();
const mockVerifyOtp = vi.fn();
const mockSendEmail = vi.fn();
const mockStartMemberSession = vi.fn();
const mockEndSession = vi.fn();
const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("@pandora/db", () => ({
  findMemberByEmail: (...args: unknown[]) => mockFindMemberByEmail(...args),
  issueOtp: (...args: unknown[]) => mockIssueOtp(...args),
  verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
}));
vi.mock("@pandora/email", () => ({ sendEmail: (...args: unknown[]) => mockSendEmail(...args) }));
vi.mock("../../lib/cf-db", () => ({ getDb: async () => ({ fake: "db" }) }));
vi.mock("../../lib/session", () => ({
  startMemberSession: (...args: unknown[]) => mockStartMemberSession(...args),
  endSession: () => mockEndSession(),
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => mockRedirect(url) }));

import { requestSignInCode, signOut, verifySignIn } from "./sign-in-actions";

const EMAIL = "ra2611026010690@srmist.edu.in";

beforeEach(() => {
  vi.clearAllMocks();
  mockSendEmail.mockResolvedValue({ ok: true, id: "m1" });
});

describe("requestSignInCode", () => {
  it("rejects an email that isn't an SRM address, without touching the database", async () => {
    const result = await requestSignInCode("someone@gmail.com");
    expect(result.ok).toBe(false);
    expect(mockFindMemberByEmail).not.toHaveBeenCalled();
  });

  it("emails a code to a registered member", async () => {
    mockFindMemberByEmail.mockResolvedValue({ id: "member-1" });
    mockIssueOtp.mockResolvedValue({ ok: true, code: "123456" });

    expect(await requestSignInCode(EMAIL)).toEqual({ ok: true });
    expect(mockIssueOtp).toHaveBeenCalledWith(expect.anything(), { email: EMAIL, purpose: "participant_sign_in" });
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: EMAIL,
      template: "otp-code",
      props: { code: "123456", purpose: "participant_sign_in" },
    });
  });

  it("answers exactly the same for an unregistered email, and sends nothing", async () => {
    mockFindMemberByEmail.mockResolvedValue(null);

    expect(await requestSignInCode(EMAIL)).toEqual({ ok: true });
    expect(mockIssueOtp).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("tells a member to wait when a code was just sent", async () => {
    mockFindMemberByEmail.mockResolvedValue({ id: "member-1" });
    mockIssueOtp.mockResolvedValue({ ok: false, reason: "too_soon", retryAfterSeconds: 42 });

    expect(await requestSignInCode(EMAIL)).toEqual({
      ok: false,
      message: "Wait 42 seconds before asking for another code.",
    });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("tells a member when the daily limit is reached", async () => {
    mockFindMemberByEmail.mockResolvedValue({ id: "member-1" });
    mockIssueOtp.mockResolvedValue({ ok: false, reason: "daily_limit" });

    expect(await requestSignInCode(EMAIL)).toEqual({ ok: false, message: "Too many codes today. Try again tomorrow." });
  });

  it("reports a failed send instead of pretending the code is on its way", async () => {
    mockFindMemberByEmail.mockResolvedValue({ id: "member-1" });
    mockIssueOtp.mockResolvedValue({ ok: true, code: "123456" });
    mockSendEmail.mockResolvedValue({ ok: false, error: "boom" });

    expect(await requestSignInCode(EMAIL)).toEqual({
      ok: false,
      message: "We couldn't send the email. Try again in a minute.",
    });
  });
});

describe("verifySignIn", () => {
  it("rejects a code that isn't six digits without checking it", async () => {
    const result = await verifySignIn(EMAIL, "12");
    expect(result.ok).toBe(false);
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid", "That code isn't right."],
    ["expired", "That code has expired. Ask for a new one."],
    ["too_many_attempts", "Too many tries. Ask for a new code."],
    ["not_found", "Ask for a code first."],
  ])("maps a %s code to a clear message and does not sign in", async (reason, message) => {
    mockVerifyOtp.mockResolvedValue({ ok: false, reason });

    expect(await verifySignIn(EMAIL, "123456")).toEqual({ ok: false, message });
    expect(mockStartMemberSession).not.toHaveBeenCalled();
  });

  it("signs the member in and goes to /team on a correct code", async () => {
    mockVerifyOtp.mockResolvedValue({ ok: true });
    mockFindMemberByEmail.mockResolvedValue({ id: "member-1" });

    await expect(verifySignIn(EMAIL, "123456")).rejects.toThrow("REDIRECT:/team");
    expect(mockVerifyOtp).toHaveBeenCalledWith(expect.anything(), {
      email: EMAIL,
      purpose: "participant_sign_in",
      code: "123456",
    });
    expect(mockStartMemberSession).toHaveBeenCalledWith("member-1");
  });
});

describe("signOut", () => {
  it("ends the session and goes to the home page", async () => {
    await expect(signOut()).rejects.toThrow("REDIRECT:/");
    expect(mockEndSession).toHaveBeenCalledTimes(1);
  });
});
