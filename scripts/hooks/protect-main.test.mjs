import { describe, expect, it } from "vitest";
import { pushesToMain } from "./protect-main.mjs";

const sha = (c) => c.repeat(40);

describe("pushesToMain", () => {
  it("is true when any pushed ref targets main", () => {
    expect(pushesToMain(`refs/heads/main ${sha("a")} refs/heads/main ${sha("b")}\n`)).toBe(true);
    expect(pushesToMain(`refs/heads/feature ${sha("a")} refs/heads/main ${sha("0")}\n`)).toBe(true);
  });

  it("is true when main is one of several refs", () => {
    const stdin = [
      `refs/heads/7-form ${sha("a")} refs/heads/7-form ${sha("b")}`,
      `refs/heads/main ${sha("c")} refs/heads/main ${sha("d")}`,
    ].join("\n");
    expect(pushesToMain(stdin)).toBe(true);
  });

  it("is true for deleting main", () => {
    expect(pushesToMain(`(delete) ${sha("0")} refs/heads/main ${sha("b")}`)).toBe(true);
  });

  it("is false for feature branches, tags and empty input", () => {
    expect(pushesToMain(`refs/heads/main ${sha("a")} refs/heads/7-form ${sha("0")}\n`)).toBe(false);
    expect(pushesToMain(`refs/heads/x ${sha("a")} refs/heads/main-fix ${sha("0")}\n`)).toBe(false);
    expect(pushesToMain(`refs/tags/v1 ${sha("a")} refs/tags/main ${sha("0")}\n`)).toBe(false);
    expect(pushesToMain("")).toBe(false);
    expect(pushesToMain("\r\n")).toBe(false);
  });

  it("handles Windows line endings", () => {
    expect(pushesToMain(`refs/heads/main ${sha("a")} refs/heads/main ${sha("b")}\r\n`)).toBe(true);
  });
});
