/**
 * session_log: save a structured progress entry for a project.
 *
 * Required: worked_on. Optional: decisions, next_steps, duration_minutes.
 * Defaults the date to today. Touching the project updates its "last touched"
 * timestamp so briefing picks it up.
 */

import { z } from "zod";
import { ensureWorkspace } from "../storage/workspace.js";
import { writeSession } from "../storage/sessions.js";
import { findSimilarSlug, readProject, touchProject } from "../storage/projects.js";

export const sessionLogSchema = z.object({
  project: z.string().describe("Project slug or name."),
  worked_on: z
    .string()
    .min(1)
    .describe("Short summary of what was worked on this session."),
  decisions: z
    .string()
    .optional()
    .describe("Decisions made and their rationale."),
  next_steps: z
    .string()
    .optional()
    .describe("What to pick up next time."),
  duration_minutes: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Approximate session duration in minutes."),
  date: z
    .string()
    .optional()
    .describe("Session date in YYYY-MM-DD format. Defaults to today."),
});

export type SessionLogInput = z.infer<typeof sessionLogSchema>;

export async function sessionLog(input: SessionLogInput) {
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

  const date = input.date ?? new Date().toISOString().slice(0, 10);
  await writeSession(ctx, project.slug, {
    date,
    project: project.slug,
    worked_on: input.worked_on,
    decisions: input.decisions,
    next_steps: input.next_steps,
    duration_minutes: input.duration_minutes,
  });
  await touchProject(ctx, project.slug);

  return {
    ok: true,
    project: project.slug,
    date,
    has_next_steps: Boolean(input.next_steps),
  };
}
