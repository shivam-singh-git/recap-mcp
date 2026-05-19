/**
 * Project CRUD: create, read, list, archive.
 *
 * A project is a folder under projects/<slug>/ containing project.md
 * (frontmatter + description), tasks.md, notes.md, and a sessions/ folder.
 */

import { join } from "node:path";
import { existsSync } from "node:fs";
import {
  readMarkdown,
  writeMarkdown,
  ensureDir,
  listDirs,
  listFiles,
  moveDir,
} from "./markdown.js";
import {
  archivedProjectDir,
  projectDir,
  type WorkspaceContext,
} from "./workspace.js";
import type { Project, ProjectFrontmatter, ProjectStatus } from "../types.js";
import { countOpenTasks, getAllTasks } from "./tasks.js";
import { getLatestSession } from "./sessions.js";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export async function projectExists(
  ctx: WorkspaceContext,
  slug: string,
): Promise<boolean> {
  return (
    existsSync(join(projectDir(ctx, slug), "project.md")) ||
    existsSync(join(archivedProjectDir(ctx, slug), "project.md"))
  );
}

export async function readProject(
  ctx: WorkspaceContext,
  slug: string,
): Promise<Project | null> {
  const activePath = join(projectDir(ctx, slug), "project.md");
  const archivedPath = join(archivedProjectDir(ctx, slug), "project.md");
  const path = existsSync(activePath)
    ? activePath
    : existsSync(archivedPath)
      ? archivedPath
      : null;
  if (!path) return null;

  const parsed = await readMarkdown<ProjectFrontmatter>(path);
  if (!parsed) return null;

  const status: ProjectStatus = path === archivedPath ? "archived" : "active";
  const tasks = await getAllTasks(ctx, slug);
  const latestSession = await getLatestSession(ctx, slug);

  return {
    ...parsed.frontmatter,
    status,
    body: parsed.body,
    taskCount: tasks.length,
    openTaskCount: tasks.filter((t) => t.status === "open").length,
    lastSessionAt: latestSession?.date,
  };
}

export async function writeProject(
  ctx: WorkspaceContext,
  slug: string,
  frontmatter: ProjectFrontmatter,
  body: string,
): Promise<void> {
  const dir =
    frontmatter.status === "archived"
      ? archivedProjectDir(ctx, slug)
      : projectDir(ctx, slug);
  await ensureDir(dir);
  await ensureDir(join(dir, "sessions"));
  await ensureDir(join(dir, "knowledge"));
  await writeMarkdown(join(dir, "project.md"), frontmatter, body);
}

export async function listProjectSlugs(
  ctx: WorkspaceContext,
  statusFilter: ProjectStatus | "all" = "all",
): Promise<{ slug: string; status: ProjectStatus }[]> {
  const out: { slug: string; status: ProjectStatus }[] = [];

  if (statusFilter !== "archived") {
    const dirs = await listDirs(ctx.paths.projects);
    for (const d of dirs) {
      const slug = d.split(/[\\/]/).pop()!;
      if (existsSync(join(d, "project.md"))) out.push({ slug, status: "active" });
    }
  }

  if (statusFilter !== "active") {
    const dirs = await listDirs(ctx.paths.archived);
    for (const d of dirs) {
      const slug = d.split(/[\\/]/).pop()!;
      if (existsSync(join(d, "project.md"))) out.push({ slug, status: "archived" });
    }
  }

  return out;
}

export async function listProjects(
  ctx: WorkspaceContext,
  statusFilter: ProjectStatus | "all" = "all",
): Promise<Project[]> {
  const slugs = await listProjectSlugs(ctx, statusFilter);
  const results: Project[] = [];
  for (const { slug } of slugs) {
    const p = await readProject(ctx, slug);
    if (p) results.push(p);
  }
  results.sort((a, b) => b.updated.localeCompare(a.updated));
  return results;
}

export async function archiveProject(
  ctx: WorkspaceContext,
  slug: string,
): Promise<void> {
  const from = projectDir(ctx, slug);
  const to = archivedProjectDir(ctx, slug);
  if (!existsSync(from)) throw new Error(`Project '${slug}' is not active.`);
  await moveDir(from, to);

  const project = await readProject(ctx, slug);
  if (project) {
    const fm: ProjectFrontmatter = {
      name: project.name,
      slug: project.slug,
      status: "archived",
      created: project.created,
      updated: new Date().toISOString().slice(0, 10),
      description: project.description,
      template: project.template,
    };
    await writeMarkdown(join(to, "project.md"), fm, project.body);
  }
}

export async function touchProject(
  ctx: WorkspaceContext,
  slug: string,
): Promise<void> {
  const p = await readProject(ctx, slug);
  if (!p) return;
  const fm: ProjectFrontmatter = {
    name: p.name,
    slug: p.slug,
    status: p.status,
    created: p.created,
    updated: new Date().toISOString().slice(0, 10),
    description: p.description,
    template: p.template,
  };
  await writeProject(ctx, slug, fm, p.body);
}

export async function findSimilarSlug(
  ctx: WorkspaceContext,
  query: string,
): Promise<string | null> {
  const slugs = (await listProjectSlugs(ctx)).map((s) => s.slug);
  const q = slugify(query);
  if (slugs.includes(q)) return q;

  // simple fuzzy: closest by levenshtein-ish (cheap heuristic)
  let best: { slug: string; score: number } | null = null;
  for (const slug of slugs) {
    const score = sharedChars(q, slug);
    if (!best || score > best.score) best = { slug, score };
  }
  return best && best.score >= Math.min(3, q.length / 2) ? best.slug : null;
}

function sharedChars(a: string, b: string): number {
  let count = 0;
  const seen = new Set<number>();
  for (const ch of a) {
    const idx = b.indexOf(ch, 0);
    if (idx >= 0 && !seen.has(idx)) {
      count++;
      seen.add(idx);
    }
  }
  return count;
}
