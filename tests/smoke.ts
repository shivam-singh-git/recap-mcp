/**
 * End-to-end smoke test for all 11 Recap tools.
 *
 * Sets up a temp workspace, calls each tool in a realistic sequence,
 * checks the results, prints a summary. Not a real test framework, just
 * a "does it actually work" driver.
 *
 * Run: npx tsx tests/smoke.ts
 */

import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TEST_WORKSPACE = join(tmpdir(), `recap-smoke-${Date.now()}`);
process.env.RECAP_WORKSPACE_PATH = TEST_WORKSPACE;

// Imports must come AFTER the env var is set
const { briefing } = await import("../src/tools/briefing.js");
const { projectCreate } = await import("../src/tools/project_create.js");
const { projectList } = await import("../src/tools/project_list.js");
const { projectBrief } = await import("../src/tools/project_brief.js");
const { taskAdd } = await import("../src/tools/task_add.js");
const { taskList } = await import("../src/tools/task_list.js");
const { taskUpdate } = await import("../src/tools/task_update.js");
const { taskDelete } = await import("../src/tools/task_delete.js");
const { sessionLog } = await import("../src/tools/session_log.js");
const { quickNote } = await import("../src/tools/quick_note.js");
const { search } = await import("../src/tools/search.js");

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? ` - ${detail}` : ""}`);
    failed++;
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

async function run(): Promise<void> {
  console.log(`Recap smoke test`);
  console.log(`Workspace: ${TEST_WORKSPACE}\n`);

  // 1. briefing on empty workspace
  section("1. briefing (empty workspace)");
  const empty = await briefing();
  check("workspace is_empty=true", empty.workspace_status.is_empty === true);
  check("welcome_flow_active=true", empty.welcome_flow_active === true);
  check("zero projects", empty.workspace_status.total_projects === 0);

  // 2. project_create with template
  section("2. project_create (job-search template)");
  const created = (await projectCreate({
    name: "Job Search 2026",
    description: "Looking for senior PM roles at AI companies.",
    template: "job-search",
  })) as { ok: boolean; project: { slug: string }; seeded_tasks: number };
  check("project created", created.ok === true);
  check("slug is correct", created.project.slug === "job-search-2026");
  check("starter tasks seeded", created.seeded_tasks === 6);

  // 3. project_list
  section("3. project_list");
  const list = await projectList({ status: "active" });
  check("one active project", list.count === 1);
  check("project has tasks", (list.projects[0]?.open_tasks ?? 0) >= 6);

  // 4. task_add
  section("4. task_add");
  const added = (await taskAdd({
    project: "job-search-2026",
    title: "Email referral contact at Anthropic",
    priority: "high",
    notes: "Mention shared connection",
  })) as { ok: boolean; task: { id: string; title: string } };
  check("task added", added.ok === true);
  check("returned id", typeof added.task?.id === "string" && added.task.id.startsWith("t_"));
  const newTaskId = added.task.id;

  // 5. task_list
  section("5. task_list");
  const tasks = await taskList({ project: "job-search-2026", status: "open" });
  check("task list returned", tasks.count >= 7);
  check("new task present", tasks.tasks.some((t) => t.id === newTaskId));

  // 6. task_update
  section("6. task_update");
  const updated = (await taskUpdate({
    project: "job-search-2026",
    task_id: newTaskId,
    status: "done",
  })) as { ok: boolean; task: { status: string } };
  check("task marked done", updated.ok === true && updated.task.status === "done");

  // 7. session_log
  section("7. session_log");
  const session = (await sessionLog({
    project: "job-search-2026",
    worked_on: "Reached out to two referral contacts, updated resume bullet points.",
    decisions: "Decided to focus on AI infra companies over generic SaaS.",
    next_steps: "Apply to three roles by Friday.",
    duration_minutes: 60,
  })) as { ok: boolean; date: string };
  check("session logged", session.ok === true);
  check("date set", /^\d{4}-\d{2}-\d{2}$/.test(session.date));

  // 8. quick_note
  section("8. quick_note");
  const note = (await quickNote({
    project: "job-search-2026",
    content: "Recruiter at OpenAI mentioned they hire mostly from referrals.",
  })) as { ok: boolean; note: { id: string } };
  check("note added", note.ok === true && note.note.id.startsWith("n_"));

  // 9. project_brief
  section("9. project_brief");
  const brief = (await projectBrief({
    project: "job-search-2026",
    recent_sessions: 3,
  })) as {
    project: { name: string };
    open_tasks: unknown[];
    knowledge: unknown[];
    recent_sessions: unknown[];
    notes_count: number;
  };
  check("project name", brief.project.name === "Job Search 2026");
  check("has knowledge file", brief.knowledge.length === 1);
  check("has one session", brief.recent_sessions.length === 1);
  check("has one note", brief.notes_count === 1);

  // 10. search
  section("10. search");
  const found = await search({ query: "Anthropic" });
  check("search returned results", found.count >= 1);
  check("hit is a task or note", found.results.some((r) => r.type === "task" || r.type === "note"));

  const noResults = await search({ query: "xyzzynonexistentterm" });
  check("empty query returns empty", noResults.count === 0);

  // 11. task_delete
  section("11. task_delete");
  const deleted = (await taskDelete({
    project: "job-search-2026",
    task_id: newTaskId,
  })) as { ok: boolean };
  check("task deleted", deleted.ok === true);

  const tasksAfter = await taskList({ project: "job-search-2026", status: "all" });
  const stillThere = tasksAfter.tasks.find((t) => t.id === newTaskId);
  if (stillThere) {
    console.log("    DEBUG: deleted id =", newTaskId);
    console.log("    DEBUG: task still in list =", JSON.stringify(stillThere));
    console.log("    DEBUG: all task ids =", JSON.stringify(tasksAfter.tasks.map((t) => t.id)));
  }
  check("task is gone", !stillThere);

  // 12. briefing on populated workspace
  section("12. briefing (populated workspace)");
  const populated = await briefing();
  check("workspace not empty", populated.workspace_status.is_empty === false);
  check("welcome flow off", populated.welcome_flow_active === false);
  check("one active project", populated.workspace_status.active_projects === 1);
  check("active project listed", populated.active_projects.length === 1);
  check("recent activity surfaces session", populated.recent_activity.length >= 1);
  check(
    "next_steps populated",
    populated.active_projects[0]?.next_steps?.includes("Apply") === true,
  );

  // 13. error handling
  section("13. error handling");
  const notFound = (await projectBrief({
    project: "nonexistent-project",
    recent_sessions: 3,
  })) as { error: string; suggestion?: string };
  check("returns structured error", notFound.error === "project_not_found");

  const typo = (await projectBrief({
    project: "job-serach-2026",
    recent_sessions: 3,
  })) as { error: string; suggestion?: string };
  check("typo gets suggestion", typo.suggestion === "job-search-2026");

  // Done
  console.log(`\n${"=".repeat(40)}`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  console.log("=".repeat(40));

  // Cleanup
  if (existsSync(TEST_WORKSPACE)) rmSync(TEST_WORKSPACE, { recursive: true, force: true });
  console.log("Test workspace cleaned up.\n");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Smoke test crashed:", err);
  if (existsSync(TEST_WORKSPACE)) rmSync(TEST_WORKSPACE, { recursive: true, force: true });
  process.exit(2);
});
