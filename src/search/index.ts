/**
 * Search across the workspace.
 *
 * Builds an in-memory MiniSearch index over every project, task, session,
 * and note. Cheap to rebuild on every search call at workspace sizes that
 * fit in memory. Re-evaluate if/when someone has thousands of projects.
 *
 * Ranking factors:
 *   - field weights: title/name > body (3x)
 *   - recency: items touched in last 7 days boosted 2x, 8-30 days 1x, older 0.5x
 *   - type priority: open tasks > recent sessions > project descriptions > notes
 *   - active project bonus: items in active projects rank higher
 */

import MiniSearch from "minisearch";
import { differenceInDays, parseISO } from "date-fns";
import { ensureWorkspace, type WorkspaceContext } from "../storage/workspace.js";
import { listProjects, listProjectSlugs } from "../storage/projects.js";
import { getAllTasks } from "../storage/tasks.js";
import { listSessions } from "../storage/sessions.js";
import { getAllNotes } from "../storage/notes.js";
import type { SearchHit } from "../types.js";

interface IndexedDoc {
  id: string;
  type: "project" | "task" | "session" | "note";
  project: string;
  projectName: string;
  isActive: boolean;
  title: string;
  body: string;
  date: string; // ISO date for recency calc
  ref: string;
  taskStatus?: string;
}

function recencyMultiplier(dateStr: string): number {
  try {
    const days = differenceInDays(new Date(), parseISO(dateStr.slice(0, 10)));
    if (days <= 7) return 2.0;
    if (days <= 30) return 1.0;
    return 0.5;
  } catch {
    return 0.5;
  }
}

function typeMultiplier(doc: IndexedDoc): number {
  if (doc.type === "task" && doc.taskStatus === "open") return 1.4;
  if (doc.type === "session") return 1.2;
  if (doc.type === "project") return 1.0;
  if (doc.type === "note") return 0.9;
  return 0.8;
}

async function buildIndex(
  ctx: WorkspaceContext,
): Promise<{ search: MiniSearch<IndexedDoc>; byId: Map<string, IndexedDoc> }> {
  const docs: IndexedDoc[] = [];
  const projects = await listProjects(ctx, "all");
  const projectMap = new Map(projects.map((p) => [p.slug, p]));

  for (const p of projects) {
    docs.push({
      id: `project:${p.slug}`,
      type: "project",
      project: p.slug,
      projectName: p.name,
      isActive: p.status === "active",
      title: p.name,
      body: `${p.description}\n${p.body}`,
      date: p.updated,
      ref: `projects/${p.slug}/project.md`,
    });

    const tasks = await getAllTasks(ctx, p.slug);
    for (const t of tasks) {
      docs.push({
        id: `task:${p.slug}:${t.id}`,
        type: "task",
        project: p.slug,
        projectName: p.name,
        isActive: p.status === "active",
        title: t.title,
        body: t.notes ?? "",
        date: t.updated,
        ref: t.id,
        taskStatus: t.status,
      });
    }

    const sessions = await listSessions(ctx, p.slug);
    for (const s of sessions) {
      docs.push({
        id: `session:${p.slug}:${s.date}`,
        type: "session",
        project: p.slug,
        projectName: p.name,
        isActive: p.status === "active",
        title: `Session ${s.date}`,
        body: [s.worked_on, s.decisions, s.next_steps].filter(Boolean).join("\n\n"),
        date: s.date,
        ref: `projects/${p.slug}/sessions/${s.date}.md`,
      });
    }

    const notes = await getAllNotes(ctx, p.slug);
    for (const n of notes) {
      docs.push({
        id: `note:${p.slug}:${n.id}`,
        type: "note",
        project: p.slug,
        projectName: p.name,
        isActive: p.status === "active",
        title: n.content.slice(0, 60),
        body: n.content,
        date: n.created,
        ref: n.id,
      });
    }
  }

  const search = new MiniSearch<IndexedDoc>({
    fields: ["title", "body", "projectName"],
    storeFields: [
      "type",
      "project",
      "projectName",
      "isActive",
      "title",
      "body",
      "date",
      "ref",
      "taskStatus",
    ],
    searchOptions: {
      boost: { title: 3, projectName: 1.5, body: 1 },
      fuzzy: 0.2,
      prefix: true,
    },
  });
  search.addAll(docs);

  const byId = new Map(docs.map((d) => [d.id, d]));
  return { search, byId };
}

function makeSnippet(body: string, query: string, max = 160): string {
  if (!body) return "";
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const q = query.toLowerCase().split(/\s+/)[0];
  const idx = q ? flat.toLowerCase().indexOf(q) : -1;
  if (idx < 0) return `${flat.slice(0, max).trim()}...`;
  const start = Math.max(0, idx - 40);
  const end = Math.min(flat.length, idx + 120);
  return `${start > 0 ? "..." : ""}${flat.slice(start, end).trim()}${end < flat.length ? "..." : ""}`;
}

export interface SearchOptions {
  type?: "project" | "task" | "session" | "note";
  project?: string;
  maxResults?: number;
}

export async function searchWorkspace(
  ctx: WorkspaceContext,
  query: string,
  options: SearchOptions = {},
): Promise<SearchHit[]> {
  const { search, byId } = await buildIndex(ctx);
  const max = options.maxResults ?? ctx.config.search.max_results;

  const rawResults = search.search(query, { fuzzy: 0.2, prefix: true });
  const hits: SearchHit[] = [];

  for (const r of rawResults) {
    const doc = byId.get(r.id as string);
    if (!doc) continue;
    if (options.type && doc.type !== options.type) continue;
    if (options.project && doc.project !== options.project) continue;

    const adjustedScore =
      r.score * recencyMultiplier(doc.date) * typeMultiplier(doc) * (doc.isActive ? 1 : 0.6);

    hits.push({
      type: doc.type,
      project: doc.projectName,
      title: doc.title,
      snippet: makeSnippet(doc.body, query),
      score: Number(adjustedScore.toFixed(3)),
      ref: doc.ref,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, max);
}
