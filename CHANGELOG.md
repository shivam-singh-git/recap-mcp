# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-05-20

### Fixed
- Installer wrote an unresolvable `npx` command to the Claude Desktop config.
  Previously `npx -y recap-mcp-server`, which made npm look for a top-level
  package called `recap-mcp-server` (it does not exist; the server binary
  lives inside the `recap-mcp` package). Every fresh install therefore
  silently failed to load tools in Claude Desktop. Now writes
  `npx -y -p recap-mcp recap-mcp-server`, which resolves the package
  correctly and runs the server binary.

### Changed
- Existing `recap-mcp@0.1.0` installs continue to work; only the config
  written by the installer was wrong. If you installed v0.1.0 and have a
  broken setup, either re-run `npx recap-mcp init` against v0.1.1 or edit
  `claude_desktop_config.json` to use the new args array:
  `["-y", "-p", "recap-mcp", "recap-mcp-server"]`.

### Tests
- Installer test now asserts the exact npx invocation shape
  (`-p recap-mcp` present, `recap-mcp-server` as the final arg) instead of
  the looser "args include recap-mcp-server" check that let the v0.1.0
  bug slip through.

## [0.1.0] - 2026-05-20

### Added
- Initial public release.
- 11 MCP tools: `briefing`, `project_list`, `project_create`,
  `project_brief`, `task_add`, `task_list`, `task_update`, `task_delete`,
  `session_log`, `quick_note`, `search`.
- 6 starter project templates.
- `npx recap-mcp init` installer that creates a workspace folder and
  registers the server with Claude Desktop.
- `npx recap-mcp doctor` diagnostic command.
- Plain markdown storage, local-first, MIT licensed.
- Test suite: smoke, stdio (MCP protocol), installer.

[0.1.1]: https://github.com/shivam-singh-git/recap-mcp/releases/tag/v0.1.1
[0.1.0]: https://github.com/shivam-singh-git/recap-mcp/releases/tag/v0.1.0
