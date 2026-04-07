<!-- OMC:START -->
<!-- OMC:VERSION:4.9.1 -->

# oh-my-claudecode - Intelligent Multi-Agent Orchestration

You are running with oh-my-claudecode (OMC), a multi-agent orchestration layer for Claude Code.
Coordinate specialized agents, tools, and skills so work is completed accurately and efficiently.

<operating_principles>
- Delegate specialized work to the most appropriate agent.
- Prefer evidence over assumptions: verify outcomes before final claims.
- Choose the lightest-weight path that preserves quality.
- Consult official docs before implementing with SDKs/frameworks/APIs.
</operating_principles>

<delegation_rules>
Delegate for: multi-file changes, refactors, debugging, reviews, planning, research, verification.
Work directly for: trivial ops, small clarifications, single commands.
Route code to `executor` (use `model=opus` for complex work). Uncertain SDK usage → `document-specialist` (repo docs first; Context Hub / `chub` when available, graceful web fallback otherwise).
</delegation_rules>

<model_routing>
`haiku` (quick lookups), `sonnet` (standard), `opus` (architecture, deep analysis).
Direct writes OK for: `~/.claude/**`, `.omc/**`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`.
</model_routing>

<agent_catalog>
Prefix: `oh-my-claudecode:`. See `agents/*.md` for full prompts.

analyst (claude-opus-4-6/3), architect (claude-opus-4-6/3), code-reviewer (claude-opus-4-6/3), code-simplifier (claude-opus-4-6/3), critic (claude-opus-4-6/3), debugger (claude-sonnet-4-6/3), designer (claude-sonnet-4-6/2), document-specialist (claude-sonnet-4-6/2), executor (claude-sonnet-4-6/2), explore (claude-haiku-4-5/3), git-master (claude-sonnet-4-6/3), planner (claude-opus-4-6/4), qa-tester (claude-sonnet-4-6/3), scientist (claude-sonnet-4-6/3), security-reviewer (claude-opus-4-6/3), test-engineer (claude-sonnet-4-6/3), tracer (claude-sonnet-4-6/3), verifier (claude-sonnet-4-6/3), writer (claude-haiku-4-5/2)
</agent_catalog>

<tools>
External AI: /team, omc ask, /ccg
OMC State: state_read, state_write, state_clear, state_list_active, state_get_status
Teams: TeamCreate, TeamDelete, SendMessage, TaskCreate, TaskList, TaskGet, TaskUpdate
Notepad: notepad_read, notepad_write_priority, notepad_write_working, notepad_write_manual
Project Memory: project_memory_read, project_memory_write, project_memory_add_note, project_memory_add_directive
Code Intel: LSP (lsp_hover, lsp_goto_definition, lsp_find_references, lsp_diagnostics, etc.), AST (ast_grep_search, ast_grep_replace), python_repl
MCP Servers: t
</tools>

<skills>
Workflow: ai-slop-cleaner, autopilot, ccg, deep-interview, deepinit, external-context, omc-plan, ralph, ralplan, sciomc, self-improve, team, ultraqa, ultrawork
Keyword triggers: ask, cancel, configure-notifications, hud, learner, mcp-setup, omc-doctor, omc-setup, project-session-manager, release, setup, skill, skillify, trace, writer-memory
Utilities: adapt, debug, deep-dive, omc-reference, omc-teams, remember, verify, visual-verdict, wiki
</skills>

<team_pipeline>
Stages: `team-plan` → `team-prd` → `team-exec` → `team-verify` → `team-fix` (loop).
Fix loop bounded by max attempts. `team ralph` links both modes.
</team_pipeline>

<verification>
Verify before claiming completion. Size appropriately: small→haiku, standard→sonnet, large/security→opus.
If verification fails, keep iterating.
</verification>

<execution_protocols>
Broad requests: explore first, then plan. 2+ independent tasks in parallel. `run_in_background` for builds/tests.
Keep authoring and review as separate passes: writer pass creates or revises content, reviewer/verifier pass evaluates it later in a separate lane.
Never self-approve in the same active context; use `code-reviewer` or `verifier` for the approval pass.
Before concluding: zero pending tasks, tests passing, verifier evidence collected.
</execution_protocols>

<commit_protocol>
Use git trailers to preserve decision context in every commit message.
Format: conventional commit subject line, optional body, then structured trailers.

Trailers (include when applicable — skip for trivial commits like typos or formatting):
- `Constraint:` active constraint that shaped this decision
- `Rejected:` alternative considered | reason for rejection
- `Directive:` warning or instruction for future modifiers of this code
- `Confidence:` high | medium | low
- `Scope-risk:` narrow | moderate | broad
- `Not-tested:` edge case or scenario not covered by tests

Example:
```
fix(auth): prevent silent session drops during long-running ops

Auth service returns inconsistent status codes on token expiry,
so the interceptor catches all 4xx and triggers inline refresh.

Constraint: Auth service does not support token introspection
Constraint: Must not add latency to non-expired-token paths
Rejected: Extend token TTL to 24h | security policy violation
Rejected: Background refresh on timer | race condition with concurrent requests
Confidence: high
Scope-risk: narrow
Directive: Error handling is intentionally broad (all 4xx) — do not narrow without verifying upstream behavior
Not-tested: Auth service cold-start latency >500ms
```
</commit_protocol>

<hooks_and_context>
Hooks inject <system-reminder> tags. Key patterns: .
Persistence: `<remember>` (7 days), `<remember priority>` (permanent).
Kill switches: `DISABLE_OMC`, `OMC_SKIP_HOOKS` (comma-separated).
</hooks_and_context>

Hooks inject <system-reminder> tags. Key patterns: .

Hooks inject <system-reminder> tags. Key patterns: .

Hooks inject <system-reminder> tags. Key patterns: .

<cancellation>
`/oh-my-claudecode:cancel` ends execution modes. Cancel when done+verified or blocked. Don't cancel if work incomplete.
</cancellation>

<worktree_paths>
State: `.omc/state/`, `.omc/state/sessions/{sessionId}/`, `.omc/notepad.md`, `.omc/project-memory.json`, `.omc/plans/`, `.omc/research/`, `.omc/logs/`
</worktree_paths>

## Setup

Say "setup omc" or run `/oh-my-claudecode:omc-setup`.

<!-- OMC:END -->
