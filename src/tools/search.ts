/**
 * search: fuzzy ranked search across all projects, tasks, sessions, and notes.
 */

import { z } from "zod";
import { ensureWorkspace } from "../storage/workspace.js";
import { searchWorkspace } from "../search/index.js";

export const searchSchema = z.object({
  query: z.string().min(1).describe("The search query."),
  type: z
    .enum(["project", "task", "session", "note"])
    .optional()
    .describe("Restrict results to a single type."),
  project: z
    .string()
    .optional()
    .describe("Restrict results to a single project slug."),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Maximum number of results to return."),
});

export type SearchInput = z.infer<typeof searchSchema>;

export async function search(input: SearchInput) {
  const ctx = await ensureWorkspace();
  const hits = await searchWorkspace(ctx, input.query, {
    type: input.type,
    project: input.project,
    maxResults: input.max_results,
  });
  return {
    query: input.query,
    count: hits.length,
    results: hits,
  };
}
