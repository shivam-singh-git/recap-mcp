/**
 * project_create: scaffold a new project, optionally seeded from a template.
 */

import { z } from "zod";
import { ensureWorkspace } from "../storage/workspace.js";
import {
  projectExists,
  slugify,
  writeProject,
} from "../storage/projects.js";
import { addTask } from "../storage/tasks.js";
import { ensureDir, writeMarkdown } from "../storage/markdown.js";
import { projectDir } from "../storage/workspace.js";
import { getTemplate, TEMPLATES } from "../templates/index.js";
import { join } from "node:path";
import { promises as fs } from "node:fs";
import type { ProjectFrontmatter } from "../types.js";

export const projectCreateSchema = z.object({
  name: z.string().min(1).describe("Display name of the project."),
  description: z
    .string()
    .default("")
    .describe("One-paragraph description of what this project is about."),
  template: z
    .enum([
      "generic",
      "job-search",
      "side-project",
      "learning",
      "writing",
      "moving",
    ])
    .optional()
    .describe(
      "Optional template id to seed starter tasks and knowledge content.",
    ),
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export async function projectCreate(input: ProjectCreateInput) {
  const ctx = await ensureWorkspace();
  const slug = slugify(input.name);

  if (await projectExists(ctx, slug)) {
    return {
      error: "project_already_exists",
      message: `A project with slug '${slug}' already exists. Pick a different name or open the existing project.`,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const template = input.template ? getTemplate(input.template) : undefined;

  const frontmatter: ProjectFrontmatter = {
    name: input.name,
    slug,
    status: "active",
    created: today,
    updated: today,
    description: input.description || (template?.description ?? ""),
    template: input.template,
  };

  const body = `# ${input.name}\n\n${frontmatter.description}\n`;
  await writeProject(ctx, slug, frontmatter, body);

  // Seed template content
  let seededTasks = 0;
  if (template) {
    for (const t of template.starterTasks) {
      await addTask(ctx, slug, t);
      seededTasks++;
    }
    if (template.knowledgeFile) {
      const knowledgePath = join(
        projectDir(ctx, slug),
        "knowledge",
        template.knowledgeFile.name,
      );
      await ensureDir(join(projectDir(ctx, slug), "knowledge"));
      await fs.writeFile(knowledgePath, template.knowledgeFile.content, "utf-8");
    }
  }

  return {
    ok: true,
    project: { slug, name: input.name, status: "active" },
    seeded_tasks: seededTasks,
    template_applied: input.template ?? null,
    available_templates: Object.values(TEMPLATES).map((t) => ({
      id: t.id,
      label: t.label,
    })),
  };
}
