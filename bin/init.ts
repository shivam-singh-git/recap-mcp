#!/usr/bin/env node
/**
 * Recap installer: `npx recap-mcp init`
 *
 * Detects the OS, locates the Claude Desktop config, adds Recap to the
 * mcpServers block (with a backup of the existing config), creates the
 * workspace folder, and prints next steps.
 *
 * Also exposes a `doctor` subcommand that runs basic diagnostics: Node
 * version, config presence, workspace path, recap entry in config.
 */

import { Command } from "commander";
import prompts from "prompts";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { promises as fs, existsSync } from "node:fs";

interface ClaudeDesktopConfig {
  mcpServers?: Record<
    string,
    {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }
  >;
  [k: string]: unknown;
}

function getClaudeConfigPath(): string {
  // Override for testing or unusual installs.
  if (process.env.RECAP_CLAUDE_CONFIG_PATH) return process.env.RECAP_CLAUDE_CONFIG_PATH;
  const home = homedir();
  switch (platform()) {
    case "darwin":
      return join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
    case "win32":
      return join(process.env.APPDATA ?? join(home, "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
    default:
      return join(home, ".config", "Claude", "claude_desktop_config.json");
  }
}

function getDefaultWorkspacePath(): string {
  return join(homedir(), "recap-workspace");
}

async function readJson<T>(filepath: string): Promise<T | null> {
  if (!existsSync(filepath)) return null;
  try {
    const raw = await fs.readFile(filepath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(filepath: string, data: unknown): Promise<void> {
  const dir = join(filepath, "..");
  if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filepath, JSON.stringify(data, null, 2), "utf-8");
}

async function backupFile(filepath: string): Promise<string | null> {
  if (!existsSync(filepath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${filepath}.${stamp}.bak`;
  await fs.copyFile(filepath, backupPath);
  return backupPath;
}

async function ensureWorkspaceFolders(workspacePath: string): Promise<void> {
  const dirs = [
    workspacePath,
    join(workspacePath, ".recap"),
    join(workspacePath, "projects"),
    join(workspacePath, "archived"),
  ];
  for (const d of dirs) {
    if (!existsSync(d)) await fs.mkdir(d, { recursive: true });
  }
  const configPath = join(workspacePath, ".recap", "config.json");
  if (!existsSync(configPath)) {
    await writeJson(configPath, {
      version: "0.1.0",
      workspace_path: workspacePath,
      briefing: { recent_days: 14, max_active_projects: 5 },
      search: { max_results: 10 },
    });
  }
}

async function cmdInit(opts: { yes: boolean; workspace?: string }): Promise<void> {
  console.log("");
  console.log("  Recap installer");
  console.log("  ---------------");
  console.log("");

  const configPath = getClaudeConfigPath();
  let workspacePath = opts.workspace ?? getDefaultWorkspacePath();

  if (!opts.yes) {
    const answers = await prompts([
      {
        type: "text",
        name: "workspace",
        message: "Where should your Recap workspace live?",
        initial: workspacePath,
      },
      {
        type: "confirm",
        name: "proceed",
        message: `This will add Recap to Claude Desktop at: ${configPath}. Continue?`,
        initial: true,
      },
    ]);
    if (!answers.proceed) {
      console.log("Aborted.");
      return;
    }
    workspacePath = answers.workspace || workspacePath;
  }

  // 1. Create workspace folders
  await ensureWorkspaceFolders(workspacePath);
  console.log(`  ✓ Workspace created at: ${workspacePath}`);

  // 2. Patch Claude Desktop config
  const existing = (await readJson<ClaudeDesktopConfig>(configPath)) ?? {};
  const backupPath = await backupFile(configPath);
  if (backupPath) console.log(`  ✓ Backed up existing config: ${backupPath}`);

  existing.mcpServers ??= {};
  existing.mcpServers["recap"] = {
    command: "npx",
    args: ["-y", "-p", "recap-mcp", "recap-mcp-server"],
    env: { RECAP_WORKSPACE_PATH: workspacePath },
  };
  await writeJson(configPath, existing);
  console.log(`  ✓ Claude Desktop config updated`);

  console.log("");
  console.log("  Done. Next steps:");
  console.log("    1. Quit Claude Desktop completely (right-click tray icon or Cmd+Q).");
  console.log("    2. Reopen Claude Desktop.");
  console.log('    3. Start a chat and say "hi" to begin.');
  console.log("");
}

async function cmdDoctor(): Promise<void> {
  console.log("");
  console.log("  Recap doctor");
  console.log("  ------------");

  // Node version
  console.log(`  Node:           ${process.version}`);

  // Claude config
  const configPath = getClaudeConfigPath();
  const cfg = await readJson<ClaudeDesktopConfig>(configPath);
  console.log(`  Claude config:  ${existsSync(configPath) ? "found" : "MISSING"}  (${configPath})`);
  if (cfg) {
    const hasRecap = Boolean(cfg.mcpServers?.recap);
    console.log(`  Recap entry:    ${hasRecap ? "present" : "MISSING"}`);
  }

  // Workspace
  const ws = process.env.RECAP_WORKSPACE_PATH ?? getDefaultWorkspacePath();
  console.log(`  Workspace:      ${existsSync(ws) ? "found" : "MISSING"}  (${ws})`);
  if (existsSync(ws)) {
    const projectsDir = join(ws, "projects");
    if (existsSync(projectsDir)) {
      const entries = await fs.readdir(projectsDir);
      console.log(`  Projects:       ${entries.length}`);
    }
  }
  console.log("");
}

const program = new Command();
program
  .name("recap-mcp")
  .description("Recap: Your AI project manager. Plain markdown. Local-first. Open source.")
  .version("0.1.0");

program
  .command("init")
  .description("Install Recap: create workspace folder and wire it into Claude Desktop.")
  .option("-y, --yes", "Skip prompts and accept defaults.")
  .option("-w, --workspace <path>", "Workspace path (default: ~/recap-workspace).")
  .action(cmdInit);

program
  .command("doctor")
  .description("Run diagnostic checks on your Recap install.")
  .action(cmdDoctor);

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
