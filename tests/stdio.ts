/**
 * End-to-end MCP transport test.
 *
 * Spawns the built server as Claude Desktop would, sends two JSON-RPC
 * messages over stdio (tools/list and tools/call), checks the responses.
 */

import { spawn } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_WS = join(tmpdir(), `recap-stdio-${Date.now()}`);
const SERVER_PATH = join(import.meta.dirname, "..", "dist", "src", "server.js");

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

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: { tools?: Array<{ name: string }>; content?: Array<{ text: string }> };
  error?: { message: string };
}

async function runTest(): Promise<void> {
  console.log(`MCP stdio transport test`);
  console.log(`Server: ${SERVER_PATH}`);
  console.log(`Workspace: ${TEST_WS}\n`);

  const proc = spawn("node", [SERVER_PATH], {
    env: { ...process.env, RECAP_WORKSPACE_PATH: TEST_WS },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let buffer = "";
  const responses = new Map<number, JsonRpcResponse>();

  proc.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf-8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line) as JsonRpcResponse;
        responses.set(msg.id, msg);
      } catch {
        // ignore non-JSON
      }
    }
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf-8").trim();
    if (text) console.log(`  [server-stderr] ${text}`);
  });

  function send(id: number, method: string, params: unknown): void {
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    proc.stdin.write(`${msg}\n`);
  }

  async function waitFor(id: number, timeoutMs = 5000): Promise<JsonRpcResponse> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const got = responses.get(id);
      if (got) return got;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`Timeout waiting for response id=${id}`);
  }

  // Initialize handshake
  send(1, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke-test", version: "0.1.0" },
  });
  const initResp = await waitFor(1);
  check("initialize returns result", Boolean(initResp.result));

  // Send initialized notification (no id, no response expected)
  proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);

  // List tools
  send(2, "tools/list", {});
  const listResp = await waitFor(2);
  const tools = listResp.result?.tools ?? [];
  check("tools/list returns 11 tools", tools.length === 11, `got ${tools.length}`);
  const expectedNames = [
    "briefing",
    "project_list",
    "project_create",
    "project_brief",
    "task_add",
    "task_list",
    "task_update",
    "task_delete",
    "session_log",
    "quick_note",
    "search",
  ];
  for (const name of expectedNames) {
    check(`tool '${name}' registered`, tools.some((t) => t.name === name));
  }

  // Call briefing on empty workspace
  send(3, "tools/call", { name: "briefing", arguments: {} });
  const briefResp = await waitFor(3);
  const text = briefResp.result?.content?.[0]?.text ?? "";
  const parsed = JSON.parse(text);
  check("briefing returns is_empty=true", parsed.workspace_status?.is_empty === true);
  check("briefing returns welcome_flow_active=true", parsed.welcome_flow_active === true);

  // Call project_create
  send(4, "tools/call", {
    name: "project_create",
    arguments: { name: "Test Project", description: "via mcp" },
  });
  const createResp = await waitFor(4);
  const createText = createResp.result?.content?.[0]?.text ?? "";
  const createParsed = JSON.parse(createText);
  check("project_create succeeds via MCP", createParsed.ok === true);

  // Call briefing again, should not be empty
  send(5, "tools/call", { name: "briefing", arguments: {} });
  const brief2 = await waitFor(5);
  const brief2Parsed = JSON.parse(brief2.result?.content?.[0]?.text ?? "{}");
  check("briefing now has a project", brief2Parsed.workspace_status?.total_projects === 1);

  // Unknown tool
  send(6, "tools/call", { name: "does_not_exist", arguments: {} });
  const unknownResp = await waitFor(6);
  const unknownText = unknownResp.result?.content?.[0]?.text ?? "";
  const unknownParsed = JSON.parse(unknownText);
  check("unknown tool returns structured error", unknownParsed.error === "unknown_tool");

  // Shutdown
  proc.kill();

  console.log(`\n${"=".repeat(40)}`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  console.log("=".repeat(40));

  if (existsSync(TEST_WS)) rmSync(TEST_WS, { recursive: true, force: true });
  process.exit(failed > 0 ? 1 : 0);
}

runTest().catch((err) => {
  console.error("Transport test crashed:", err);
  if (existsSync(TEST_WS)) rmSync(TEST_WS, { recursive: true, force: true });
  process.exit(2);
});
