/**
 * Workspace folder management. Creates and validates the recap-workspace
 * directory structure on first run.
 *
 * Layout:
 *   <workspace>/
 *     .recap/config.json
 *     projects/<slug>/project.md
 *     projects/<slug>/tasks.md
 *     projects/<slug>/notes.md
 *     projects/<slug>/sessions/YYYY-MM-DD.md
 *     projects/<slug>/knowledge/...
 *     archived/<slug>/...
 */

import { join } from "node:path";
import { existsSync } from "node:fs";
import { ensureDir } from "./markdown.js";
import { loadConfig, saveConfig, type RecapConfig } from "../config.js";

export interface WorkspaceContext {
  config: RecapConfig;
  paths: {
    root: string;
    meta: string;
    projects: string;
    archived: string;
  };
}

export async function ensureWorkspace(workspacePath?: string): Promise<WorkspaceContext> {
  const config = loadConfig(workspacePath);
  const root = config.workspace_path;

  const paths = {
    root,
    meta: join(root, ".recap"),
    projects: join(root, "projects"),
    archived: join(root, "archived"),
  };

  await ensureDir(paths.meta);
  await ensureDir(paths.projects);
  await ensureDir(paths.archived);

  const configFile = join(paths.meta, "config.json");
  if (!existsSync(configFile)) saveConfig(config);

  return { config, paths };
}

export function projectDir(ctx: WorkspaceContext, slug: string): string {
  return join(ctx.paths.projects, slug);
}

export function archivedProjectDir(ctx: WorkspaceContext, slug: string): string {
  return join(ctx.paths.archived, slug);
}
