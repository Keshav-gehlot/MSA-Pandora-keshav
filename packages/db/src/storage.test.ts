import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { diskStorage } from "./storage";

describe("diskStorage", () => {
  it("writes files under the root and returns a file URL for them", async () => {
    const root = mkdtempSync(join(tmpdir(), "storage-"));
    const storage = diskStorage(root);
    await storage.putFile("teams/t1/photo/a.png", new Uint8Array([1, 2, 3]), "image/png");
    const file = join(root, "teams", "t1", "photo", "a.png");
    expect(existsSync(file)).toBe(true);
    expect([...readFileSync(file)]).toEqual([1, 2, 3]);
    expect(await storage.signedUrl("teams/t1/photo/a.png")).toMatch(/^file:\/\//);
  });

  it("refuses paths that escape the root", async () => {
    const storage = diskStorage(mkdtempSync(join(tmpdir(), "storage-")));
    await expect(storage.putFile("../evil.txt", new Uint8Array([1]), "text/plain")).rejects.toThrow("Invalid storage path");
  });
});

describe("getStorage", () => {
  const KEYS = ["VERCEL", "SUPABASE_URL", "SUPABASE_SECRET_KEY"] as const;
  let saved: Partial<Record<(typeof KEYS)[number], string>>;
  beforeEach(() => {
    saved = {};
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    vi.resetModules(); // getStorage caches its result per module instance
  });
  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
  const load = async () => (await import("./storage")).getStorage;

  it("uses disk storage off Vercel when Supabase isn't configured", async () => {
    expect((await load())()).toBeDefined();
  });
  it("refuses to fall back to disk on Vercel", async () => {
    process.env.VERCEL = "1";
    const getStorage = await load();
    expect(() => getStorage()).toThrow("SUPABASE_URL and SUPABASE_SECRET_KEY must be set on Vercel");
    process.env.SUPABASE_URL = "https://example.supabase.co";
    expect(() => getStorage()).toThrow("SUPABASE_URL and SUPABASE_SECRET_KEY must be set on Vercel");
  });
});
