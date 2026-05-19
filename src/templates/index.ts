/**
 * Project templates: opinionated starter content for common project types.
 *
 * Each template returns the project description, starter tasks, and an
 * optional knowledge file. The template name is recorded in project
 * frontmatter so we can show stats later.
 */

import type { NewTaskInput } from "../storage/tasks.js";

export interface Template {
  id: string;
  label: string;
  description: string;
  starterTasks: NewTaskInput[];
  knowledgeFile?: { name: string; content: string };
}

export const TEMPLATES: Record<string, Template> = {
  generic: {
    id: "generic",
    label: "Generic project",
    description: "A clean slate. Use this when none of the other templates fit.",
    starterTasks: [
      { title: "Define what done looks like", priority: "high" },
      { title: "Identify the next concrete step", priority: "high" },
      { title: "Block out time this week to work on this" },
    ],
  },

  "job-search": {
    id: "job-search",
    label: "Job search",
    description:
      "Track applications, networking conversations, interview prep, and follow-ups for a job hunt.",
    starterTasks: [
      { title: "Update resume and tailor the summary", priority: "high" },
      { title: "Refresh LinkedIn headline and About section", priority: "high" },
      { title: "List 10 target companies", priority: "high" },
      { title: "Identify 5 people to reach out to this week" },
      { title: "Prepare a 60-second pitch about myself" },
      { title: "Set up a tracker for applications (status, dates, contacts)" },
    ],
    knowledgeFile: {
      name: "starter.md",
      content: `# Job search notes

Use this file to capture anything that informs the search:

- **Target roles**: titles, seniority, location, salary band
- **Target companies**: shortlist, why each one, who you know there
- **Pitch**: your 60-second elevator pitch
- **Strengths to lean on**: what you want to be known for
- **Watchouts**: common interview weaknesses to prepare for
- **Compensation goals**: base, equity, total comp expectations

Use \`quick_note\` for stray thoughts (a question to ask in interviews, a recruiter contact, a salary data point). Use \`task_add\` for action items.
`,
    },
  },

  "side-project": {
    id: "side-project",
    label: "Side project",
    description:
      "A new app, product, or experiment. Tracks milestones, technical decisions, and shipping progress.",
    starterTasks: [
      { title: "Write a one-paragraph description of what this is", priority: "high" },
      { title: "Define the smallest shippable version (v0.1)", priority: "high" },
      { title: "List the top 3 risks or unknowns" },
      { title: "Decide on the stack" },
      { title: "Set a target ship date for v0.1" },
    ],
    knowledgeFile: {
      name: "starter.md",
      content: `# Side project notes

- **Elevator pitch**: one sentence
- **Why this, why now**: motivation, market timing, personal interest
- **Target user**: who is this for, what problem does it solve
- **v0.1 scope**: the smallest thing worth shipping
- **Stack & infra decisions**: language, framework, hosting
- **Open questions**: things you need to figure out before deciding

Log architectural decisions in session notes so future-you knows why.
`,
    },
  },

  learning: {
    id: "learning",
    label: "Learning a skill",
    description:
      "Track progress, practice sessions, and questions while learning something new.",
    starterTasks: [
      { title: "Define what 'I know this' looks like for this skill", priority: "high" },
      { title: "Pick a primary resource (book, course, tutorial)", priority: "high" },
      { title: "Schedule weekly practice time" },
      { title: "Find a small project to apply what you learn" },
    ],
    knowledgeFile: {
      name: "starter.md",
      content: `# Learning notes

- **Skill**: what you're learning
- **Why**: the reason this matters now
- **Definition of competent**: how you'll know you've made it
- **Primary resource**: book, course, mentor, tutorial
- **Practice schedule**: when and how often
- **Application project**: how you'll actually use the skill

Use \`quick_note\` for "aha" moments and questions. Use \`session_log\` after each practice session.
`,
    },
  },

  writing: {
    id: "writing",
    label: "Writing project",
    description:
      "An article, book, newsletter, or any other long-form writing effort.",
    starterTasks: [
      { title: "Write a working title", priority: "high" },
      { title: "Draft a one-paragraph thesis", priority: "high" },
      { title: "Outline the major sections" },
      { title: "Set a target word count and deadline" },
      { title: "Block daily writing time" },
    ],
    knowledgeFile: {
      name: "starter.md",
      content: `# Writing notes

- **Working title**: subject to change
- **Thesis**: the single sentence the whole piece supports
- **Audience**: who this is for
- **Outline**: section-by-section structure
- **Word count target**: rough estimate
- **Deadline**: when this needs to ship
- **Research notes**: sources, quotes, anecdotes to weave in
`,
    },
  },

  moving: {
    id: "moving",
    label: "Move or apartment hunt",
    description:
      "Listings, viewings, paperwork, logistics. Anything related to a move.",
    starterTasks: [
      { title: "Define budget (rent or buy)", priority: "high" },
      { title: "List non-negotiables (size, location, commute)", priority: "high" },
      { title: "Set up alerts on listing sites" },
      { title: "Book viewings for top 3 candidates" },
      { title: "Make a moving checklist (utilities, change of address, etc.)" },
    ],
    knowledgeFile: {
      name: "starter.md",
      content: `# Move notes

- **Budget**: monthly rent or total purchase budget
- **Must-haves**: deal-breakers
- **Nice-to-haves**: would-be-great-but-optional
- **Areas**: neighborhoods to focus on, areas to avoid
- **Move-by date**: when you need to be in
- **Open questions**: things you need to figure out (lease length, parking, pets)
`,
    },
  },
};

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES[id];
}

export function listTemplates(): Template[] {
  return Object.values(TEMPLATES);
}
