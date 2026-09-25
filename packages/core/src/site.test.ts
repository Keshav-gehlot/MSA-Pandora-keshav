import { describe, expect, it } from "vitest";
import { pageTitle, siteConfig } from "./site";

describe("pageTitle", () => {
  it("is just the event name with no section", () => {
    expect(pageTitle()).toBe("MSA Pandora");
  });

  it("puts the section before the event name", () => {
    expect(pageTitle("Register")).toBe("Register · MSA Pandora");
  });

  it("ignores a blank section", () => {
    expect(pageTitle("   ")).toBe("MSA Pandora");
  });
});

describe("siteConfig", () => {
  it("points each app at its own domain", () => {
    expect(siteConfig.urls).toEqual({
      web: "https://pandora.msasrm.in",
      console: "https://console.pandora.msasrm.in",
    });
  });
});
