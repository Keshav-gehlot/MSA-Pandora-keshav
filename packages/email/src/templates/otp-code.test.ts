import { describe, expect, it, vi } from "vitest";

// A different expiry than the real one, so the test proves the text follows the config instead of a literal.
vi.mock("@pandora/core", () => ({ OTP: { ttlMinutes: 15 } }));

const { otpCode } = await import("./otp-code");

describe("otpCode", () => {
  it("states the configured expiry", () => {
    const text = otpCode.text({ code: "123456", purpose: "registration" });
    expect(text).toContain("15 minutes");
    expect(text).not.toContain("10 minutes");
  });
});
