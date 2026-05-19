/**
 * Core data types for Recap.
 * Every project, task, session, and note in the workspace serializes to/from these.
 */

export type ProjectStatus = "active" | "archived";
export type TaskStatus = "open" | "done" | "blocked";
export type Priority = "low" | "medium" | "high";

export interface ProjectFrontmatter {
  name: string;
  slug: string;
  status: ProjectStatus;
  created: string; // ISO date
  updated: string; // ISO date
  description: string;
  template?: string;
}

export interface Project extends ProjectFrontmatter {
  body: string; // markdown body content
  taskCount: number;
  openTaskCount: number;
  lastSessionAt?: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  due?: string; // ISO date
  created: string;
  updated: string;
  notes?: string;
}

export interface SessionLog {
  date: string; // YYYY-MM-DD
  project: string; // project slug
  worked_on: string;
  decisions?: string;
  next_steps?: string;
  duration_minutes?: number;
}

export interface Note {
  id: string;
  project: string; // project slug
  created: string; // ISO timestamp
  content: string;
}

export interface BriefingPayload {
  workspace_status: {
    total_projects: number;
    active_projects: number;
    archived_projects: number;
    total_open_tasks: number;
    is_empty: boolean;
  };
  active_projects: Array<{
    slug: string;
    name: string;
    description: string;
    open_tasks: number;
    last_touched: string;
    next_steps?: string;
  }>;
  recent_activity: Array<{
    type: "session" | "task" | "note" | "project";
    project: string;
    date: string;
    summary: string;
  }>;
  stale_projects: Array<{
    slug: string;
    name: string;
    days_stale: number;
  }>;
  welcome_flow_active: boolean;
}

export interface SearchHit {
  type: "project" | "task" | "session" | "note";
  project: string;
  title: string;
  snippet: string;
  score: number;
  ref: string; // file path or id
}

export interface RecapError {
  error: string;
  message: string;
  suggestion?: string;
}
