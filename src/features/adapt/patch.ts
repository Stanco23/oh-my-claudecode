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
  // Try __dirname path resolution first
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
      const pkgDir = join(__dirname, '..', '..', '..');
      // Verify package.json exists at this path before returning
      if (existsSync(join(pkgDir, 'package.json'))) {
        return pkgDir;
      }
    }
  }

  // Fallback: try import.meta.url resolution
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkgDir = join(__dirname, '..', '..', '..');
    if (existsSync(join(pkgDir, 'package.json'))) {
      return pkgDir;
    }
  } catch {
    // fall through
  }

  // Last resort: use cwd
  return process.cwd();
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
    const hasSkillsSection = /<skills>[\s\S]*?<\/skills>/i.test(content);
    if (hasSkillsSection) {
      content = content.replace(
        /<skills>[\s\S]*?<\/skills>/i,
        `<skills>\n${sections.skills}\n</skills>`
      );
    } else {
      // Insert before <execution_protocols> if it exists, otherwise append
      if (/<execution_protocols>/i.test(content)) {
        content = content.replace(
          /(<execution_protocols>)/i,
          `<skills>\n${sections.skills}\n</skills>\n\n$1`
        );
      } else {
        content += `\n\n<skills>\n${sections.skills}\n</skills>\n`;
      }
    }

    // Replace <agent_catalog> section
    const hasAgentCatalog = /<agent_catalog>[\s\S]*?<\/agent_catalog>/i.test(content);
    if (hasAgentCatalog) {
      content = content.replace(
        /<agent_catalog>[\s\S]*?<\/agent_catalog>/i,
        `<agent_catalog>\n${sections.agents}\n</agent_catalog>`
      );
    } else {
      if (/<skills>/i.test(content)) {
        content = content.replace(
          /(<skills>[\s\S]*?<\/skills>)/i,
          `$1\n\n<agent_catalog>\n${sections.agents}\n</agent_catalog>`
        );
      } else {
        content += `\n\n<agent_catalog>\n${sections.agents}\n</agent_catalog>\n`;
      }
    }

    // Replace <tools> section
    const hasToolsSection = /<tools>[\s\S]*?<\/tools>/i.test(content);
    if (hasToolsSection) {
      content = content.replace(
        /<tools>[\s\S]*?<\/tools>/i,
        `<tools>\n${sections.tools}\n</tools>`
      );
    } else {
      if (/<agent_catalog>/i.test(content)) {
        content = content.replace(
          /(<agent_catalog>[\s\S]*?<\/agent_catalog>)/i,
          `$1\n\n<tools>\n${sections.tools}\n</tools>`
        );
      } else {
        content += `\n\n<tools>\n${sections.tools}\n</tools>\n`;
      }
    }

    // Replace or insert hooks description
    const hasHooksPattern = /Hooks inject `<system-reminder>` tags\. Key patterns: [^\n]+/i.test(content);
    if (hasHooksPattern) {
      content = content.replace(
        /Hooks inject `<system-reminder>` tags\. Key patterns: [^\n]+/i,
        sections.hooks
      );
    } else {
      if (/<hooks_and_context>/i.test(content)) {
        content = content.replace(
          /(<hooks_and_context>[\s\S]*?<\/hooks_and_context>)/i,
          `$1\n\n${sections.hooks}`
        );
      } else {
        content += `\n\n${sections.hooks}\n`;
      }
    }

    writeFileSync(claudeMdPath, content, 'utf-8');
    return true;
  } catch {
    return false;
  }
}
