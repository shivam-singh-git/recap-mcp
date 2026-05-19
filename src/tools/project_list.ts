/**
 * project_list: list all projects with status and metadata.
 */

import { z } from "zod";
import { ensureWorkspace } from "../storage/workspace.js";
import { listProjects } from "../storage/projects.js";

export const projectListSchema = z.object({
  status: z
    .enum(["active", "archived", "all"])
    .default("active")
    .describe("Filter by project status. Defaults to 'active'."),
});

export type ProjectListInput = z.infer<typeof projectListSchema>;

export async function projectList(input: ProjectListInput) {
  const ctx = await ensureWorkspace();
  const projects = await listProjects(ctx, input.status);
  return {
    count: projects.length,
    projects: projects.map((p) => ({
      slug: p.slug,
      name: p.name,
      status: p.status,
      description: p.description,
      open_tasks: p.openTaskCount,
      total_tasks: p.taskCount,
      created: p.created,
      updated: p.updated,
      last_session_at: p.lastSessionAt,
      template: p.template,
    })),
  };
}
