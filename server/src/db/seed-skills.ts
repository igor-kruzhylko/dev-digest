/**
 * Skill bodies used by the seed. Mirrors `seed-prompts.ts`: the DB row is the
 * source of truth at run time; editing a body here only affects freshly
 * seeded workspaces. Injected verbatim as the `## Skills / rules` prompt
 * block by `assemblePrompt` when a skill is linked to an agent AND enabled.
 */

export const PR_QUALITY_RUBRIC_BODY = `# PR quality rubric

Score the diff against these dimensions. Call out the ones that fail; do not
restate the ones that pass.

## Correctness
- Every changed branch is exercised by the diff's own logic — no dead code,
  no unreachable conditions introduced by this change.

## Tests
- New/changed behaviour has a test that covers the added branch, not just the
  happy path. A single passing example is not coverage of a conditional.

## Docs
- A changed public contract (route, exported function signature, config key)
  has its comment/docstring updated to match.

## Naming
- Names describe what the value/function IS or DOES, not its type or an
  implementation detail (\`userList\` not \`userArray\`, \`isExpired\` not \`flag\`).

## Security cross-check
- No secret, credential, or PII introduced in plaintext; no new endpoint
  without an authz check visible in the diff.`;

/**
 * Earlier bodies for the Versions-tab demo (pr-quality-rubric evolves over
 * time — Tests/Docs/Naming/Security dimensions were added one at a time).
 * Seeded as `skill_versions` snapshots; only the LATEST body is written to
 * `skills.body` (the row `pr-quality-rubric` seeds at v5 = the constant above).
 */
export const PR_QUALITY_RUBRIC_HISTORY: Array<{ label: string; body: string }> = [
  {
    label: 'Initial rubric',
    body: `# PR quality rubric

Score the diff against these dimensions. Call out the ones that fail; do not
restate the ones that pass.

## Correctness
- Every changed branch is exercised by the diff's own logic — no dead code,
  no unreachable conditions introduced by this change.`,
  },
  {
    label: 'Added Tests dimension',
    body: `# PR quality rubric

Score the diff against these dimensions. Call out the ones that fail; do not
restate the ones that pass.

## Correctness
- Every changed branch is exercised by the diff's own logic — no dead code,
  no unreachable conditions introduced by this change.

## Tests
- New/changed behaviour has a test that covers the added branch, not just the
  happy path. A single passing example is not coverage of a conditional.`,
  },
  {
    label: 'Added Docs dimension',
    body: `# PR quality rubric

Score the diff against these dimensions. Call out the ones that fail; do not
restate the ones that pass.

## Correctness
- Every changed branch is exercised by the diff's own logic — no dead code,
  no unreachable conditions introduced by this change.

## Tests
- New/changed behaviour has a test that covers the added branch, not just the
  happy path. A single passing example is not coverage of a conditional.

## Docs
- A changed public contract (route, exported function signature, config key)
  has its comment/docstring updated to match.`,
  },
  {
    label: 'Tightened naming conventions',
    body: `# PR quality rubric

Score the diff against these dimensions. Call out the ones that fail; do not
restate the ones that pass.

## Correctness
- Every changed branch is exercised by the diff's own logic — no dead code,
  no unreachable conditions introduced by this change.

## Tests
- New/changed behaviour has a test that covers the added branch, not just the
  happy path. A single passing example is not coverage of a conditional.

## Docs
- A changed public contract (route, exported function signature, config key)
  has its comment/docstring updated to match.

## Naming
- Names describe what the value/function IS or DOES, not its type or an
  implementation detail (\`userList\` not \`userArray\`, \`isExpired\` not \`flag\`).`,
  },
  // v5 (current) — the "Security cross-check" dimension is added in
  // PR_QUALITY_RUBRIC_BODY above; no separate entry needed here.
];

export const SECRET_LEAKAGE_GATE_BODY = `# Secret leakage gate

Flag any of the following introduced by the diff, regardless of how minor it
looks:
- A literal API key, token, password, or private key in source, config,
  fixtures, or test files (including obviously-fake-looking values in test
  files — verify they match a known safe placeholder pattern first).
- A secret read from an environment variable then logged, echoed in an error
  message, or included in a response body.
- A \`.env\` file (or equivalent) added to version control instead of
  \`.env.example\`.

Every match is at least CRITICAL — a leaked credential is exploitable the
moment the diff merges, not a theoretical risk.`;

export const LETHAL_TRIFECTA_BODY = `# Lethal trifecta check

Before classifying anything as a lethal-trifecta finding, confirm you can name
all three components with a concrete file:line:
1. UNTRUSTED content reaching an LLM/agent (a PR body, fetched web page, file
   content, or tool output the agent ingests as instructions or context).
2. That same LLM/agent call has access to PRIVATE data (secrets, internal
   APIs, another user's records).
3. A path for that data to leave the trust boundary (an outbound HTTP call,
   a tool the model can invoke, or output an attacker can read).

An authenticated endpoint that returns data to the user who owns it is
ordinary access control, not a trifecta — do not over-classify. When any leg
is missing, downgrade to a normal finding or drop it.`;

/**
 * The Test Quality Reviewer's experiment skill. Seeded with
 * `source: 'extracted'` to represent an imported origin (the live
 * preview→save import path is validated separately, through the UI).
 */
export const TEST_QUALITY_RUBRIC_BODY = `# Test quality rubric

For every test added or changed in this diff, check:

## Branch coverage
- Does a test exist for EACH branch the diff's new/changed logic can take —
  not just the branch the author had in mind? A conditional with an untested
  branch is an untested feature, even if the file has other passing tests.

## Boundary values
- For a numeric or size comparison (\`>\`, \`>=\`, \`<\`, \`<=\`, array length,
  string length), is the boundary value itself tested (e.g. exactly at the
  threshold), not just a value comfortably inside or outside it?

## Over-mocking
- Does the test mock so much of the unit under test that it can no longer
  fail when the real logic breaks? A mock that returns the exact value the
  assertion checks for proves nothing.

## Flakiness
- Timing-dependent assertions (\`setTimeout\`, unguarded async races), reliance
  on external state, or non-deterministic ordering that could pass/fail
  between runs.

Report a WARNING (or CRITICAL if the untested branch is a security/data-loss
path) for each gap found — do not treat "a test file was added" as sufficient
on its own.`;

/**
 * The API Contract Reviewer's experiment skill. Seeded with `source: 'manual'`.
 */
export const API_CONTRACT_GATE_BODY = `# API contract gate

For every changed HTTP route handler (Fastify route, Express handler, or
equivalent) in this diff, check whether the change is BREAKING for existing
callers:

## Breaking (flag as CRITICAL — blocks merge)
- The success response shape changed (a field was removed/renamed, an array
  became an object or vice versa, a field's type changed).
- A request parameter (path, query, or body field) that callers previously
  could send is now rejected, silently ignored, or required when it used to
  be optional.
- A status code that used to indicate success now indicates failure, or the
  route was removed/renamed without a documented migration.

## Not breaking (do not flag under this skill)
- A new OPTIONAL field added to the response.
- A new optional request parameter.
- An internal refactor with no change to the wire contract.

For each breaking change, cite the exact before/after shape from the diff and
name which caller behaviour breaks (e.g. "callers reading \`total\` from the
response will now get \`undefined\`").`;
