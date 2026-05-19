/**
 * quick_note: drop a timestamped note into a project without ceremony.
 */

import { z } from "zod";
import { ensureWorkspace } from "../storage/workspace.js";
import { addNote } from "../storage/notes.js";
import { findSimilarSlug, readProject, touchProject } from "../storage/projects.js";

export const quickNoteSchema = z.object({
  project: z.string().describe("Project slug or name."),
  content: z.string().min(1).describe("The note text."),
});

export type QuickNoteInput = z.infer<typeof quickNoteSchema>;

export async function quickNote(input: QuickNoteInput) {
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

  const note = await addNote(ctx, project.slug, input.content);
  await touchProject(ctx, project.slug);
  return { ok: true, project: project.slug, note };
}
