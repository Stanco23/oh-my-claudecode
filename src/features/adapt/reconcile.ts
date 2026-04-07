/**
 * Reconciliation module for adapt reconciler
 *
 * Compares discovered items against current CLAUDE.md content.
 */

import { existsSync, readFileSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import type {
  DiscoveryResult,
  DiffEntry,
} from './types.js';

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
      // Verify CLAUDE.md exists at this path before returning
      if (existsSync(join(pkgDir, 'CLAUDE.md'))) {
        return pkgDir;
      }
    }
  }

  // Fallback: try import.meta.url resolution
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkgDir = join(__dirname, '..', '..', '..');
    if (existsSync(join(pkgDir, 'CLAUDE.md'))) {
      return pkgDir;
    }
  } catch {
    // fall through
  }

  // Last resort: use cwd
  return process.cwd();
}

interface ParsedSection {
  skills: string[];
  agents: string[];
  mcp: string[];
  hooks: string[];
}

/**
 * Parse dynamic sections from CLAUDE.md
 */
function parseClaudeMd(claudeMdPath: string): ParsedSection {
  const skills: string[] = [];
  const agents: string[] = [];
  const mcp: string[] = [];
  const hooks: string[] = [];

  if (!existsSync(claudeMdPath)) {
    return { skills, agents, mcp, hooks };
  }

  try {
    const content = readFileSync(claudeMdPath, 'utf-8');

    // Extract <skills> section
    const skillsMatch = /<skills>([\s\S]*?)<\/skills>/i.exec(content);
    if (skillsMatch) {
      const skillsContent = skillsMatch[1];
      // Extract skill names - look for lines with skill names
      const lines = skillsContent.split('\n');
      for (const line of lines) {
        const match = /`([^`]+)`/.exec(line);
        if (match) {
          const name = match[1].replace(/^\/oh-my-claudecode:/, '');
          if (name && !name.includes(',') && name.length > 1) {
            skills.push(name.trim());
          }
        }
        // Also capture workflow/keyword trigger patterns
        const triggerMatch = /"(autopilot|ralph|ultrawork|team|ccg|ultraqa|omc-plan|ralplan|sciomc|external-context|deepinit|deep-interview|ai-slop-cleaner|self-improve)"/i.exec(line);
        if (triggerMatch) {
          const name = triggerMatch[1].toLowerCase();
          if (!skills.includes(name)) skills.push(name);
        }
      }
    }

    // Extract <agent_catalog> section
    const agentsMatch = /<agent_catalog>([\s\S]*?)<\/agent_catalog>/i.exec(content);
    if (agentsMatch) {
      const agentsContent = agentsMatch[1];
      // Extract agent names - look for backtick-quoted names
      const matches = agentsContent.matchAll(/`([^`]+)`/g);
      for (const match of matches) {
        const name = match[1].replace(/^oh-my-claudecode:/, '').trim();
        if (name && !name.includes(',') && name.length > 1 && !name.includes(' ')) {
          agents.push(name);
        }
      }
    }

    // Extract <tools> section
    const toolsMatch = /<tools>([\s\S]*?)<\/tools>/i.exec(content);
    if (toolsMatch) {
      const toolsContent = toolsMatch[1];
      const matches = toolsContent.matchAll(/`([^`]+)`/g);
      for (const match of matches) {
        const name = match[1].trim();
        if (name.startsWith('mcp__') || name.includes('MCP')) continue;
        mcp.push(name);
      }
    }

    // Extract hooks from <hooks_and_context>
    const hooksMatch = /<hooks_and_context>([\s\S]*?)<\/hooks_and_context>/i.exec(content);
    if (hooksMatch) {
      const hooksContent = hooksMatch[1];
      // Extract hook event types
      const eventTypes = ['UserPromptSubmit', 'SessionStart', 'PreToolUse', 'PostToolUse',
        'Stop', 'Resume', 'MemRecall', 'Kickoff', 'Summary', 'TaskUpdate',
        'Human', 'Period', 'Attach', 'Generic'];
      for (const eventType of eventTypes) {
        if (hooksContent.includes(eventType)) {
          hooks.push(eventType);
        }
      }
    }
  } catch {
    // Return empty sections
  }

  return { skills, agents, mcp, hooks };
}

/**
 * Extract items from a section by parsing lines with backtick-quoted names
 */
function extractItemsFromSection(sectionName: string, content: string): Map<string, string> {
  const items = new Map<string, string>();

  // Match patterns like `name` - description or just `name`
  const pattern = /`([^`]+)`[^\n]*(?:\n|$)/g;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const name = match[1].trim();
    if (name && name.length > 1 && !name.includes(',')) {
      items.set(name.toLowerCase(), match[0]);
    }
  }

  return items;
}

/**
 * Reconcile discovered items against current CLAUDE.md
 */
export function reconcile(
  discovered: DiscoveryResult,
  claudeMdPath: string
): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  const parsed = parseClaudeMd(claudeMdPath);

  // Reconcile skills
  const knownSkills = new Map<string, string>();
  for (const skill of discovered.skills) {
    const key = skill.name.toLowerCase();
    knownSkills.set(key, skill.description);
  }

  for (const skill of discovered.skills) {
    const key = skill.name.toLowerCase();
    const found = parsed.skills.some(s => s.toLowerCase() === key);
    if (!found) {
      diffs.push({
        type: 'NEW',
        section: 'skills',
        name: skill.name,
        description: skill.description,
        source: skill.source,
      });
    }
  }

  // Reconcile agents
  for (const agent of discovered.agents) {
    const key = agent.name.toLowerCase();
    const found = parsed.agents.some(a => a.toLowerCase() === key);
    if (!found) {
      diffs.push({
        type: 'NEW',
        section: 'agents',
        name: agent.name,
        description: agent.description,
        source: agent.source,
      });
    }
  }

  // Reconcile MCP servers
  for (const server of discovered.mcp) {
    const key = server.name.toLowerCase();
    const found = parsed.mcp.some(m => m.toLowerCase() === key);
    if (!found) {
      diffs.push({
        type: 'NEW',
        section: 'mcp',
        name: server.name,
        description: server.description,
        source: server.source,
      });
    }
  }

  // Reconcile hooks
  for (const hook of discovered.hooks) {
    const key = hook.name.toLowerCase();
    const found = parsed.hooks.some(h => h.toLowerCase() === key);
    if (!found) {
      diffs.push({
        type: 'NEW',
        section: 'hooks',
        name: hook.name,
        description: hook.description,
        source: hook.source,
      });
    }
  }

  // Check for GONE items (in CLAUDE.md but no longer discovered)
  // Skills
  for (const skillName of parsed.skills) {
    const key = skillName.toLowerCase();
    const found = discovered.skills.some(s => s.name.toLowerCase() === key);
    if (!found) {
      diffs.push({
        type: 'GONE',
        section: 'skills',
        name: skillName,
        description: 'No longer found in skills directory',
        source: 'previously in CLAUDE.md',
      });
    }
  }

  // Agents
  for (const agentName of parsed.agents) {
    const key = agentName.toLowerCase();
    const found = discovered.agents.some(a => a.name.toLowerCase() === key);
    if (!found) {
      diffs.push({
        type: 'GONE',
        section: 'agents',
        name: agentName,
        description: 'No longer found in agents directory',
        source: 'previously in CLAUDE.md',
      });
    }
  }

  return diffs;
}

/**
 * Get the CLAUDE.md path for a project
 */
export function getClaudeMdPath(projectRoot?: string): string {
  if (!projectRoot) {
    projectRoot = process.cwd();
  }
  return join(projectRoot, 'CLAUDE.md');
}
