// pr-self-review-enforce.mjs — PreToolUse gate for PR Self-Review.
//
// Reads the hook JSON on stdin. For a GitHub-bound git op (git push /
// gh pr create / gh pr merge) it ALLOWS only when a clean pass marker matches the
// current diff hash; otherwise it DENIES and points the user at /pr-self-review.
// Every other command is allowed untouched.
//
// FAIL-OPEN: any internal error allows the command. A gate bug must never brick
// git. Only a definite "no valid marker" denies.
import { readFileSync } from 'node:fs';

const DIFF_MODULE = new URL('../skills/pr-self-review/scripts/diff.mjs', import.meta.url).href;
const MARKER_MODULE = new URL('../skills/pr-self-review/scripts/marker.mjs', import.meta.url).href;

function isGatedCommand(cmd) {
  return (
    /\bgit\s+push\b/.test(cmd) ||
    /\bgh\s+pr\s+create\b/.test(cmd) ||
    /\bgh\s+pr\s+merge\b/.test(cmd)
  );
}

function extractOverride(cmd) {
  const m = cmd.match(/DEVDIGEST_PR_OVERRIDE=(?:"([^"]*)"|'([^']*)'|(\S+))/);
  const inline = m ? (m[1] ?? m[2] ?? m[3]) : null;
  return inline || process.env.DEVDIGEST_PR_OVERRIDE || null;
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `${reason} Run /pr-self-review, resolve any CRITICALs, then retry (or override with DEVDIGEST_PR_OVERRIDE="reason").`,
        additionalContext:
          'PR Self-Review gate: this git/gh operation is blocked until a clean local review marker matches the current changes. Run the /pr-self-review skill.',
      },
    }),
  );
  process.exit(0);
}

async function main() {
  let input = {};
  try {
    const raw = readFileSync(0, 'utf8');
    input = raw ? JSON.parse(raw) : {};
  } catch {
    process.exit(0); // no/garbled stdin → allow
  }

  const command = input?.tool_input?.command ?? '';
  if (!isGatedCommand(command)) process.exit(0);

  // Run in the repo the command targets.
  try {
    if (input.cwd) process.chdir(input.cwd);
  } catch {
    /* keep current cwd */
  }

  // Override — deliberate + audited.
  const overrideReason = extractOverride(command);
  if (overrideReason) {
    try {
      const { appendOverride } = await import(MARKER_MODULE);
      appendOverride({ time: new Date().toISOString(), reason: overrideReason, command });
    } catch {
      /* logging is best-effort; still allow */
    }
    process.exit(0);
  }

  // The decision: allow only on a clean marker matching the current diff.
  try {
    const { computeChangeSet } = await import(DIFF_MODULE);
    const { readMarker } = await import(MARKER_MODULE);
    const cs = computeChangeSet();
    const marker = readMarker();

    if (marker && marker.diffHash === cs.diffHash && marker.verdict !== 'request_changes') {
      process.exit(0); // clean + current → allow
    }

    const reason = !marker
      ? 'No PR Self-Review has passed for the current changes.'
      : marker.diffHash !== cs.diffHash
        ? 'Your changes differ from the last reviewed diff.'
        : 'The last PR Self-Review requested changes.';
    deny(reason);
  } catch {
    process.exit(0); // fail-open on any internal error
  }
}

main().catch(() => process.exit(0));
