import { describe, expect, it } from "vitest";
import { csvCell, decisionNoteSchema, notificationSchema, reviewSchema } from "./admin";

describe("admin schemas", () => {
  it("validates notices", () => {
    expect(notificationSchema.parse({ title: "  Episode 0 is live ", body: "Go" })).toEqual({ title: "Episode 0 is live", body: "Go" });
    expect(notificationSchema.safeParse({ title: "Hi", body: "" }).error?.issues.map((i) => i.path[0])).toEqual(["title", "body"]);
  });
  it("coerces and bounds scores", () => {
    expect(reviewSchema.parse({ score: "87", reviewNote: " solid " })).toEqual({ score: 87, reviewNote: "solid" });
    expect(reviewSchema.safeParse({ score: "101", reviewNote: "" }).success).toBe(false);
    expect(reviewSchema.safeParse({ score: "7.5", reviewNote: "" }).success).toBe(false);
  });
  it("rejects a blank or whitespace-only score", () => {
    expect(reviewSchema.safeParse({ score: "", reviewNote: "" }).success).toBe(false);
    expect(reviewSchema.safeParse({ score: "   ", reviewNote: "" }).success).toBe(false);
    expect(reviewSchema.parse({ score: "0", reviewNote: "" }).score).toBe(0);
  });
  it("limits decision notes", () => {
    expect(decisionNoteSchema.safeParse("x".repeat(501)).success).toBe(false);
  });
});

describe("csvCell", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(3)).toBe("3");
  });
  it("neutralizes spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+91")).toBe("'+91");
    expect(csvCell("-x")).toBe("'-x");
    expect(csvCell("@x")).toBe("'@x");
  });
  it("quotes a standalone carriage return", () => {
    expect(csvCell("a\rb")).toBe('"a\rb"');
  });
  it("neutralizes formulas hidden behind leading whitespace", () => {
    expect(csvCell(" =SUM(A1)")).toBe("' =SUM(A1)");
    expect(csvCell("\t+91")).toBe("'\t+91");
  });
  it("treats undefined like null", () => {
    expect(csvCell(undefined)).toBe("");
  });
  it("does not mangle negative numbers", () => {
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell("-5")).toBe("'-5"); // strings stay guarded
  });
});
