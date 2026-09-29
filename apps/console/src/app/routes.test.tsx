import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Provide global React for Node-based test execution of server components
// where the JSX transform targets React.createElement.
(globalThis as unknown as { React: typeof React }).React = React;

// The pages import the user menu, which imports the sign-in Server Actions, which import lib/cf-db ("server-only").
vi.mock("server-only", () => ({}));

const redirectMock = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  usePathname: () => "/",
}));

const requireStaffMock = vi.fn();
vi.mock("../lib/session", () => ({
  requireStaff: () => requireStaffMock(),
}));

vi.mock("@pandora/db", () => ({
  getDb: vi.fn(),
  attendanceSummary: vi.fn().mockResolvedValue([
    { teamId: "t-1", teamName: "Alpha", expected: 4, present: 2 },
  ]),
}));

import ConsoleHomePage from "./page";
import StaffAttendancePage from "./staff/attendance/page";
import StaffPortalPage from "./staff/page";

describe("ConsoleHomePage (/) routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects staff role to /staff", async () => {
    requireStaffMock.mockResolvedValueOnce({
      id: "staff-1",
      email: "volunteer@srmist.edu.in",
      name: "Volunteer",
      role: "staff",
    });

    await expect(ConsoleHomePage()).rejects.toThrow("REDIRECT:/staff");
    expect(redirectMock).toHaveBeenCalledWith("/staff");
  });

  it("renders admin shell for admin role", async () => {
    requireStaffMock.mockResolvedValueOnce({
      id: "admin-1",
      email: "admin@srmist.edu.in",
      name: "Admin User",
      role: "admin",
    });

    const page = await ConsoleHomePage();
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Overview");
    expect(html).toContain("Admin Shell Ready");
    expect(html).toContain("Admin User");
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("StaffPortalPage (/staff) routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders staff portal shell and checkin scanner for authenticated staff", async () => {
    requireStaffMock.mockResolvedValueOnce({
      id: "staff-1",
      email: "volunteer@srmist.edu.in",
      name: "Volunteer",
      role: "staff",
    });

    const page = await StaffPortalPage();
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Staff Portal");
    expect(html).toContain("Volunteer");
    expect(html).toContain("Camera Scanner");
    expect(html).toContain("Manual Search");
    expect(html).toContain("Attendance Dashboard");
  });

  it("renders staff portal shell for authenticated admin", async () => {
    requireStaffMock.mockResolvedValueOnce({
      id: "admin-1",
      email: "admin@srmist.edu.in",
      name: "Admin User",
      role: "admin",
    });

    const page = await StaffPortalPage();
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Staff Portal");
    expect(html).toContain("Admin User");
  });
});

describe("StaffAttendancePage (/staff/attendance) routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders attendance metrics and team breakdown for authenticated staff", async () => {
    requireStaffMock.mockResolvedValueOnce({
      id: "staff-1",
      email: "volunteer@srmist.edu.in",
      name: "Volunteer",
      role: "staff",
    });

    const page = await StaffAttendancePage();
    const html = renderToStaticMarkup(page);
    expect(html).toContain("Staff Portal");
    expect(html).toContain("Back to Scanner");
    expect(html).toContain("Total Attendance");
    expect(html).toContain("Alpha");
    expect(html).toContain("2");
    expect(html).toContain("4");
  });
});
