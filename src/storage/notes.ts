/**
 * Quick notes: friction-free timestamped capture per project.
 *
 * All notes for a project live in a single notes.md, appended chronologically.
 * Each note has an id (timestamp-derived) so it can be searched and referenced.
 */

import { join } from "node:path";
import { existsSync } from "node:fs";
import { readMarkdown, writeMarkdown } from "./markdown.js";
import { projectDir, archivedProjectDir, type WorkspaceContext } from "./workspace.js";
import type { Note } from "../types.js";

interface NotesFrontmatter {
  notes: Note[];
}

function notesPath(ctx: WorkspaceContext, slug: string): string | null {
  const active = join(projectDir(ctx, slug), "notes.md");
  const archived = join(archivedProjectDir(ctx, slug), "notes.md");
  if (existsSync(active)) return active;
  if (existsSync(archived)) return archived;
  return null;
}

function defaultNotesPath(ctx: WorkspaceContext, slug: string): string {
  return join(projectDir(ctx, slug), "notes.md");
}

function renderBody(notes: Note[]): string {
  if (notes.length === 0) return "No notes yet.\n";
  const lines: string[] = ["# Notes", ""];
  for (const n of [...notes].reverse()) {
    lines.push(`### ${n.created}`);
    lines.push("");
    lines.push(n.content);
    lines.push("");
  }
  return lines.join("\n");
}

export async function getAllNotes(
  ctx: WorkspaceContext,
  slug: string,
): Promise<Note[]> {
  const path = notesPath(ctx, slug);
  if (!path) return [];
  const parsed = await readMarkdown<NotesFrontmatter>(path);
  if (!parsed) return [];
  return parsed.frontmatter.notes ?? [];
}

export async function addNote(
  ctx: WorkspaceContext,
  slug: string,
  content: string,
): Promise<Note> {
  const notes = await getAllNotes(ctx, slug);
  const now = new Date().toISOString();
  const note: Note = {
    id: `n_${Date.now().toString(36)}`,
    project: slug,
    created: now,
    content,
  };
  notes.push(note);
  const path = notesPath(ctx, slug) ?? defaultNotesPath(ctx, slug);
  await writeMarkdown<NotesFrontmatter>(path, { notes }, renderBody(notes));
  return note;
}
