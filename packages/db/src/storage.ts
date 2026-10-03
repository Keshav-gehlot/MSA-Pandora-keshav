import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";

export type StoredFile = { body: BodyInit; contentType: string };

export type Storage = {
  putFile(path: string, data: Uint8Array, contentType: string): Promise<void>;
  /** The stored file, or null when nothing is stored at `path`. */
  getFile(path: string): Promise<StoredFile | null>;
};

// Files are never given out by direct link: the console serves them from this route, behind staff sign-in
// (apps/console/src/app/files). Only the console reads files; the public site only writes them.
export function fileUrl(path: string): string {
  return `/files/${path.split("/").map(encodeURIComponent).join("/")}`;
}

// Keys are generated server-side (teams/<id>/photos/1.png), but are checked anyway so a bad one can never escape
// the bucket or the storage folder.
function checkPath(path: string): void {
  const parts = path.split("/");
  if (path === "" || path.startsWith("/") || parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("Invalid storage path");
  }
}

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

// Local development: files on disk.
export function diskStorage(rootDir: string): Storage {
  const root = resolve(rootDir);
  const safe = (path: string) => {
    checkPath(path);
    const full = resolve(root, path);
    const rel = relative(root, full);
    if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) throw new Error("Invalid storage path");
    return full;
  };
  return {
    async putFile(path, data) {
      const full = safe(path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, data);
    },
    async getFile(path) {
      const full = safe(path);
      try {
        const bytes = readFileSync(full);
        return { body: new Uint8Array(bytes), contentType: CONTENT_TYPES[extname(full).toLowerCase()] ?? "application/octet-stream" };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
  };
}

// The slice of a Cloudflare R2 bucket binding that this file uses, so this package doesn't depend on the Workers types.
export type R2BucketLike = {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
};

// Deployed: a Cloudflare R2 bucket, attached to the Worker as a binding (wrangler.jsonc "r2_buckets").
export function r2Storage(bucket: R2BucketLike): Storage {
  return {
    async putFile(path, data, contentType) {
      checkPath(path);
      await bucket.put(path, data, { httpMetadata: { contentType } });
    },
    async getFile(path) {
      checkPath(path);
      const object = await bucket.get(path);
      if (!object) return null;
      return { body: object.body, contentType: object.httpMetadata?.contentType ?? "application/octet-stream" };
    },
  };
}
