/**
 * omc adapt CLI subcommand
 *
 * Manual invocation of the adapt skill for CLAUDE.md reconciliation.
 *
 * Usage:
 *   omc adapt --ask     Discover, show diff, apply only on approval (default)
 *   omc adapt --auto    Discover, show diff, apply immediately
 *   omc adapt --diff    Discover and show diff without patching or checkpointing
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ADAPT_USAGE = `
Usage: omc adapt [--ask|--auto|--diff]

  --ask   Ask mode (default): show diff, wait for approval, then patch
  --auto  Auto mode: apply patch immediately, log to checkpoint
  --diff  Show diff only: no checkpoint, no patch

For session-start integration, use:
  claude --adapt        # ask mode on session start
  claude --adapt-auto   # auto mode on session start
`.trim();

type AdaptMode = 'ask' | 'auto' | 'diff';

export interface AdaptArgs {
  mode: AdaptMode;
}

function parseAdaptArgs(args: string[]): AdaptArgs {
  const flags = new Set(args.filter(a => !a.startsWith('--') || ['--ask', '--auto', '--diff'].includes(a)));
  const hasAsk = args.includes('--ask');
  const hasAuto = args.includes('--auto');
  const hasDiff = args.includes('--diff');

  if ((hasAsk ? 1 : 0) + (hasAuto ? 1 : 0) + (hasDiff ? 1 : 0) > 1) {
    throw new Error('Error: Only one of --ask, --auto, or --diff may be specified.\n' + ADAPT_USAGE);
  }

  const mode: AdaptMode = hasAuto ? 'auto' : hasDiff ? 'diff' : 'ask';
  return { mode };
}

function getSkillPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // From src/cli/commands/adapt.ts → project root
  const root = join(__dirname, '..', '..', '..');
  return join(root, 'skills', 'adapt', 'SKILL.md');
}

export function adaptCommand(args: string[]): void {
  let mode: AdaptMode;
  try {
    ({ mode } = parseAdaptArgs(args));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    console.log(ADAPT_USAGE);
    process.exit(1);
    return;
  }

  const skillPath = getSkillPath();

  if (!existsSync(skillPath)) {
    console.error(`Error: adapt skill not found at ${skillPath}`);
    console.error('Run "omc setup" to install the adapt skill.');
    process.exit(1);
    return;
  }

  try {
    const skillContent = readFileSync(skillPath, 'utf-8');
    // Inject mode as a directive
    const adaptedContent = skillContent + `\n\n---\nMode: ${mode}\n`;
    console.log('[ADAPT SKILL INVOKED]\n');
    console.log(adaptedContent);
  } catch (err) {
    console.error(`Error reading adapt skill: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
