/**
 * omc adapt CLI subcommand
 *
 * Manual invocation of the adapt reconciler for CLAUDE.md reconciliation.
 *
 * Usage:
 *   omc adapt --ask     Discover, show diff, apply only on approval (default)
 *   omc adapt --auto    Discover, show diff, apply immediately
 *   omc adapt --diff    Discover and show diff without patching or checkpointing
 */

import { runAdapt, formatDiff } from '../../features/adapt/index.js';

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
  const hasAsk = args.includes('--ask');
  const hasAuto = args.includes('--auto');
  const hasDiff = args.includes('--diff');

  if ((hasAsk ? 1 : 0) + (hasAuto ? 1 : 0) + (hasDiff ? 1 : 0) > 1) {
    throw new Error('Error: Only one of --ask, --auto, or --diff may be specified.\n' + ADAPT_USAGE);
  }

  const mode: AdaptMode = hasAuto ? 'auto' : hasDiff ? 'diff' : 'ask';
  return { mode };
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

  // Run the adapt reconciler
  const result = runAdapt(mode);

  if (!result.success) {
    console.error(`Error: ${result.error || 'Adapt reconciliation failed'}`);
    process.exit(1);
    return;
  }

  // Show diff
  const diffOutput = formatDiff(result.diffs);
  console.log(diffOutput);

  // Show summary
  console.log('\n--- Summary ---');
  console.log(`Found ${result.diffs.length} change(s)`);
  if (result.checkpointPath) {
    console.log(`Checkpoint: ${result.checkpointPath}`);
  }

  if (result.diffs.length === 0) {
    console.log('\nNo changes needed. CLAUDE.md is already up to date.');
  }
}
