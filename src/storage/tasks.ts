/**
 * Task CRUD.
 *
 * Tasks for a project live in projects/<slug>/tasks.md. The frontmatter
 * carries a `tasks:` array; the body below renders the same data as
 * checkbox markdown for human readability and Obsidian compatibility.
 *
 * Write strategy: read the file, mutate in memory, write the whole thing
 * atomically. At personal-task scale (tens to low hundreds per project)
 * this is simpler and safer than surgical edits.
 */

import { join } from "node:path";
import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { readMarkdown, writeMarkdown } from "./markdown.js";
import { projectDir, archivedProjectDir, type WorkspaceContext } from "./workspace.js";
import type { Task, TaskStatus, Priority } from "../types.js";

interface TasksFrontmatter {
  tasks: Task[];
}

function tasksPath(ctx: WorkspaceContext, slug: string): string | null {
  const active = join(projectDir(ctx, slug), "tasks.md");
  const archived = join(archivedProjectDir(ctx, slug), "tasks.md");
  if (existsSync(active)) return active;
  if (existsSync(archived)) return archived;
  return null;
}

function defaultTasksPath(ctx: WorkspaceContext, slug: string): string {
  return join(projectDir(ctx, slug), "tasks.md");
}

export function newTaskId(): string {
  return `t_${randomBytes(2).toString("hex")}${Date.now().toString(36).slice(-2)}`;
}

function renderBody(tasks: Task[]): string {
  if (tasks.length === 0) return "No tasks yet.\n";
  const lines: string[] = ["# Tasks", ""];
  const open = tasks.filter((t) => t.status === "open");
  const blocked = tasks.filter((t) => t.status === "blocked");
  const done = tasks.filter((t) => t.status === "done");

  if (open.length) {
    lines.push("## Open", "");
    for (const t of open) lines.push(renderTaskLine(t));
    lines.push("");
  }
  if (blocked.length) {
    lines.push("## Blocked", "");
    for (const t of blocked) lines.push(renderTaskLine(t));
    lines.push("");
  }
  if (done.length) {
    lines.push("## Done", "");
    for (const t of done) lines.push(renderTaskLine(t));
    lines.push("");
  }
  return lines.join("\n");
}

function renderTaskLine(t: Task): string {
  const box = t.status === "done" ? "[x]" : t.status === "blocked" ? "[!]" : "[ ]";
  const tags: string[] = [];
  if (t.priority !== "medium") tags.push(`priority:${t.priority}`);
  if (t.due) tags.push(`due:${t.due}`);
  tags.push(`id:${t.id}`);
  const tagStr = tags.length ? ` <!-- ${tags.join(" ")} -->` : "";
  const notesStr = t.notes ? `\n  _${t.notes}_` : "";
  return `- ${box} ${t.title}${tagStr}${notesStr}`;
}

export async function getAllTasks(
  ctx: WorkspaceContext,
  slug: string,
): Promise<Task[]> {
  const path = tasksPath(ctx, slug);
  if (!path) return [];
  const parsed = await readMarkdown<TasksFrontmatter>(path);
  if (!parsed) return [];
  return parsed.frontmatter.tasks ?? [];
}

export async function countOpenTasks(
  ctx: WorkspaceContext,
  slug: string,
): Promise<number> {
  const tasks = await getAllTasks(ctx, slug);
  return tasks.filter((t) => t.status === "open").length;
}

export async function writeTasks(
  ctx: WorkspaceContext,
  slug: string,
  tasks: Task[],
): Promise<void> {
  const path = tasksPath(ctx, slug) ?? defaultTasksPath(ctx, slug);
  await writeMarkdown<TasksFrontmatter>(path, { tasks }, renderBody(tasks));
}

export interface NewTaskInput {
  title: string;
  priority?: Priority;
  due?: string;
  notes?: string;
}

export async function addTask(
  ctx: WorkspaceContext,
  slug: string,
  input: NewTaskInput,
): Promise<Task> {
  const tasks = await getAllTasks(ctx, slug);
  const now = new Date().toISOString().slice(0, 10);
  const task: Task = {
    id: newTaskId(),
    title: input.title,
    status: "open",
    priority: input.priority ?? "medium",
    due: input.due,
    created: now,
    updated: now,
    notes: input.notes,
  };
  tasks.push(task);
  await writeTasks(ctx, slug, tasks);
  return task;
}

export interface TaskUpdate {
  status?: TaskStatus;
  priority?: Priority;
  due?: string | null;
  notes?: string | null;
  title?: string;
}

export async function updateTask(
  ctx: WorkspaceContext,
  slug: string,
  taskId: string,
  patch: TaskUpdate,
): Promise<Task | null> {
  const tasks = await getAllTasks(ctx, slug);
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) return null;

  const existing = tasks[idx];
  const updated: Task = {
    ...existing,
    title: patch.title ?? existing.title,
    status: patch.status ?? existing.status,
    priority: patch.priority ?? existing.priority,
    due: patch.due === null ? undefined : (patch.due ?? existing.due),
    notes: patch.notes === null ? undefined : (patch.notes ?? existing.notes),
    updated: new Date().toISOString().slice(0, 10),
  };
  tasks[idx] = updated;
  await writeTasks(ctx, slug, tasks);
  return updated;
}

export async function deleteTask(
  ctx: WorkspaceContext,
  slug: string,
  taskId: string,
): Promise<boolean> {
  const tasks = await getAllTasks(ctx, slug);
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) return false;
  tasks.splice(idx, 1);
  await writeTasks(ctx, slug, tasks);
  return true;
}

export async function findTaskById(
  ctx: WorkspaceContext,
  slug: string,
  taskId: string,
): Promise<Task | null> {
  const tasks = await getAllTasks(ctx, slug);
  return tasks.find((t) => t.id === taskId) ?? null;
}
