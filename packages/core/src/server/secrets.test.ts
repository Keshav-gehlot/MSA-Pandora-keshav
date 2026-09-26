import { describe, expect, it } from "vitest";
import { generateOtpCode, generateToken, hashOtp, hashToken, otpExpiry, safeEqualHex, sessionExpiry } from "./secrets";

describe("secrets", () => {
  it("generates six-digit codes, including leading zeros", () => {
    for (let i = 0; i < 200; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });
  it("binds an OTP hash to the email", () => {
    expect(hashOtp("a@srmist.edu.in", "123456")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOtp("a@srmist.edu.in", "123456")).not.toBe(hashOtp("b@srmist.edu.in", "123456"));
  });
  it("generates unguessable tokens and stable hashes", () => {
    const t = generateToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(t);
    expect(hashToken(t)).toBe(hashToken(t));
  });
  it("compares hex digests safely", () => {
    const h = hashToken("x");
    expect(safeEqualHex(h, h)).toBe(true);
    expect(safeEqualHex(h, hashToken("y"))).toBe(false);
    expect(safeEqualHex(h, "short")).toBe(false);
    expect(safeEqualHex("zz", "gg")).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });
  it("computes expiries from the rules", () => {
    const now = new Date("2026-10-01T10:00:00Z");
    expect(otpExpiry(now).toISOString()).toBe("2026-10-01T10:10:00.000Z");
    expect(sessionExpiry(now).toISOString()).toBe("2026-10-08T10:00:00.000Z");
  });
});
