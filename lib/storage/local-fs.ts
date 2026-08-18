import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { NotFoundError } from "@/lib/errors";
import type { StorageDriver } from "./types";

const ROOT = resolve(process.cwd(), ".storage-local");

/**
 * Dev driver (STORAGE_DRIVER=local-fs, the default — lib/env.ts). Keys are namespaced
 * `<workspace_id>/<vendor_id>/<uuid>-<filename>` by the caller
 * (lib/services/vendor-documents.ts); this driver treats a key as an opaque relative path
 * and never interprets its segments.
 */
export class LocalFsStorageDriver implements StorageDriver {
  async put(key: string, body: Buffer): Promise<{ size: number }> {
    const path = resolveKeyPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    return { size: body.byteLength };
  }

  async get(key: string): Promise<Buffer> {
    const path = resolveKeyPath(key);
    try {
      return await readFile(path);
    } catch {
      throw new NotFoundError(`Storage object not found: ${key}`);
    }
  }

  async list(prefix: string): Promise<string[]> {
    const startDir = resolveKeyPath(prefix);
    const keys: string[] = [];
    await walk(startDir, keys);
    return keys;
  }

  async delete(key: string): Promise<void> {
    const path = resolveKeyPath(key);
    await rm(path, { force: true });
  }
}

async function walk(dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // prefix doesn't exist yet — an empty result, not an error
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, out);
    } else {
      out.push(relative(ROOT, fullPath).split(sep).join("/"));
    }
  }
}

/**
 * A key is caller-generated (UUID-based) today, never client-supplied, so path traversal
 * isn't reachable yet — this guard is what keeps that true if a future caller ever builds a
 * key from less trustworthy input.
 */
function resolveKeyPath(key: string): string {
  const path = resolve(ROOT, key);
  if (path !== ROOT && !path.startsWith(ROOT + sep)) {
    throw new NotFoundError(`Storage object not found: ${key}`);
  }
  return path;
}
