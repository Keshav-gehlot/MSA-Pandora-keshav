import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { diskStorage, fileUrl, r2Storage, type R2BucketLike } from "./storage";

async function bytesOf(body: BodyInit): Promise<number[]> {
  return [...new Uint8Array(await new Response(body).arrayBuffer())];
}

describe("diskStorage", () => {
  it("stores a file and reads it back with its content type", async () => {
    const storage = diskStorage(mkdtempSync(join(tmpdir(), "storage-")));
    await storage.putFile("teams/t1/photos/a.png", new Uint8Array([1, 2, 3]), "image/png");

    const file = await storage.getFile("teams/t1/photos/a.png");
    expect(file?.contentType).toBe("image/png");
    expect(await bytesOf(file!.body)).toEqual([1, 2, 3]);
  });

  it("returns null for a file that isn't there", async () => {
    const storage = diskStorage(mkdtempSync(join(tmpdir(), "storage-")));
    expect(await storage.getFile("teams/t1/photos/missing.png")).toBeNull();
  });

  it("refuses paths that escape its folder", async () => {
    const storage = diskStorage(mkdtempSync(join(tmpdir(), "storage-")));
    await expect(storage.putFile("../evil.txt", new Uint8Array([1]), "text/plain")).rejects.toThrow("Invalid storage path");
    await expect(storage.getFile("a/../../evil.txt")).rejects.toThrow("Invalid storage path");
  });
});

describe("r2Storage", () => {
  function fakeBucket() {
    const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
    const bucket: R2BucketLike = {
      put: vi.fn(async (key, value, options) => {
        objects.set(key, { bytes: value, contentType: options?.httpMetadata?.contentType });
      }),
      get: vi.fn(async (key) => {
        const object = objects.get(key);
        if (!object) return null;
        return { body: new Blob([object.bytes as BlobPart]).stream(), httpMetadata: { contentType: object.contentType } };
      }),
    };
    return bucket;
  }

  it("stores a file with its content type and reads it back", async () => {
    const storage = r2Storage(fakeBucket());
    await storage.putFile("teams/t1/payment/p.png", new Uint8Array([9, 8]), "image/png");

    const file = await storage.getFile("teams/t1/payment/p.png");
    expect(file?.contentType).toBe("image/png");
    expect(await bytesOf(file!.body)).toEqual([9, 8]);
  });

  it("returns null for a missing key", async () => {
    expect(await r2Storage(fakeBucket()).getFile("teams/t1/photos/nope.png")).toBeNull();
  });

  it("refuses unsafe keys before touching the bucket", async () => {
    const bucket = fakeBucket();
    const storage = r2Storage(bucket);

    await expect(storage.putFile("/abs.png", new Uint8Array([1]), "image/png")).rejects.toThrow("Invalid storage path");
    await expect(storage.getFile("teams/../x")).rejects.toThrow("Invalid storage path");
    expect(bucket.put).not.toHaveBeenCalled();
    expect(bucket.get).not.toHaveBeenCalled();
  });
});

describe("fileUrl", () => {
  it("points at the console's authenticated file route and encodes each segment", () => {
    expect(fileUrl("teams/t1/photos/1.png")).toBe("/files/teams/t1/photos/1.png");
    expect(fileUrl("teams/a b/x#y.png")).toBe("/files/teams/a%20b/x%23y.png");
  });
});
