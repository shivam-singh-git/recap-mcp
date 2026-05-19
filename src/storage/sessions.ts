/**
 * Session log CRUD.
 *
 * One file per session per project: projects/<slug>/sessions/YYYY-MM-DD.md
 * If two sessions are logged the same day, the newer one overwrites
 * (with merged content) rather than creating a clash file. Worth
 * revisiting if users complain.
 */

import { join, basename } from "node:path";
import { existsSync } from "node:fs";
import { readMarkdown, writeMarkdown, listFiles } from "./markdown.js";
import { projectDir, archivedProjectDir, type WorkspaceContext } from "./workspace.js";
import type { SessionLog } from "../types.js";

interface SessionFrontmatter {
  date: string;
  project: string;
  duration_minutes?: number;
}

function sessionsDir(ctx: WorkspaceContext, slug: string): string {
  const active = join(projectDir(ctx, slug), "sessions");
  const archived = join(archivedProjectDir(ctx, slug), "sessions");
  if (existsSync(active)) return active;
  if (existsSync(archived)) return archived;
  return active; // default: write to active
}

function renderSessionBody(s: SessionLog): string {
  const lines: string[] = [];
  lines.push("## What I worked on", "", s.worked_on || "_Nothing logged._", "");
  if (s.decisions) lines.push("## Decisions", "", s.decisions, "");
  if (s.next_steps) lines.push("## Next steps", "", s.next_steps, "");
  return lines.join("\n");
}

function parseSessionBody(body: string): {
  worked_on: string;
  decisions?: string;
  next_steps?: string;
} {
  const sections: Record<string, string> = {};
  const lines = body.split(/\r?\n/);
  let currentKey: string | null = null;
  let buffer: string[] = [];

  const flush = (): void => {
    if (currentKey) sections[currentKey] = buffer.join("\n").trim();
    buffer = [];
  };

  for (const line of lines) {
    const headerMatch = /^##\s+(.+)$/.exec(line);
    if (headerMatch) {
      flush();
      const heading = headerMatch[1].toLowerCase().trim();
      if (heading.includes("worked")) currentKey = "worked_on";
      else if (heading.includes("decision")) currentKey = "decisions";
      else if (heading.includes("next")) currentKey = "next_steps";
      else currentKey = null;
      continue;
    }
    if (currentKey) buffer.push(line);
  }
  flush();

  return {
    worked_on: sections.worked_on ?? "",
    decisions: sections.decisions || undefined,
    next_steps: sections.next_steps || undefined,
  };
}

export async function writeSession(
  ctx: WorkspaceContext,
  slug: string,
  session: SessionLog,
): Promise<void> {
  const dir = sessionsDir(ctx, slug);
  const path = join(dir, `${session.date}.md`);
  const fm: SessionFrontmatter = {
    date: session.date,
    project: slug,
    duration_minutes: session.duration_minutes,
  };
  await writeMarkdown<SessionFrontmatter>(path, fm, renderSessionBody(session));
}

export async function readSession(
  filepath: string,
): Promise<SessionLog | null> {
  const parsed = await readMarkdown<SessionFrontmatter>(filepath);
  if (!parsed) return null;
  const body = parseSessionBody(parsed.body);
  return {
    date: parsed.frontmatter.date,
    project: parsed.frontmatter.project,
    duration_minutes: parsed.frontmatter.duration_minutes,
    ...body,
  };
}

export async function listSessions(
  ctx: WorkspaceContext,
  slug: string,
): Promise<SessionLog[]> {
  const dir = sessionsDir(ctx, slug);
  if (!existsSync(dir)) return [];
  const files = await listFiles(dir, ".md");
  const sessions: SessionLog[] = [];
  for (const f of files) {
    const s = await readSession(f);
    if (s) sessions.push(s);
  }
  sessions.sort((a, b) => b.date.localeCompare(a.date));
  return sessions;
}

export async function getLatestSession(
  ctx: WorkspaceContext,
  slug: string,
): Promise<SessionLog | null> {
  const all = await listSessions(ctx, slug);
  return all[0] ?? null;
}

export async function getRecentSessionsAcrossAllProjects(
  ctx: WorkspaceContext,
  recentDays: number,
  projectSlugs: string[],
): Promise<Array<SessionLog & { slug: string }>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - recentDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const all: Array<SessionLog & { slug: string }> = [];
  for (const slug of projectSlugs) {
    const sessions = await listSessions(ctx, slug);
    for (const s of sessions) {
      if (s.date >= cutoffStr) all.push({ ...s, slug });
    }
  }
  all.sort((a, b) => b.date.localeCompare(a.date));
  return all;
}
