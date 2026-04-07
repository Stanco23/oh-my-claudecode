/**
 * Adapt Reconciler - Main entry point
 *
 * Orchestrates discovery, reconciliation, patching, and checkpointing.
 */

import { discover } from './discover.js';
import { reconcile, getClaudeMdPath } from './reconcile.js';
import { patchClaudeMd } from './patch.js';
import { writeCheckpoint } from './checkpoint.js';
import type { DiffEntry, DiscoveryResult } from './types.js';

export interface AdaptResult {
  success: boolean;
  discovered: DiscoveryResult;
  diffs: DiffEntry[];
  checkpointPath: string | null;
  error?: string;
}

/**
 * Run adapt reconciliation
 */
export function runAdapt(
  mode: 'ask' | 'auto' | 'diff',
  projectRoot?: string
): AdaptResult {
  const claudeMdPath = getClaudeMdPath(projectRoot);

  // Discover all capabilities
  const discovered = discover();

  // Reconcile against current CLAUDE.md
  const diffs = reconcile(discovered, claudeMdPath);

  let checkpointPath: string | null = null;
  let approved: boolean | null = null;
  let applied: boolean | null = null;

  if (mode === 'diff') {
    // diff mode: no patch, just checkpoint
    checkpointPath = writeCheckpoint(mode, discovered, diffs, null, null, claudeMdPath);
    return {
      success: true,
      discovered,
      diffs,
      checkpointPath,
    };
  }

  // ask/auto mode: apply patch and checkpoint
  const patchSuccess = patchClaudeMd(claudeMdPath, discovered, []);

  if (patchSuccess) {
    approved = mode === 'ask' ? true : null;
    applied = true;
  } else {
    return {
      success: false,
      discovered,
      diffs,
      checkpointPath: null,
      error: 'Failed to patch CLAUDE.md',
    };
  }

  checkpointPath = writeCheckpoint(mode, discovered, diffs, approved, applied, claudeMdPath);

  return {
    success: true,
    discovered,
    diffs,
    checkpointPath,
  };
}

/**
 * Format diff for display
 */
export function formatDiff(diffs: DiffEntry[]): string {
  if (diffs.length === 0) {
    return 'No changes detected. CLAUDE.md is up to date.';
  }

  const lines: string[] = ['=== DIFF ===\n'];

  const bySection = new Map<string, DiffEntry[]>();
  for (const diff of diffs) {
    const existing = bySection.get(diff.section) || [];
    existing.push(diff);
    bySection.set(diff.section, existing);
  }

  for (const [section, entries] of bySection) {
    lines.push(`### ${section}\n`);

    const newItems = entries.filter(d => d.type === 'NEW');
    const changedItems = entries.filter(d => d.type === 'CHANGED');
    const goneItems = entries.filter(d => d.type === 'GONE');

    if (newItems.length > 0) {
      lines.push(`#### NEW (${newItems.length})`);
      lines.push('| Name | Description | Source |');
      lines.push('|------|-------------|--------|');
      for (const item of newItems) {
        lines.push(`| ${item.name} | ${item.description} | ${item.source} |`);
      }
      lines.push('');
    }

    if (changedItems.length > 0) {
      lines.push(`#### CHANGED (${changedItems.length})`);
      lines.push('| Name | Old Description | New Description | Source |');
      lines.push('|------|----------------|----------------|--------|');
      for (const item of changedItems) {
        lines.push(`| ${item.name} | ${item.oldDescription || '-'} | ${item.description} | ${item.source} |`);
      }
      lines.push('');
    }

    if (goneItems.length > 0) {
      lines.push(`#### GONE (${goneItems.length})`);
      lines.push('| Name | Last Known Description | Source |');
      lines.push('|------|------------------------|--------|');
      for (const item of goneItems) {
        lines.push(`| ${item.name} | ${item.description} | ${item.source} |`);
      }
      lines.push('');
      lines.push('⚠️ GONE items require confirmation before removal.');
      lines.push('');
    }
  }

  return lines.join('\n');
}

export { discover } from './discover.js';
export { reconcile } from './reconcile.js';
export { patchClaudeMd } from './patch.js';
export { writeCheckpoint } from './checkpoint.js';
export type { DiscoveryResult, DiffEntry, Checkpoint, DiscoveredSkill, DiscoveredAgent, DiscoveredMcpServer, DiscoveredHook } from './types.js';
