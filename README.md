# Recap

**Your AI project manager. Plain markdown. Local-first. Open source.**

Recap is an MCP server that gives Claude persistent memory of your ongoing projects. Job searches, side projects, learning goals, writing efforts, anything you work on over weeks or months. Your data lives as plain markdown files in a folder you own.

## Why Recap

Claude forgets between conversations. You spend the first five minutes of every chat re-explaining what you're working on, what you decided last time, and what's pending. Recap fixes that.

- **Local-first**: your workspace is a folder of markdown files. Nothing leaves your machine.
- **Plain markdown**: open it in VS Code, Obsidian, vim, anything.
- **Open source**: MIT licensed, no vendor lock-in.
- **Project-shaped, not blob-shaped**: structured around projects, tasks, sessions, and notes, not opaque memory dumps.
- **Eleven focused tools**: no kitchen sink, no bloat.

## Install

Requires Node.js 18+.

```bash
npx recap-mcp init
```

That single command:

1. Creates a workspace folder at `~/recap-workspace/`
2. Adds Recap to your Claude Desktop config
3. Backs up any existing Claude config to `.bak`

Then quit Claude Desktop, reopen it, and say "hi". Recap will guide you through your first project.

## The eleven tools

| Tool | Purpose |
| --- | --- |
| `briefing` | Run at session start. Loads workspace status, active projects, recent activity. |
| `project_list` | List projects, filter by status. |
| `project_create` | Start a new project, optionally seeded from a template. |
| `project_brief` | Load full context for one project (description, open tasks, recent sessions). |
| `task_add` | Add a task with optional priority, due date, notes. |
| `task_list` | List tasks for a project, filterable by status. |
| `task_update` | Change status, priority, due date, notes, or title. |
| `task_delete` | Remove a task. |
| `session_log` | Save a structured session entry: worked on, decisions, next steps. |
| `quick_note` | Drop a timestamped note into a project. |
| `search` | Fuzzy ranked search across the entire workspace. |

## Templates

Recap ships with six starter templates:

- `generic` (clean slate)
- `job-search`
- `side-project`
- `learning`
- `writing`
- `moving`

Pass `--template` to `project_create` (or have Claude do it) to seed a project with starter tasks and a knowledge file.

## Workspace structure

```
~/recap-workspace/
├── .recap/
│   └── config.json
├── projects/
│   └── job-search-2026/
│       ├── project.md
│       ├── tasks.md
│       ├── notes.md
│       ├── sessions/
│       │   └── 2026-05-20.md
│       └── knowledge/
│           └── starter.md
└── archived/
```

Plain markdown with YAML frontmatter. You can `cd` into it and `git init` if you want version control. Open it in Obsidian if you want a nice viewer.

## Configuration

The workspace path defaults to `~/recap-workspace/`. Override it with:

```bash
export RECAP_WORKSPACE_PATH=/path/to/your/workspace
```

Or pass `--workspace` to `recap-mcp init`.

Other settings live in `.recap/config.json`:

```json
{
  "version": "0.1.0",
  "briefing": { "recent_days": 14, "max_active_projects": 5 },
  "search": { "max_results": 10 }
}
```

## Troubleshooting

Run `npx recap-mcp doctor` for diagnostics.

If Claude Desktop doesn't see Recap after install:

1. Make sure you fully quit Claude Desktop (not just closed the window).
2. Check `~/recap-workspace/` exists.
3. Check your Claude Desktop config has `mcpServers.recap` entry.

## Privacy

Recap runs entirely on your machine. There is no telemetry, no analytics, no remote calls. Your projects, tasks, notes, and session logs never leave your computer.

## License

MIT. See LICENSE.

## Status

v0.1.0. Early. Feedback and issues welcome at https://github.com/shivam-singh-git/recap-mcp/issues.
