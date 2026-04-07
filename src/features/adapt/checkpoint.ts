/**
 * Checkpoint module for adapt reconciler
 *
 * Writes audit trail for adapt operations.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { atomicWriteJsonSync } from '../../lib/atomic-write.js';
import type { Checkpoint, DiscoveryResult, DiffEntry } from './types.js';

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

function formatTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

function getCheckpointDir(): string {
  const packageRoot = getPackageDir();
  return join(packageRoot, '.omc', 'adapt', 'checkpoints');
}

function ensureCheckpointDir(): void {
  const dir = getCheckpointDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Extract OMC version from CLAUDE.md
 */
function getOmcVersion(claudeMdPath: string): string {
  if (!existsSync(claudeMdPath)) {
    return 'unknown';
  }

  try {
    const content = readFileSync(claudeMdPath, 'utf-8');
    const match = /OMC:VERSION:([^\s>\n]+)/.exec(content);
    return match ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Write a checkpoint file
 */
export function writeCheckpoint(
  mode: 'ask' | 'auto' | 'diff',
  discovered: DiscoveryResult,
  diffs: DiffEntry[],
  approved: boolean | null,
  applied: boolean | null,
  claudeMdPath: string
): string | null {
  ensureCheckpointDir();

  const timestamp = new Date().toISOString();
  const version = getOmcVersion(claudeMdPath);
  const filename = `${formatTimestamp()}.json`;
  const filepath = join(getCheckpointDir(), filename);

  const checkpoint: Checkpoint = {
    timestamp,
    mode,
    discovered,
    diff: diffs,
    approved,
    applied,
    claude_md_version: version,
  };

  try {
    atomicWriteJsonSync(filepath, checkpoint);
    return filepath;
  } catch {
    return null;
  }
}

/**
 * Read the latest checkpoint
 */
export function readLatestCheckpoint(): Checkpoint | null {
  const dir = getCheckpointDir();
  if (!existsSync(dir)) {
    return null;
  }

  try {
    const { readdirSync } = require('fs');
    const files = readdirSync(dir)
      .filter((f: string) => f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      return null;
    }

    const content = readFileSync(join(dir, files[0]), 'utf-8');
    return JSON.parse(content) as Checkpoint;
  } catch {
    return null;
  }
}
