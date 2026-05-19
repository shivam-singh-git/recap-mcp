/**
 * Workspace path resolution and config.
 *
 * The workspace lives at ~/recap-workspace by default, or wherever
 * RECAP_WORKSPACE_PATH points if set. Everything else is hardcoded;
 * config exists only so power users can move the folder.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export interface RecapConfig {
  version: string;
  workspace_path: string;
  briefing: {
    recent_days: number;
    max_active_projects: number;
  };
  search: {
    max_results: number;
  };
}

export const DEFAULTS: Omit<RecapConfig, "workspace_path"> = {
  version: "0.1.0",
  briefing: {
    recent_days: 14,
    max_active_projects: 5,
  },
  search: {
    max_results: 10,
  },
};

export function getWorkspacePath(): string {
  const envPath = process.env.RECAP_WORKSPACE_PATH;
  if (envPath && envPath.trim().length > 0) return envPath;
  return join(homedir(), "recap-workspace");
}

function getConfigPath(workspacePath: string): string {
  return join(workspacePath, ".recap", "config.json");
}

export function loadConfig(workspacePath?: string): RecapConfig {
  const ws = workspacePath ?? getWorkspacePath();
  const configPath = getConfigPath(ws);

  if (!existsSync(configPath)) {
    return { ...DEFAULTS, workspace_path: ws };
  }

  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<RecapConfig>;
    return {
      version: parsed.version ?? DEFAULTS.version,
      workspace_path: ws,
      briefing: { ...DEFAULTS.briefing, ...(parsed.briefing ?? {}) },
      search: { ...DEFAULTS.search, ...(parsed.search ?? {}) },
    };
  } catch {
    return { ...DEFAULTS, workspace_path: ws };
  }
}

export function saveConfig(config: RecapConfig): void {
  const configDir = join(config.workspace_path, ".recap");
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
  writeFileSync(getConfigPath(config.workspace_path), JSON.stringify(config, null, 2), "utf-8");
}
