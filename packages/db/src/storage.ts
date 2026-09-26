import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const STORAGE_BUCKET = "pandora-uploads";

export type Storage = {
  putFile(path: string, data: Uint8Array, contentType: string): Promise<void>;
  signedUrl(path: string, expiresInSeconds?: number): Promise<string>;
};

// Local development: files on disk. signedUrl returns a file:// URL, which is enough to check an upload happened.
export function diskStorage(rootDir: string): Storage {
  const root = resolve(rootDir);
  const safe = (path: string) => {
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
    async signedUrl(path) {
      return pathToFileURL(safe(path)).href;
    },
  };
}

export function supabaseStorage({ url, secretKey, bucket = STORAGE_BUCKET }: { url: string; secretKey: string; bucket?: string }): Storage {
  const client = createClient(url, secretKey, { auth: { persistSession: false } });
  return {
    async putFile(path, data, contentType) {
      const { error } = await client.storage.from(bucket).upload(path, data, { contentType, upsert: false });
      if (error) throw new Error(error.message);
    },
    async signedUrl(path, expiresInSeconds = 300) {
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
      if (error || !data) throw new Error(error?.message ?? "Could not sign URL");
      return data.signedUrl;
    },
  };
}

let cached: Storage | undefined;
export function getStorage(): Storage {
  if (cached) return cached;
  const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: secretKey, VERCEL } = process.env;
  if (url && secretKey) {
    cached = supabaseStorage({ url, secretKey });
  } else if (VERCEL) {
    // Vercel's disk is temporary and per-instance: uploads written there would be lost.
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set on Vercel");
  } else {
    cached = diskStorage(".storage");
  }
  return cached;
}
