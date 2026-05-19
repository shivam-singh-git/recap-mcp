/**
 * briefing: the session-start orientation tool.
 *
 * Returns everything Claude needs to pick up where the user left off:
 * workspace stats, active projects (with last-touched date and next steps),
 * recent activity, and stale projects. If the workspace is empty, sets
 * welcome_flow_active so Claude knows to walk the user through setup.
 */

import { z } from "zod";
import { differenceInDays, parseISO } from "date-fns";
import { ensureWorkspace } from "../storage/workspace.js";
import { listProjects } from "../storage/projects.js";
import {
  getRecentSessionsAcrossAllProjects,
  getLatestSession,
} from "../storage/sessions.js";
import { getAllTasks } from "../storage/tasks.js";
import type { BriefingPayload } from "../types.js";

export const briefingSchema = z.object({});

export async function briefing(): Promise<BriefingPayload> {
  const ctx = await ensureWorkspace();
  const allProjects = await listProjects(ctx, "all");
  const active = allProjects.filter((p) => p.status === "active");
  const archived = allProjects.filter((p) => p.status === "archived");

  let totalOpenTasks = 0;
  for (const p of active) totalOpenTasks += p.openTaskCount;

  const isEmpty = allProjects.length === 0;

  // Active project rollups
  const activeRollup: BriefingPayload["active_projects"] = [];
  for (const p of active.slice(0, ctx.config.briefing.max_active_projects)) {
    const latest = await getLatestSession(ctx, p.slug);
    activeRollup.push({
      slug: p.slug,
      name: p.name,
      description: p.description,
      open_tasks: p.openTaskCount,
      last_touched: p.updated,
      next_steps: latest?.next_steps,
    });
  }

  // Recent activity across all active projects
  const recentSessions = await getRecentSessionsAcrossAllProjects(
    ctx,
    ctx.config.briefing.recent_days,
    active.map((p) => p.slug),
  );

  const recent: BriefingPayload["recent_activity"] = recentSessions
    .slice(0, 8)
    .map((s) => ({
      type: "session" as const,
      project: s.slug,
      date: s.date,
      summary:
        (s.worked_on || s.next_steps || "").slice(0, 140).trim() || "Session logged",
    }));

  // Stale projects: active but not touched in 30+ days
  const today = new Date();
  const stale: BriefingPayload["stale_projects"] = [];
  for (const p of active) {
    try {
      const days = differenceInDays(today, parseISO(p.updated));
      if (days >= 30) {
        stale.push({ slug: p.slug, name: p.name, days_stale: days });
      }
    } catch {
      // skip projects with unparseable dates
    }
  }
  stale.sort((a, b) => b.days_stale - a.days_stale);

  return {
    workspace_status: {
      total_projects: allProjects.length,
      active_projects: active.length,
      archived_projects: archived.length,
      total_open_tasks: totalOpenTasks,
      is_empty: isEmpty,
    },
    active_projects: activeRollup,
    recent_activity: recent,
    stale_projects: stale.slice(0, 5),
    welcome_flow_active: isEmpty,
  };
}
