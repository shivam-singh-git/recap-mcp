/**
 * task_delete: remove a task from a project.
 */

import { z } from "zod";
import { ensureWorkspace } from "../storage/workspace.js";
import { deleteTask, findTaskById } from "../storage/tasks.js";
import { findSimilarSlug, readProject, touchProject } from "../storage/projects.js";

export const taskDeleteSchema = z.object({
  project: z.string().describe("Project slug or name."),
  task_id: z.string().describe("The task id to delete."),
});

export type TaskDeleteInput = z.infer<typeof taskDeleteSchema>;

export async function taskDelete(input: TaskDeleteInput) {
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

  await deleteTask(ctx, project.slug, input.task_id);
  await touchProject(ctx, project.slug);
  return {
    ok: true,
    project: project.slug,
    deleted: { id: input.task_id, title: existing.title },
  };
}
