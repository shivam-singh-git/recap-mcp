/**
 * project_brief: load full context for a single project.
 *
 * Returns the description, knowledge files, open tasks, and the most recent
 * sessions. This is the "load everything about this project into Claude's
 * context" tool.
 */

import { z } from "zod";
import { join } from "node:path";
import { promises as fs, existsSync } from "node:fs";
import { ensureWorkspace, projectDir, archivedProjectDir } from "../storage/workspace.js";
import { findSimilarSlug, readProject } from "../storage/projects.js";
import { getAllTasks } from "../storage/tasks.js";
import { listSessions } from "../storage/sessions.js";
import { getAllNotes } from "../storage/notes.js";

export const projectBriefSchema = z.object({
  project: z.string().describe("Project slug or name."),
  recent_sessions: z
    .number()
    .int()
    .min(0)
    .max(20)
    .default(3)
    .describe("How many recent session logs to include in full."),
});

export type ProjectBriefInput = z.infer<typeof projectBriefSchema>;

export async function projectBrief(input: ProjectBriefInput) {
  const ctx = await ensureWorkspace();
  const project = await readProject(ctx, input.project);

  if (!project) {
    const suggestion = await findSimilarSlug(ctx, input.project);
    return {
      error: "project_not_found",
      message: `No project named '${input.project}'.`,
      suggestion,
    };
  }

  const tasks = await getAllTasks(ctx, project.slug);
  const sessions = await listSessions(ctx, project.slug);
  const notes = await getAllNotes(ctx, project.slug);

  // Knowledge files
  const dir =
    project.status === "archived"
      ? archivedProjectDir(ctx, project.slug)
      : projectDir(ctx, project.slug);
  const knowledgeDir = join(dir, "knowledge");
  const knowledge: { filename: string; content: string }[] = [];
  if (existsSync(knowledgeDir)) {
    const files = await fs.readdir(knowledgeDir);
    for (const f of files) {
      const content = await fs.readFile(join(knowledgeDir, f), "utf-8");
      knowledge.push({ filename: f, content });
    }
  }

  return {
    project: {
      slug: project.slug,
      name: project.name,
      status: project.status,
      description: project.description,
      body: project.body,
      created: project.created,
      updated: project.updated,
      template: project.template,
    },
    open_tasks: tasks.filter((t) => t.status === "open"),
    blocked_tasks: tasks.filter((t) => t.status === "blocked"),
    done_tasks_count: tasks.filter((t) => t.status === "done").length,
    knowledge,
    recent_sessions: sessions.slice(0, input.recent_sessions),
    older_sessions_count: Math.max(0, sessions.length - input.recent_sessions),
    notes_count: notes.length,
    most_recent_notes: notes.slice(-5),
  };
}
