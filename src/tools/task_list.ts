/**
 * task_list: list tasks for a project, filterable by status.
 */

import { z } from "zod";
import { ensureWorkspace } from "../storage/workspace.js";
import { getAllTasks } from "../storage/tasks.js";
import { findSimilarSlug, readProject } from "../storage/projects.js";

export const taskListSchema = z.object({
  project: z.string().describe("Project slug or name."),
  status: z
    .enum(["open", "done", "blocked", "all"])
    .default("open")
    .describe("Filter tasks by status. Defaults to 'open'."),
});

export type TaskListInput = z.infer<typeof taskListSchema>;

export async function taskList(input: TaskListInput) {
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
  const filtered = input.status === "all" ? tasks : tasks.filter((t) => t.status === input.status);
  filtered.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const pdiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pdiff !== 0) return pdiff;
    return (a.due ?? "9999-12-31").localeCompare(b.due ?? "9999-12-31");
  });

  return {
    project: project.slug,
    project_name: project.name,
    status_filter: input.status,
    count: filtered.length,
    tasks: filtered,
  };
}
