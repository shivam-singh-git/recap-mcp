/**
 * Markdown read/write helpers with frontmatter.
 *
 * Every file in the workspace follows the same shape: YAML frontmatter
 * at the top, free-form markdown below. gray-matter handles parsing.
 *
 * Writes are atomic: write to a .tmp file, then rename. This prevents
 * corruption if the process dies mid-write.
 */

import { promises as fs, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import matter from "gray-matter";

export interface ParsedFile<T> {
  frontmatter: T;
  body: string;
}

export async function readMarkdown<T>(
  filepath: string,
): Promise<ParsedFile<T> | null> {
  if (!existsSync(filepath)) return null;
  const raw = await fs.readFile(filepath, "utf-8");
  // Pass an options object to disable gray-matter's internal cache, which
  // returns stale data when the same file is rewritten in-process.
  const parsed = matter(raw, { excerpt: false });
  return {
    frontmatter: parsed.data as T,
    body: parsed.content,
  };
}

export async function writeMarkdown<T>(
  filepath: string,
  frontmatter: T,
  body: string,
): Promise<void> {
  await ensureDir(dirname(filepath));
  const cleaned = stripUndefined(frontmatter) as Record<string, unknown>;
  const serialized = matter.stringify(body, cleaned);
  const tmpPath = `${filepath}.tmp`;
  await fs.writeFile(tmpPath, serialized, "utf-8");
  await fs.rename(tmpPath, filepath);
}

/**
 * Recursively remove keys whose value is `undefined`. YAML can't serialize
 * undefined; this is the safety net so storage writes never crash on it.
 */
function stripUndefined<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

export async function ensureDir(dirpath: string): Promise<void> {
  if (existsSync(dirpath)) return;
  await fs.mkdir(dirpath, { recursive: true });
}

export async function listFiles(dirpath: string, extension = ".md"): Promise<string[]> {
  if (!existsSync(dirpath)) return [];
  const entries = await fs.readdir(dirpath, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(extension))
    .map((e) => join(dirpath, e.name));
}

export async function listDirs(dirpath: string): Promise<string[]> {
  if (!existsSync(dirpath)) return [];
  const entries = await fs.readdir(dirpath, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => join(dirpath, e.name));
}

export async function fileExists(filepath: string): Promise<boolean> {
  return existsSync(filepath);
}

export async function deleteFile(filepath: string): Promise<void> {
  if (existsSync(filepath)) await fs.unlink(filepath);
}

export async function moveDir(from: string, to: string): Promise<void> {
  await ensureDir(dirname(to));
  await fs.rename(from, to);
}
