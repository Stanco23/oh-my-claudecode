---
name: adapt
description: Discover available skills, agents, MCP servers, and hooks — diff against CLAUDE.md dynamic sections, checkpoint, and optionally patch
argument-hint: "--ask|--auto"
level: 2
---

# Adapt Skill

Reconcile the dynamic sections of CLAUDE.md against the live filesystem. Keeps `<skills>`, `<agent_catalog>`, `<tools>`, and hooks sections in sync with discovered capabilities.

## Usage


```bash
/oh-my-claudecode:adapt          # ask mode — show diff, wait for approval, then patch
/oh-my-claudecode:adapt --ask    # same as above
/oh-my-claudecode:adapt --auto   # apply patch immediately, log to checkpoint
/oh-my-claudecode:adapt --diff   # show pending diff without patching or checkpointing
```

## Modes

### ask (default)
1. Discover all capabilities
2. Reconcile against current CLAUDE.md
3. Present diff grouped by section and type (NEW / CHANGED / GONE)
4. Wait for explicit approval before patching
5. Patch CLAUDE.md and write checkpoint with `approved: true`, `applied: null`
6. If user rejects: write checkpoint with `approved: false`, `applied: false`

### auto
1. Discover all capabilities
2. Reconcile against current CLAUDE.md
3. Patch CLAUDE.md immediately without prompting
4. Write checkpoint with `approved: null`, `applied: true`

### diff
1. Discover all capabilities
2. Reconcile against current CLAUDE.md
3. Print diff grouped by section and type
4. No checkpoint written, no patch applied

## Discovery Sources

### Skills
Scan every `skills/*/SKILL.md` file in the plugin root.

For each file, extract from YAML frontmatter:
- `name`
- `description`
- `triggers` (optional, for trigger-based skills)
- `argument-hint` (optional)

Hash = `name + "|" + first line of description` (trimmed).

### Agents
Scan every `agents/*.md` file in the plugin root.

For each file, extract from YAML frontmatter:
- `name`
- `description`
- `model` (optional)
- `level` (optional)

Hash = `name + "|" + first line of description` (trimmed).

### MCP Servers
Read two files and merge their `mcpServers` entries:
- `~/.claude.json` (user-level)
- `.mcp.json` (project-level, current working directory)

For each server entry:
1. Server name becomes `name`
2. Try to resolve description via:
   a. Call `mcp__list` tool to get tool/resource listing — use server's reported description if present
   b. Scan the server's source file for comment blocks (look for block comments near the top of the file)
   c. If neither yields a description → mark `description: UNDOCUMENTED`, skip auto-inject for this entry
3. Hash = `name + "|" + description`

### Hooks
Read `hooks/hooks.json` in the plugin root.

Parse all hook event types (`UserPromptSubmit`, `SessionStart`, `PreToolUse`, etc.) and their matchers/hooks arrays.

For each hook entry, build a synthetic description:
- Format: `"<event> [<matcher>] -> <command>"` (command truncated to 80 chars)
- Example: `"SessionStart [init] -> node .../setup-init.mjs"`

Hash = `name + "|" + description` where `name` = the hook event type (e.g., `SessionStart`).

Also scan `src/hooks/*.ts` for additional hook definitions not in `hooks.json`. For each file, extract hook type from filename and synthetic description from imports/config.

## Reconciliation Algorithm

For each section, compare discovered items against current CLAUDE.md content:

1. **Parse current CLAUDE.md** — extract each dynamic section's raw content
2. **For each discovered item:**
   - Compute its hash
   - Search for a matching entry in the current section (by name)
   - If no match found → `NEW`
   - If match found but hash differs → `CHANGED`
   - If match found and hash matches → `UNCHANGED` (skip, not reported)
3. **For each item in current CLAUDE.md not in discovered:**
   → `GONE` (requires confirmation in both ask and auto modes)

Three outcomes per item:
- `NEW` — inject into CLAUDE.md (ask: user approves first; auto: immediate)
- `CHANGED` — update in CLAUDE.md (ask: user approves first; auto: immediate)
- `GONE` — flag for confirmation before removal (ask: prompt; auto: prompt, do not auto-remove)

## Checkpoint Format

Write to `.omc/adapt/checkpoints/YYYY-MM-DD-HHMMSS.json`:

```json
{
  "timestamp": "<ISO8601>",
  "mode": "<ask|auto>",
  "discovered": {
    "skills": [{ "name": "...", "description": "...", "source": "skills/<name>/SKILL.md", "hash": "..." }],
    "agents": [{ "name": "...", "description": "...", "source": "agents/<name>.md", "model": "...", "level": "..." }],
    "mcp": [{ "name": "...", "description": "...", "source": "~/.claude.json|.mcp.json", "hash": "..." }],
    "hooks": [{ "name": "...", "description": "...", "source": "hooks/hooks.json|src/hooks/<name>.ts", "hash": "..." }]
  },
  "diff": [
    { "type": "NEW|CHANGED|GONE", "section": "<section>", "name": "...", "description": "...", "source": "..." }
  ],
  "approved": null,
  "applied": null,
  "claude_md_version": "<OMC:VERSION from CLAUDE.md>"
}
```

After approval in ask mode: set `approved: true/false`, then `applied: true` once patch is written.

In auto mode: set `approved: null`, `applied: true`.

## CLAUDE.md Sections to Patch

**Dynamic sections** — parsed and rewritten by this skill:
- `<skills>` — list of available skills
- `<agent_catalog>` — list of available agents
- `<tools>` — MCP server references
- Hooks (inline in `<hooks_and_context>`)

**Static sections** — left untouched:
`<operating_principles>`, `<delegation_rules>`, `<model_routing>`, `<team_pipeline>`, `<verification>`, `<execution_protocols>`, `<commit_protocol>`, `<hooks_and_context>` (static parts), `<cancellation>`, `<worktree_paths>`, Setup

### Patch Format per Section

#### `<skills>`
Replace the entire `<skills>` block with updated skill list:

```
<skills>
Invoke via `/oh-my-claudecode:<name>`. Trigger patterns auto-detect keywords.

Workflow: `<comma-separated workflow names, alphabetical>`
Keyword triggers: <entries sorted by skill name>
Utilities: <entries sorted by skill name>
</skills>
```

Sort workflow vs utilities by scanning for keyword trigger patterns in skill frontmatter. Default: skills with `triggers` containing "autopilot|ralph|ultrawork|team|ccg|ultraqa|omc-plan|ralplan|sciomc|external-context|deepinit|deep-interview|ai-slop-cleaner|self-improve" → Workflow; rest → Utilities.

#### `<agent_catalog>`
Replace the entire `<agent_catalog>` block with:

```
<agent_catalog>
Prefix: `oh-my-claudecode:`. See `agents/*.md` for full prompts.

<comma-separated list: name (model/level) sorted alphabetically by name>
</agent_catalog>
```

#### `<tools>`
Replace the entire `<tools>` block with:

```
<tools>
External AI: <comma-separated list of external AI commands, alphabetically sorted>
OMC State: <comma-separated list of state tools, alphabetically sorted>
Teams: <comma-separated list of team tools, alphabetically sorted>
Notepad: <comma-separated list of notepad tools, alphabetically sorted>
Project Memory: <comma-separated list of project memory tools, alphabetically sorted>
Code Intel: <comma-separated list of code intel tools, alphabetically sorted>
MCP Servers: <comma-separated list of discovered MCP servers, alphabetically sorted>
</tools>
```

Group tools by category. External AI category includes `/team`, `omc ask`, `/ccg`. OMC State category includes `state_*`. Teams category includes `Team*`. Notepad category includes `notepad_*`. Project Memory includes `project_memory_*`. Code Intel includes LSP, AST, and python_repl tools. MCP Servers includes discovered servers from both `~/.claude.json` and `.mcp.json`.

#### Hooks section
Inline in `<hooks_and_context>`, replace the hook description paragraph with:

```
Hooks inject `<system-reminder>` tags. Key patterns: <comma-separated hook event types with their matchers, alphabetically sorted>.
```

Only update if `hooks/hooks.json` or `src/hooks/*.ts` changed.

## Diff Output Format

Group diff entries by section, then by type. Format each group as:

```
### <section>

#### NEW (N)
| Name | Description | Source |
|------|-------------|--------|
| ... | ... | ... |

#### CHANGED (N)
| Name | Old Description | New Description | Source |
|------|----------------|----------------|--------|
| ... | ... | ... | ... |

#### GONE (N)
| Name | Last Known Description | Source |
|------|------------------------|--------|
| ... | ... | ... |
```

GONE items show a warning: "GONE items require confirmation before removal."

## Error Handling

- If a discovery source file is missing or unreadable: skip that source, report it in diff as a warning
- If CLAUDE.md cannot be parsed: abort with error
- If patch write fails: write checkpoint with `applied: false`, report error
- If MCP server description resolution fails: mark as UNDOCUMENTED, do not include in auto-inject list

## Examples

```
> /oh-my-claudecode:adapt --ask

Discovering capabilities...
  Found 38 skills, 20 agents, 4 MCP servers, 12 hook types
  Reconciling against CLAUDE.md...

=== DIFF ===

### skills

#### NEW (2)
| Name | Description | Source |
|------|-------------|--------|
| adapt | Discover, diff, patch, and checkpoint | skills/adapt/SKILL.md |
| deep-search | Codebase search with embeddings | skills/deep-search/SKILL.md |

#### CHANGED (1)
| Name | Old Description | New Description | Source |
|------|----------------|----------------|--------|
| ralph | Persistence loop | Self-referential loop engine | skills/ralph/SKILL.md |

#### GONE (1)
| Name | Last Known Description | Source |
|------|------------------------|--------|
| old-skill | No longer needed | skills/old-skill/SKILL.md |

### agents

#### NEW (1)
| Name | Description | Source |
|------|-------------|--------|
| scientist | Research and experimentation | agents/scientist.md |

[...more sections...]

Apply these changes to CLAUDE.md? (yes/no/all)

> yes

Patching CLAUDE.md...
  ✓ Updated <skills> section (3 changes)
  ✓ Updated <agent_catalog> section (1 change)
  ✓ Updated <tools> section (2 changes)
  ✓ Wrote checkpoint: .omc/adapt/checkpoints/2026-04-07-143052.json
```

## Implementation Notes

1. **Source-first**: descriptions come directly from YAML frontmatter or MCP server responses — no guesswork
2. **Hash stability**: use `name + "|" + first line of description` so only substantive description changes trigger CHANGED
3. **Idempotent**: running adapt twice with no changes should produce an empty diff
4. **Checkpoint always written**: every invocation writes a checkpoint, even if no changes are found
5. **GONE items never auto-removed**: even in auto mode, GONE items prompt for confirmation before removal
6. **Static sections preserved**: never modify anything outside the dynamic sections listed above
