/**
 * Installer integration test.
 *
 * Points the installer at a fake config path and workspace, runs init --yes,
 * verifies the config got patched and workspace folders were created.
 * Does NOT touch your real Claude Desktop config.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_DIR = join(tmpdir(), `recap-installer-${Date.now()}`);
const FAKE_CONFIG = join(TEST_DIR, "fake-claude", "claude_desktop_config.json");
const WORKSPACE = join(TEST_DIR, "workspace");
const INIT_JS = join(import.meta.dirname, "..", "dist", "bin", "init.js");

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? ` - ${detail}` : ""}`);
    failed++;
  }
}

console.log(`Installer test`);
console.log(`Fake Claude config: ${FAKE_CONFIG}`);
console.log(`Test workspace: ${WORKSPACE}\n`);

// 1. Test with no pre-existing config (cold install)
mkdirSync(join(TEST_DIR, "fake-claude"), { recursive: true });

const res1 = spawnSync(
  "node",
  [INIT_JS, "init", "--yes", "--workspace", WORKSPACE],
  {
    env: { ...process.env, RECAP_CLAUDE_CONFIG_PATH: FAKE_CONFIG },
    encoding: "utf-8",
  },
);

check("init exits 0 (cold)", res1.status === 0, `status=${res1.status}, stderr=${res1.stderr}`);
check("workspace folder created", existsSync(WORKSPACE));
check(".recap folder created", existsSync(join(WORKSPACE, ".recap")));
check("projects folder created", existsSync(join(WORKSPACE, "projects")));
check("config.json created", existsSync(join(WORKSPACE, ".recap", "config.json")));
check("Claude config created", existsSync(FAKE_CONFIG));

const cfg1 = JSON.parse(readFileSync(FAKE_CONFIG, "utf-8")) as {
  mcpServers?: Record<string, { command: string; args?: string[]; env?: Record<string, string> }>;
};
check("mcpServers.recap entry present", Boolean(cfg1.mcpServers?.recap));
check("uses npx command", cfg1.mcpServers?.recap?.command === "npx");
check(
  "args include recap-mcp-server",
  cfg1.mcpServers?.recap?.args?.includes("recap-mcp-server") === true,
);
check(
  "env carries workspace path",
  cfg1.mcpServers?.recap?.env?.RECAP_WORKSPACE_PATH === WORKSPACE,
);

// 2. Test with pre-existing config (should preserve other servers)
writeFileSync(
  FAKE_CONFIG,
  JSON.stringify({
    mcpServers: {
      "existing-server": { command: "node", args: ["/some/path"] },
    },
    someOtherSetting: "preserved",
  }),
  "utf-8",
);

const res2 = spawnSync(
  "node",
  [INIT_JS, "init", "--yes", "--workspace", WORKSPACE],
  {
    env: { ...process.env, RECAP_CLAUDE_CONFIG_PATH: FAKE_CONFIG },
    encoding: "utf-8",
  },
);

check("init exits 0 (with existing config)", res2.status === 0);

const cfg2 = JSON.parse(readFileSync(FAKE_CONFIG, "utf-8")) as {
  mcpServers?: Record<string, unknown>;
  someOtherSetting?: string;
};
check("existing server preserved", Boolean(cfg2.mcpServers?.["existing-server"]));
check("recap entry added", Boolean(cfg2.mcpServers?.recap));
check("other top-level settings preserved", cfg2.someOtherSetting === "preserved");

// 3. Doctor reads the test config
const docRes = spawnSync("node", [INIT_JS, "doctor"], {
  env: {
    ...process.env,
    RECAP_CLAUDE_CONFIG_PATH: FAKE_CONFIG,
    RECAP_WORKSPACE_PATH: WORKSPACE,
  },
  encoding: "utf-8",
});
check("doctor exits 0", docRes.status === 0);
check("doctor finds Claude config", docRes.stdout.includes("found"));
check("doctor finds Recap entry", docRes.stdout.includes("Recap entry:    present"));

// 4. Backup file was created on second run
const tdir = join(TEST_DIR, "fake-claude");
const { readdirSync } = await import("node:fs");
const files = readdirSync(tdir);
check("backup file created", files.some((f) => f.endsWith(".bak")));

// Cleanup
if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });

console.log(`\n${"=".repeat(40)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
console.log("=".repeat(40));

process.exit(failed > 0 ? 1 : 0);
