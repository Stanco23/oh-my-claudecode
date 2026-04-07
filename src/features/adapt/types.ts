/**
 * Types for the adapt reconciler
 */

export interface DiscoveredSkill {
  name: string;
  description: string;
  source: string;
  hash: string;
  triggers?: string;
  'argument-hint'?: string;
}

export interface DiscoveredAgent {
  name: string;
  description: string;
  source: string;
  hash: string;
  model?: string;
  level?: string;
}

export interface DiscoveredMcpServer {
  name: string;
  description: string;
  source: string;
  hash: string;
}

export interface DiscoveredHook {
  name: string;
  description: string;
  source: string;
  hash: string;
}

export interface DiscoveryResult {
  skills: DiscoveredSkill[];
  agents: DiscoveredAgent[];
  mcp: DiscoveredMcpServer[];
  hooks: DiscoveredHook[];
}

export type DiffType = 'NEW' | 'CHANGED' | 'GONE';

export interface DiffEntry {
  type: DiffType;
  section: 'skills' | 'agents' | 'mcp' | 'hooks';
  name: string;
  description: string;
  source: string;
  oldDescription?: string;
}

export interface Checkpoint {
  timestamp: string;
  mode: 'ask' | 'auto' | 'diff';
  discovered: DiscoveryResult;
  diff: DiffEntry[];
  approved: boolean | null;
  applied: boolean | null;
  claude_md_version: string;
}

export interface ReconcilerOptions {
  mode: 'ask' | 'auto' | 'diff';
  projectRoot: string;
}

export interface SectionUpdate {
  section: 'skills' | 'agents' | 'mcp' | 'hooks';
  entries: DiffEntry[];
}
