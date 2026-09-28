import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Provide global React for Node-based test execution of server components
// where the JSX transform targets React.createElement.
(globalThis as unknown as { React: typeof React }).React = React;

// Mock server-only before importing the component
vi.mock("server-only", () => ({}));

// Spies and mock handlers
const mockGetDb = vi.fn();
const mockGetPassToken = vi.fn();
const mockGetMemberWithTeam = vi.fn();

vi.mock("@pandora/db", () => ({
  getPassToken: (...args: unknown[]) => mockGetPassToken(...args),
  getMemberWithTeam: (...args: unknown[]) => mockGetMemberWithTeam(...args),
}));

// getDb lives in the app-local lib/cf-db (it reads the Cloudflare Hyperdrive binding), not @pandora/db.
vi.mock("../../lib/cf-db", () => ({
  getDb: async () => mockGetDb(),
}));

import { formatPassPayload } from "@pandora/core";
import QRCode from "qrcode";
import { CheckinPassCard } from "./pass-card";

describe("CheckinPassCard", () => {
  const originalEnv = process.env;
  const dummySecret = ["synthetic", "secret", "fixture", "for", "tests", "32bytes"].join("-");
  const dummyToken = "A".repeat(40) + "b-_"; // 43 chars base64url

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, PASS_SECRET: dummySecret };
    mockGetDb.mockReturnValue({});
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns null when PASS_SECRET is missing", async () => {
    delete process.env.PASS_SECRET;

    const result = await CheckinPassCard({ memberId: "m-123" });
    expect(result).toBeNull();
  });

  it("returns null when no valid pass token exists (e.g., revoked, not shortlisted, or not issued)", async () => {
    mockGetPassToken.mockResolvedValue(null);

    const result = await CheckinPassCard({ memberId: "m-123" });
    expect(result).toBeNull();
  });

  it("calls getPassToken with db, memberId, and PASS_SECRET", async () => {
    const fakeDb = { tag: "test-db" };
    mockGetDb.mockReturnValue(fakeDb);
    mockGetPassToken.mockResolvedValue(dummyToken);
    mockGetMemberWithTeam.mockResolvedValue({
      member: { firstName: "Dev", lastName: "One" },
      team: { name: "Team Rocket" },
    });

    await CheckinPassCard({ memberId: "member-abc" });

    expect(mockGetPassToken).toHaveBeenCalledWith(fakeDb, {
      memberId: "member-abc",
      secret: dummySecret,
    });
  });

  it("passes the canonical formatPassPayload(token) to QRCode.toString with SVG type and renders pass content", async () => {
    mockGetPassToken.mockResolvedValue(dummyToken);
    mockGetMemberWithTeam.mockResolvedValue({
      member: { firstName: "Aarav", lastName: "Sharma" },
      team: { name: "Alpha" },
    });

    const qrSpy = vi.spyOn(QRCode, "toString");

    const element = await CheckinPassCard({ memberId: "member-1" });
    expect(element).not.toBeNull();

    const expectedPayload = formatPassPayload(dummyToken);
    expect(expectedPayload).toBe(`pandora-pass:${dummyToken}`);

    expect(qrSpy).toHaveBeenCalledWith(
      expectedPayload,
      expect.objectContaining({
        type: "svg",
        margin: 2,
        errorCorrectionLevel: "M",
        width: 220,
      }),
    );

    const html = renderToStaticMarkup(element!);
    expect(html).toContain("Aarav Sharma");
    expect(html).toContain("Show this at the entrance");
    expect(html).toContain("<svg");
  });

  it("falls back to 'Participant' when member info is not found", async () => {
    mockGetPassToken.mockResolvedValue(dummyToken);
    mockGetMemberWithTeam.mockResolvedValue(null);

    const element = await CheckinPassCard({ memberId: "member-fallback" });
    expect(element).not.toBeNull();

    const html = renderToStaticMarkup(element!);
    expect(html).toContain("Participant");
    expect(html).toContain("Show this at the entrance");
  });

  it("does not leak PASS_SECRET or raw token in rendered markup", async () => {
    mockGetPassToken.mockResolvedValue(dummyToken);
    mockGetMemberWithTeam.mockResolvedValue({
      member: { firstName: "Rohan", lastName: "Verma" },
      team: { name: "Delta" },
    });

    const element = await CheckinPassCard({ memberId: "member-2" });
    expect(element).not.toBeNull();
    const html = renderToStaticMarkup(element!);

    expect(html).not.toContain(dummySecret);
    expect(html).not.toContain(dummyToken);
  });
});
