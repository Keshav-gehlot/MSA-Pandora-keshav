import { describe, expect, it } from "vitest";
import { checkUpload, isPaymentEnabled, teamStepSchema, uploadExtension } from "./registration";

const MB = 1024 * 1024;

describe("teamStepSchema", () => {
  it("accepts a team name and a known track", () => {
    expect(teamStepSchema.parse({ teamName: "  Null Pointers ", track: "Track B" })).toEqual({
      teamName: "Null Pointers",
      track: "Track B",
    });
  });

  it("rejects a short name and an unknown track", () => {
    const r = teamStepSchema.safeParse({ teamName: "ab", track: "Track Z" });
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(["teamName", "track"]);
  });
});

describe("checkUpload", () => {
  it("accepts a 2 MB PNG photo and payment proof", () => {
    expect(checkUpload("photo", { type: "image/png", size: 2 * MB })).toEqual({ ok: true });
    expect(checkUpload("paymentProof", { type: "image/png", size: 2 * MB })).toEqual({ ok: true });
  });

  it("accepts WebP for photos but not for payment proofs", () => {
    expect(checkUpload("photo", { type: "image/webp", size: MB })).toEqual({ ok: true });
    expect(checkUpload("paymentProof", { type: "image/webp", size: MB })).toEqual({
      ok: false,
      message: "Use a JPEG or PNG image",
    });
  });

  it("rejects other types, empty files and files over 5 MB", () => {
    expect(checkUpload("photo", { type: "application/pdf", size: MB })).toEqual({
      ok: false,
      message: "Use a JPEG, PNG or WebP image",
    });

    expect(checkUpload("photo", { type: "image/png", size: 0 })).toEqual({
      ok: false,
      message: "The file is empty",
    });

    expect(checkUpload("photo", { type: "image/png", size: 5 * MB + 1 })).toEqual({
      ok: false,
      message: "Files must be 5 MB or smaller",
    });
  });
});

describe("helpers", () => {
  it("maps content types to file extensions", () => {
    expect(uploadExtension("image/jpeg")).toBe("jpg");
    expect(uploadExtension("image/png")).toBe("png");
    expect(uploadExtension("image/webp")).toBe("webp");
  });

  it("turns payments on only for the exact value true", () => {
    expect(isPaymentEnabled("true")).toBe(true);
    expect(isPaymentEnabled(" TRUE ")).toBe(true);
    expect(isPaymentEnabled("false")).toBe(false);
    expect(isPaymentEnabled(undefined)).toBe(false);
    expect(isPaymentEnabled("1")).toBe(false);
  });
});