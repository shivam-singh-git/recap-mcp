/**
 * task_add: add a task to a project.
 */

import { z } from "zod";
import { ensureWorkspace } from "../storage/workspace.js";
import { addTask } from "../storage/tasks.js";
import { findSimilarSlug, readProject, touchProject } from "../storage/projects.js";

export const taskAddSchema = z.object({
  project: z.string().describe("Project slug or name."),
  title: z.string().min(1).describe("What needs to be done."),
  priority: z
    .enum(["low", "medium", "high"])
    .default("medium")
    .describe("Task priority."),
  due: z
    .string()
    .optional()
    .describe("Optional due date in YYYY-MM-DD format."),
  notes: z
    .string()
    .optional()
    .describe("Optional notes or context for the task."),
});

export type TaskAddInput = z.infer<typeof taskAddSchema>;

export async function taskAdd(input: TaskAddInput) {
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

  const task = await addTask(ctx, project.slug, {
    title: input.title,
    priority: input.priority,
    due: input.due,
    notes: input.notes,
  });
  await touchProject(ctx, project.slug);
  return { ok: true, project: project.slug, task };
}
