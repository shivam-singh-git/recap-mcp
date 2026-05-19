/**
 * task_update: change status, priority, due date, notes, or title of a task.
 */

import { z } from "zod";
import { ensureWorkspace } from "../storage/workspace.js";
import { findTaskById, updateTask } from "../storage/tasks.js";
import { findSimilarSlug, readProject, touchProject } from "../storage/projects.js";

export const taskUpdateSchema = z.object({
  project: z.string().describe("Project slug or name."),
  task_id: z.string().describe("The task id (e.g. 't_a8f2x9')."),
  status: z
    .enum(["open", "done", "blocked"])
    .optional()
    .describe("New status."),
  priority: z
    .enum(["low", "medium", "high"])
    .optional()
    .describe("New priority."),
  due: z
    .string()
    .nullable()
    .optional()
    .describe("New due date (YYYY-MM-DD), or null to clear."),
  notes: z
    .string()
    .nullable()
    .optional()
    .describe("New notes, or null to clear."),
  title: z.string().optional().describe("New title."),
});

export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

export async function taskUpdate(input: TaskUpdateInput) {
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

  const existing = await findTaskById(ctx, project.slug, input.task_id);
  if (!existing) {
    return {
      error: "task_not_found",
      message: `No task with id '${input.task_id}' in project '${project.slug}'.`,
    };
  }

  const updated = await updateTask(ctx, project.slug, input.task_id, {
    status: input.status,
    priority: input.priority,
    due: input.due,
    notes: input.notes,
    title: input.title,
  });
  await touchProject(ctx, project.slug);
  return { ok: true, project: project.slug, task: updated };
}
