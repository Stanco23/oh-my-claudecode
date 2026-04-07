/**
 * Patch module for adapt reconciler
 *
 * Generates updated CLAUDE.md sections and writes them.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { DiscoveryResult, DiffEntry } from './types.js';

function getPackageDir(): string {
  if (typeof __dirname !== 'undefined' && __dirname) {
    const currentDirName = basename(__dirname);
    const parentDirName = basename(dirname(__dirname));
    const grandparentDirName = basename(dirname(dirname(__dirname)));

    if (currentDirName === 'bridge') {
      return join(__dirname, '..');
    }

    if (
      currentDirName === 'adapt'
      && parentDirName === 'features'
      && (grandparentDirName === 'src' || grandparentDirName === 'dist')
    ) {
      return join(__dirname, '..', '..', '..');
    }
  }

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    return join(__dirname, '..', '..', '..');
  } catch {
    return process.cwd();
  }
}

const WORKFLOW_SKILLS = new Set([
  'autopilot', 'ralph', 'ultrawork', 'team', 'ccg', 'ultraqa',
  'omc-plan', 'ralplan', 'sciomc', 'external-context', 'deepinit',
  'deep-interview', 'ai-slop-cleaner', 'self-improve',
]);

function sortSkills(skills: { name: string }[]): { workflows: string[]; utilities: string[] } {
  const workflows: string[] = [];
  const utilities: string[] = [];

  for (const skill of skills) {
    const name = skill.name.toLowerCase();
    if (WORKFLOW_SKILLS.has(name)) {
      workflows.push(skill.name);
    } else {
      utilities.push(skill.name);
    }
  }

  return {
    workflows: workflows.sort(),
    utilities: utilities.sort(),
  };
}

function formatSkillsSection(skills: { name: string; description: string }[]): string {
  const { workflows, utilities } = sortSkills(skills);

  const parts: string[] = [];

  if (workflows.length > 0) {
    parts.push(`Workflow: ${workflows.join(', ')}`);
  }

  if (utilities.length > 0) {
    // Group utilities by keyword triggers
    const keywordTriggers: string[] = [];
    const others: string[] = [];

    for (const util of utilities) {
      const name = util.toLowerCase();
      if (name.includes('ask') || name.includes('cancel') || name.includes('note') ||
          name.includes('learner') || name.includes('setup') || name.includes('hud') ||
          name.includes('doctor') || name.includes('help') || name.includes('trace') ||
          name.includes('release') || name.includes('project-session-manager') ||
          name.includes('skill') || name.includes('writer-memory') ||
          name.includes('ralph-init') || name.includes('configure-notifications')) {
        keywordTriggers.push(util);
      } else {
        others.push(util);
      }
    }

    parts.push(`Keyword triggers: ${keywordTriggers.join(', ')}`);
    parts.push(`Utilities: ${others.join(', ')}`);
  }

  return parts.join('\n');
}

function formatAgentsSection(agents: { name: string; model?: string; level?: string }[]): string {
  const sorted = [...agents].sort((a, b) => a.name.localeCompare(b.name));
  const entries = sorted.map(a => {
    if (a.model || a.level) {
      return `${a.name} (${a.model || 'unknown'}/${a.level || '?'})`;
    }
    return a.name;
  });

  return `Prefix: \`oh-my-claudecode:\`. See \`agents/*.md\` for full prompts.\n\n${entries.join(', ')}`;
}

function formatToolsSection(mcpServers: { name: string }[]): string {
  const sorted = [...mcpServers].sort((a, b) => a.name.localeCompare(b.name));

  const externalAi = '/team, omc ask, /ccg';
  const stateTools = 'state_read, state_write, state_clear, state_list_active, state_get_status';
  const teamTools = 'TeamCreate, TeamDelete, SendMessage, TaskCreate, TaskList, TaskGet, TaskUpdate';
  const notepadTools = 'notepad_read, notepad_write_priority, notepad_write_working, notepad_write_manual';
  const projectMemoryTools = 'project_memory_read, project_memory_write, project_memory_add_note, project_memory_add_directive';
  const codeIntelTools = 'LSP (lsp_hover, lsp_goto_definition, lsp_find_references, lsp_diagnostics, etc.), AST (ast_grep_search, ast_grep_replace), python_repl';

  const parts: string[] = [
    `External AI: ${externalAi}`,
    `OMC State: ${stateTools}`,
    `Teams: ${teamTools}`,
    `Notepad: ${notepadTools}`,
    `Project Memory: ${projectMemoryTools}`,
    `Code Intel: ${codeIntelTools}`,
  ];

  if (sorted.length > 0) {
    parts.push(`MCP Servers: ${sorted.map(s => s.name).join(', ')}`);
  }

  return parts.join('\n');
}

function formatHooksSection(hooks: { name: string }[]): string {
  const sorted = [...hooks].sort((a, b) => a.name.localeCompare(b.name));
  const hookTypes = sorted.map(h => h.name).join(', ');
  return `Hooks inject \<system-reminder\> tags. Key patterns: ${hookTypes}.`;
}

/**
 * Generate updated sections for CLAUDE.md
 */
export function generateSections(
  discovered: DiscoveryResult,
  existingHooks: string[]
): { skills: string; agents: string; tools: string; hooks: string } {
  return {
    skills: formatSkillsSection(discovered.skills),
    agents: formatAgentsSection(discovered.agents),
    tools: formatToolsSection(discovered.mcp),
    hooks: formatHooksSection(discovered.hooks.length > 0 ? discovered.hooks : existingHooks.map(n => ({ name: n }))),
  };
}

/**
 * Patch CLAUDE.md with updated sections
 */
export function patchClaudeMd(
  claudeMdPath: string,
  discovered: DiscoveryResult,
  existingHooks: string[]
): boolean {
  if (!existsSync(claudeMdPath)) {
    return false;
  }

  try {
    let content = readFileSync(claudeMdPath, 'utf-8');
    const sections = generateSections(discovered, existingHooks);

    // Replace <skills> section
    content = content.replace(
      /<skills>[\s\S]*?<\/skills>/i,
      `<skills>\n${sections.skills}\n</skills>`
    );

    // Replace <agent_catalog> section
    content = content.replace(
      /<agent_catalog>[\s\S]*?<\/agent_catalog>/i,
      `<agent_catalog>\n${sections.agents}\n</agent_catalog>`
    );

    // Replace <tools> section
    content = content.replace(
      /<tools>[\s\S]*?<\/tools>/i,
      `<tools>\n${sections.tools}\n</tools>`
    );

    // Replace hooks description in <hooks_and_context>
    content = content.replace(
      /Hooks inject `<system-reminder>` tags\. Key patterns: [^\n]+/i,
      sections.hooks
    );

    writeFileSync(claudeMdPath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}
