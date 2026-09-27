import { describe, expect, it } from "vitest";
import { formatPassPayload, parsePassPayload, PASS_PREFIX } from "./checkin";

const token = "A".repeat(40) + "b-_";
const anotherValidToken = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

describe("pass payload", () => {
  it("exports the expected PASS_PREFIX constant", () => {
    expect(PASS_PREFIX).toBe("pandora-pass:");
  });

  it("round-trips a valid 43-character base64url token", () => {
    expect(formatPassPayload(token)).toBe(`pandora-pass:${token}`);
    expect(parsePassPayload(formatPassPayload(token))).toBe(token);
    expect(formatPassPayload(anotherValidToken)).toBe(`pandora-pass:${anotherValidToken}`);
    expect(parsePassPayload(formatPassPayload(anotherValidToken))).toBe(anotherValidToken);
  });

  it("accepts leading and trailing whitespace/newlines", () => {
    expect(parsePassPayload(` pandora-pass:${token}\n`)).toBe(token);
    expect(parsePassPayload(`\t  pandora-pass:${token}  \r\n`)).toBe(token);
    expect(parsePassPayload(`\n\n\npandora-pass:${token}\n\n`)).toBe(token);
  });

  it("rejects input with missing prefix", () => {
    expect(parsePassPayload(token)).toBeNull();
  });

  it("rejects input with modified or wrong prefix", () => {
    expect(parsePassPayload(`pass:${token}`)).toBeNull();
    expect(parsePassPayload(`Pandora-pass:${token}`)).toBeNull();
    expect(parsePassPayload(`PANDORA-PASS:${token}`)).toBeNull();
    expect(parsePassPayload(`pandora_pass:${token}`)).toBeNull();
    expect(parsePassPayload(`pandora-pass-${token}`)).toBeNull();
  });

  it("rejects tokens shorter than 43 characters", () => {
    expect(parsePassPayload("pandora-pass:short")).toBeNull();
    expect(parsePassPayload(`pandora-pass:${"A".repeat(42)}`)).toBeNull();
    expect(parsePassPayload(`pandora-pass:${"x".repeat(10)}`)).toBeNull();
  });

  it("rejects tokens longer than 43 characters", () => {
    expect(parsePassPayload(`pandora-pass:${token}x`)).toBeNull();
    expect(parsePassPayload(`pandora-pass:${"A".repeat(44)}`)).toBeNull();
    expect(parsePassPayload(`pandora-pass:${"x".repeat(100)}`)).toBeNull();
  });

  it("rejects tokens with invalid non-base64url characters", () => {
    expect(parsePassPayload(`pandora-pass:${"A".repeat(42)}+`)).toBeNull();
    expect(parsePassPayload(`pandora-pass:${"A".repeat(42)}/`)).toBeNull();
    expect(parsePassPayload(`pandora-pass:${"A".repeat(42)}=`)).toBeNull();
    expect(parsePassPayload(`pandora-pass:${"A".repeat(42)}!`)).toBeNull();
    expect(parsePassPayload(`pandora-pass:${"A".repeat(42)}@`)).toBeNull();
    expect(parsePassPayload(`pandora-pass:${"A".repeat(42)} `)).toBeNull();
  });

  it("rejects URLs", () => {
    expect(parsePassPayload(`https://evil.example/${token}`)).toBeNull();
    expect(parsePassPayload(`https://pandora.msasrm.in/pandora-pass:${token}`)).toBeNull();
    expect(parsePassPayload(`http://localhost:3000/${token}`)).toBeNull();
  });

  it("rejects JSON payloads", () => {
    expect(parsePassPayload(JSON.stringify({ token }))).toBeNull();
    expect(parsePassPayload(JSON.stringify({ payload: `pandora-pass:${token}` }))).toBeNull();
  });

  it("rejects empty input or whitespace-only input", () => {
    expect(parsePassPayload("")).toBeNull();
    expect(parsePassPayload("   ")).toBeNull();
    expect(parsePassPayload("\n\t  \r\n")).toBeNull();
  });

  it("rejects a prefix with no token or whitespace token", () => {
    expect(parsePassPayload("pandora-pass:")).toBeNull();
    expect(parsePassPayload("  pandora-pass:  ")).toBeNull();
    expect(parsePassPayload("pandora-pass:\n")).toBeNull();
  });

  describe("formatPassPayload validation", () => {
    it("rejects tokens that are shorter than 43 characters", () => {
      expect(() => formatPassPayload("short")).toThrow(
        "Invalid pass token: must be a 43-character base64url string",
      );
      expect(() => formatPassPayload("A".repeat(42))).toThrow(
        "Invalid pass token: must be a 43-character base64url string",
      );
    });

    it("rejects tokens that are longer than 43 characters", () => {
      expect(() => formatPassPayload("A".repeat(44))).toThrow(
        "Invalid pass token: must be a 43-character base64url string",
      );
      expect(() => formatPassPayload(`${token}x`)).toThrow(
        "Invalid pass token: must be a 43-character base64url string",
      );
    });

    it("rejects tokens with non-base64url characters or spaces", () => {
      expect(() => formatPassPayload(`${"A".repeat(42)}+`)).toThrow(
        "Invalid pass token: must be a 43-character base64url string",
      );
      expect(() => formatPassPayload(`${"A".repeat(42)}/`)).toThrow(
        "Invalid pass token: must be a 43-character base64url string",
      );
      expect(() => formatPassPayload(`${"A".repeat(42)}=`)).toThrow(
        "Invalid pass token: must be a 43-character base64url string",
      );
      expect(() => formatPassPayload(` ${token.slice(1)}`)).toThrow(
        "Invalid pass token: must be a 43-character base64url string",
      );
      expect(() => formatPassPayload(`${token.slice(0, -1)} `)).toThrow(
        "Invalid pass token: must be a 43-character base64url string",
      );
    });

    it("rejects an empty token", () => {
      expect(() => formatPassPayload("")).toThrow(
        "Invalid pass token: must be a 43-character base64url string",
      );
    });
  });
});
