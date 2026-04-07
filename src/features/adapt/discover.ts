/**
 * Discovery module for adapt reconciler
 *
 * Discovers skills, agents, MCP servers, and hooks from the filesystem.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { parseFrontmatter } from '../../utils/frontmatter.js';
import { getClaudeConfigDir } from '../../utils/config-dir.js';
import type {
  DiscoveryResult,
  DiscoveredSkill,
  DiscoveredAgent,
  DiscoveredMcpServer,
  DiscoveredHook,
} from './types.js';

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

function computeHash(name: string, description: string): string {
  const input = `${name}|${description.split('\n')[0].trim()}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Discover all skills from skills directory
 */
export function discoverSkills(): DiscoveredSkill[] {
  const packageRoot = getPackageDir();
  const skillsDir = join(packageRoot, 'skills');
  const skills: DiscoveredSkill[] = [];

  if (!existsSync(skillsDir)) {
    return skills;
  }

  try {
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = join(skillsDir, entry.name, 'SKILL.md');
      if (!existsSync(skillPath)) continue;

      try {
        const content = readFileSync(skillPath, 'utf-8');
        const { metadata } = parseFrontmatter(content);
        const name = metadata.name || entry.name;
        const description = metadata.description || '';
        skills.push({
          name,
          description,
          source: `skills/${entry.name}/SKILL.md`,
          hash: computeHash(name, description),
          triggers: metadata.triggers,
          'argument-hint': metadata['argument-hint'],
        });
      } catch {
        // Skip skills that can't be read
      }
    }
  } catch {
    // Return what we have
  }

  return skills;
}

/**
 * Discover all agents from agents/*.md
 */
export function discoverAgents(): DiscoveredAgent[] {
  const packageRoot = getPackageDir();
  const agentsDir = join(packageRoot, 'agents');
  const agents: DiscoveredAgent[] = [];

  if (!existsSync(agentsDir)) {
    return agents;
  }

  try {
    const entries = readdirSync(agentsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const agentPath = join(agentsDir, entry.name);
      try {
        const content = readFileSync(agentPath, 'utf-8');
        const { metadata } = parseFrontmatter(content);
        const name = metadata.name || basename(entry.name, '.md');
        const description = metadata.description || '';
        agents.push({
          name,
          description,
          source: `agents/${entry.name}`,
          hash: computeHash(name, description),
          model: metadata.model,
          level: metadata.level,
        });
      } catch {
        // Skip agents that can't be read
      }
    }
  } catch {
    // Return what we have
  }

  return agents;
}

/**
 * Discover MCP servers from ~/.claude.json and .mcp.json
 */
export function discoverMcpServers(): DiscoveredMcpServer[] {
  const servers: DiscoveredMcpServer[] = [];
  const configDir = getClaudeConfigDir();
  const claudeJsonPath = join(configDir, 'claude.json');
  const mcpJsonPath = join(process.cwd(), '.mcp.json');

  const filesToCheck = [
    { path: claudeJsonPath, source: '~/.claude.json' },
    { path: mcpJsonPath, source: '.mcp.json' },
  ];

  for (const { path, source } of filesToCheck) {
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, 'utf-8');
      const parsed = JSON.parse(content);
      const mcpServers = parsed.mcpServers || parsed.mcp_servers || {};
      for (const [name, config] of Object.entries(mcpServers)) {
        const serverConfig = config as Record<string, unknown>;
        const description = typeof serverConfig.description === 'string'
          ? serverConfig.description
          : 'UNDOCUMENTED';
        servers.push({
          name,
          description,
          source,
          hash: computeHash(name, description),
        });
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return servers;
}

/**
 * Discover hooks from hooks/hooks.json
 */
export function discoverHooks(): DiscoveredHook[] {
  const packageRoot = getPackageDir();
  const hooksJsonPath = join(packageRoot, 'hooks', 'hooks.json');
  const hooks: DiscoveredHook[] = [];

  if (!existsSync(hooksJsonPath)) {
    return hooks;
  }

  try {
    const content = readFileSync(hooksJsonPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Parse hook event types
    const eventTypes = ['UserPromptSubmit', 'SessionStart', 'PreToolUse', 'PostToolUse',
      'Stop', 'Resume', 'MemRecall', 'Kickoff', 'Summary', 'TaskUpdate',
      'Human', 'Period', 'Attach', 'Generic'];

    for (const eventType of eventTypes) {
      if (parsed[eventType]) {
        const eventConfig = parsed[eventType] as Record<string, unknown>;
        const matchers = eventConfig.matchers || eventConfig.hooks || [];
        for (const matcher of matchers as unknown[]) {
          if (typeof matcher !== 'object' || matcher === null) continue;
          const m = matcher as Record<string, unknown>;
          const command = typeof m.command === 'string' ? m.command : '';
          const truncated = command.length > 80 ? command.slice(0, 77) + '...' : command;
          const name = eventType;
          const description = `${eventType} [${m.matcher || '*'}] -> ${truncated}`;
          hooks.push({
            name: eventType,
            description,
            source: 'hooks/hooks.json',
            hash: computeHash(name, description),
          });
        }
      }
    }
  } catch {
    // Return what we have
  }

  return hooks;
}

/**
 * Discover all capabilities
 */
export function discover(): DiscoveryResult {
  return {
    skills: discoverSkills(),
    agents: discoverAgents(),
    mcp: discoverMcpServers(),
    hooks: discoverHooks(),
  };
}
