import { describe, expect, it } from "vitest";
import { checkinTemplates } from "./index";
import { passReady } from "./pass-ready";
import { render } from "@react-email/render";

describe("checkin-pass-ready template", () => {
  const sampleProps = {
    firstName: "Aarav",
    teamName: "Pandora Devs",
    dashboardUrl: "https://pandora.msasrm.in/dashboard",
  };

  it("is registered under checkin-pass-ready in checkinTemplates", () => {
    expect(checkinTemplates).toHaveProperty("checkin-pass-ready");
    expect(checkinTemplates["checkin-pass-ready"]).toBe(passReady);
  });

  it("produces the required subject", () => {
    expect(passReady.subject(sampleProps)).toBe("Your MSA Pandora event pass is ready");
  });

  it("renders text with firstName, teamName, and the dashboardUrl link", () => {
    const text = passReady.text(sampleProps);
    expect(text).toContain("Aarav");
    expect(text).toContain("Pandora Devs");
    expect(text).toContain("https://pandora.msasrm.in/dashboard");
    expect(text).toContain("Show this pass at the entrance");
  });

  it("renders html with firstName, teamName, and the dashboardUrl link", async () => {
    const htmlOutput = await render(passReady.html(sampleProps));
    expect(htmlOutput).toContain("Aarav");
    expect(htmlOutput).toContain("Pandora Devs");
    expect(htmlOutput).toContain("https://pandora.msasrm.in/dashboard");
  });
});
