import { describe, expect, it } from "vitest";
import { toPaymentStatus, toShortlistStatus } from "./status";

describe("toPaymentStatus", () => {
  it.each(["not_required", "pending", "approved", "declined"])("keeps the known value %s", (value) => {
    expect(toPaymentStatus(value)).toBe(value);
  });

  it("treats an unknown value as pending, so a team is never treated as verified by mistake", () => {
    expect(toPaymentStatus("refunded")).toBe("pending");
    expect(toPaymentStatus("")).toBe("pending");
  });
});

describe("toShortlistStatus", () => {
  it.each(["pending", "shortlisted", "not_shortlisted"])("keeps the known value %s", (value) => {
    expect(toShortlistStatus(value)).toBe(value);
  });

  it("treats an unknown value as pending, so a pass is never shown by mistake", () => {
    expect(toShortlistStatus("winner")).toBe("pending");
  });
});
