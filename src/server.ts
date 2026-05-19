#!/usr/bin/env node
/**
 * Recap MCP server.
 *
 * Wires the 11 tools to the MCP protocol over stdio transport. This is the
 * file Claude Desktop spawns when it starts a session.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";

import { briefing, briefingSchema } from "./tools/briefing.js";
import { projectList, projectListSchema } from "./tools/project_list.js";
import { projectCreate, projectCreateSchema } from "./tools/project_create.js";
import { projectBrief, projectBriefSchema } from "./tools/project_brief.js";
import { taskAdd, taskAddSchema } from "./tools/task_add.js";
import { taskList, taskListSchema } from "./tools/task_list.js";
import { taskUpdate, taskUpdateSchema } from "./tools/task_update.js";
import { taskDelete, taskDeleteSchema } from "./tools/task_delete.js";
import { sessionLog, sessionLogSchema } from "./tools/session_log.js";
import { quickNote, quickNoteSchema } from "./tools/quick_note.js";
import { search, searchSchema } from "./tools/search.js";

import type { z, ZodTypeAny } from "zod";

interface ToolDef {
  name: string;
  description: string;
  schema: ZodTypeAny;
  handler: (input: unknown) => Promise<unknown>;
}

function defineTool<T extends ZodTypeAny>(t: {
  name: string;
  description: string;
  schema: T;
  handler: (input: z.infer<T>) => Promise<unknown>;
}): ToolDef {
  return t as ToolDef;
}

const tools: ToolDef[] = [
  defineTool({
    name: "briefing",
    description:
      "Session-start orientation. Run this at the beginning of every conversation to load workspace status, active projects, recent activity, and stale projects. Returns a 'welcome_flow_active' flag if the workspace is empty.",
    schema: briefingSchema,
    handler: briefing,
  }),
  defineTool({
    name: "project_list",
    description:
      "List projects in the workspace. Filter by status (active, archived, all). Returns slug, name, description, task counts, and last-touched dates.",
    schema: projectListSchema,
    handler: projectList,
  }),
  defineTool({
    name: "project_create",
    description:
      "Create a new project. Optionally seed it from a template: 'generic', 'job-search', 'side-project', 'learning', 'writing', or 'moving'. Each template adds starter tasks and an optional knowledge starter file.",
    schema: projectCreateSchema,
    handler: projectCreate,
  }),
  defineTool({
    name: "project_brief",
    description:
      "Load full context for a single project: description, body, open tasks, blocked tasks, knowledge files, and recent session logs. Use this when you need to dive deep into one project.",
    schema: projectBriefSchema,
    handler: projectBrief,
  }),
  defineTool({
    name: "task_add",
    description: "Add a task to a project. Supports priority, due date, and notes.",
    schema: taskAddSchema,
    handler: taskAdd,
  }),
  defineTool({
    name: "task_list",
    description:
      "List tasks for a project. Filter by status (open, done, blocked, all). Sorted by priority then due date.",
    schema: taskListSchema,
    handler: taskList,
  }),
  defineTool({
    name: "task_update",
    description:
      "Update a task. Change status, priority, due date, notes, or title. Pass null for due/notes to clear them.",
    schema: taskUpdateSchema,
    handler: taskUpdate,
  }),
  defineTool({
    name: "task_delete",
    description: "Delete a task from a project.",
    schema: taskDeleteSchema,
    handler: taskDelete,
  }),
  defineTool({
    name: "session_log",
    description:
      "Log a session entry for a project: what was worked on, decisions made, next steps. The core 'log progress' tool. Run at the end of a working session.",
    schema: sessionLogSchema,
    handler: sessionLog,
  }),
  defineTool({
    name: "quick_note",
    description: "Drop a timestamped note into a project. For stray thoughts that don't fit a session log.",
    schema: quickNoteSchema,
    handler: quickNote,
  }),
  defineTool({
    name: "search",
    description:
      "Fuzzy ranked search across projects, tasks, sessions, and notes. Ranks by recency, type relevance, and field match. Use to recall anything in the workspace.",
    schema: searchSchema,
    handler: search,
  }),
];

const toolMap = new Map<string, ToolDef>();
for (const t of tools) toolMap.set(t.name, t);

const server = new Server(
  { name: "recap-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.schema, { target: "openApi3" }) as Record<string, unknown>,
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = toolMap.get(request.params.name);
  if (!tool) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: "unknown_tool",
            message: `No tool named '${request.params.name}'. Known tools: ${[...toolMap.keys()].join(", ")}.`,
          }),
        },
      ],
      isError: true,
    };
  }

  try {
    const parsed = tool.schema.parse(request.params.arguments ?? {});
    const result = await tool.handler(parsed);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: "tool_error",
            tool: tool.name,
            message,
          }),
        },
      ],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr only; stdout is reserved for MCP protocol messages.
  console.error("[recap-mcp] server ready");
}

main().catch((err) => {
  console.error("[recap-mcp] fatal:", err);
  process.exit(1);
});
