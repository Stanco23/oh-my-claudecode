# Adaptive Context System — Design

## Context

CLAUDE.md is currently static — written once, it doesn't adapt to what skills, agents, hooks, or MCP tools are actually available at runtime. The goal is a self-healing system prompt that reconciles its content against live discovery on every session start and on demand.

---

## Architecture

### Components

| Component | Purpose |
|---|---|
| **`adapt` skill** | Discovery, diff, patch, checkpointing. Invoked by hook or manually. |
| **SessionStart hook update** | Wires `--adapt` / `--adapt-auto` flags to the `adapt` skill |
| **`omc adapt` CLI command** | Manual on-demand invocation |
| **Checkpoint files** | `.omc/adapt/checkpoints/YYYY-MM-DD-HHMMSS.json` — audit trail per run |

### Static vs Dynamic Sections of CLAUDE.md

**Static (never changed):**
- `<operating_principles>`
- `<delegation_rules>`
- `<model_routing>`
- `<team_pipeline>`
- `<verification>`
- `<execution_protocols>`
- `<commit_protocol>`
- `<hooks_and_context>`
- `<cancellation>`
- `<worktree_paths>`

**Dynamic (reconciled on adapt run):**
- `<skills>`
- `<agent_catalog>`
- `<tools>` (MCP server references)
- `<agent_catalog>` (agents section)

---

## Discovery Sources

### A) Skills
- Path: `skills/*/SKILL.md`
- Fields from YAML frontmatter: `name`, `description`
- Source: self-describing — no inference needed

### B) Agents
- Path: `agents/*.md`
- Fields from YAML frontmatter: `name`, `description`, `model`, `level`
- Source: self-describing

### C) MCP Servers
- Sources: `~/.claude.json` (user-level) and `.mcp.json` (project-level)
- Key: `mcpServers` entries
- Description resolution chain:
  1. `mcp__list` tool — if server exposes tool/resource listing, use it
  2. Scan MCP server source file for comment blocks or README hints
  3. If neither yields a description → mark `UNDOCUMENTED`, skip auto-inject (no guesswork)

### D) Hooks
- Sources: `hooks/hooks.json` and `src/hooks/*.ts`
- Names and types are self-describing from the hook definitions

---

## Reconciliation Algorithm

For each discovered item across A–D:

1. **Hash** the item (e.g., skill name + first-line of description)
2. **Compare** against what's currently documented in the corresponding CLAUDE.md section
3. **Three outcomes:**
   - `NEW` — item exists in discovered set but not in CLAUDE.md → flag for auto-inject
   - `CHANGED` — same name but different hash → flag for update
   - `GONE` — item in CLAUDE.md but no longer discovered → flag for removal

---

## Patch Format

### Checkpoint File Structure
```json
{
  "timestamp": "2026-04-07T10:30:00Z",
  "mode": "ask",
  "discovered": {
    "skills": [...],
    "agents": [...],
    "mcp": [...],
    "hooks": [...]
  },
  "diff": [
    { "type": "NEW", "section": "skills", "name": "adapt", "description": "...", "source": "skills/adapt/SKILL.md" },
    { "type": "GONE", "section": "agents", "name": "legacy-agent", "reason": "file removed" }
  ],
  "approved": null,
  "applied": null,
  "claude_md_version": "4.9.1"
}
```

### Checkpoint Location
`.omc/adapt/checkpoints/` — one file per adapt run, timestamped.

### Patch Application Flow
1. Run discovery → reconciliation
2. Write checkpoint with `approved: null`
3. If `ask` mode: present diff, wait for user approval
4. If `auto` mode: apply patch immediately
5. Read current `CLAUDE.md`
6. For each `NEW`/`CHANGED` entry: inject/upgrade in the right section
7. For each `GONE` entry: remove if `auto`, flag for confirmation if `ask`
8. Write updated `CLAUDE.md`
9. Update checkpoint `applied: true`

---

## CLI Integration

### Flags
- `claude --adapt` — ask mode: discover, show diff, apply only on approval
- `claude --adapt-auto` — auto mode: discover, apply all changes without prompting

### `omc adapt` Command
Wires to the same `adapt` skill for manual on-demand runs. Respects the same `--ask` / `--auto` subflags or inherits the session default.

---

## Hook Wiring

The SessionStart hook (`src/hooks/session-start.ts`) is extended to:

1. Check for `--adapt` or `--adapt-auto` flags at session start
2. If either is present, invoke the `adapt` skill with the corresponding mode
3. `ask` mode: presents the diff and waits for approval before patching
4. `auto` mode: applies the patch immediately, logs to checkpoint

---

## Design Principles

1. **Source-first descriptions** — only add items with native descriptions; skip undocumented items entirely (no guesswork)
2. **Checkpoint audit trail** — every adapt run is recorded; nothing is silently changed
3. **Ask-first default** — `--adapt` requires approval; `--adapt-auto` is opt-in autonomy
4. **Isolation** — discovery, diff, and patch are in one skill; session init hook just calls it
5. **No deletion without consent** — `GONE` items require approval even in auto mode (safety)

---

## File Changes

| File | Change |
|---|---|
| `skills/adapt/SKILL.md` | New skill — discovery + diff + patch logic |
| `hooks/session-start.ts` | Extend to call `adapt` skill on `--adapt*` flags |
| `src/commands/adapt.ts` | New `omc adapt` CLI command |
| `CLAUDE.md` | Patched dynamically; static structure preserved |
| `docs/superpowers/specs/YYYY-MM-DD-adaptive-context-design.md` | This document |
