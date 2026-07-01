# PR Self-Review — product requirements

Business- and user-level requirements for a local, pre-PR review that runs the
project's own skills and gates over open changes, predicts the cloud PR review,
and blocks changes with critical issues from reaching GitHub. Implementation
detail lives in the specs (`specs/pr-self-review.md`, written next).

## Background & problem

DevDigest reviews PRs with AI, but only in the cloud and only **after** a PR is
opened. Nothing checks changes **locally before** they're pushed. A developer can
push code that violates onion architecture, fails typecheck, or ignores the
project's React/Next/Drizzle conventions and only learn of it from CI or a cloud
review — after the PR is public.

Meanwhile the repo already encodes those conventions as skills, already has a
severity model where **only CRITICAL blocks a merge**, and already recomputes a
score and drops ungrounded findings (`docs/agent-prompts/README.md`,
`reviewer-core/src/grounding.ts`, `reviewer-core/src/review/reduce.ts`). We want
those same skills and disciplines, plus the deterministic gates, applied
automatically to every local diff before it leaves the machine.

Findings use three severities, most-to-least serious: **Critical**, **Warning**,
**Suggestion** — the same scale the product's reviewers use. Only **Critical**
blocks.

## Goals

- Review **all open changes** locally before they reach GitHub (push / PR create
  / merge).
- Route each changed file to the skills that apply — **UI files → frontend
  skills**, **backend files → onion/backend skills** — so feedback is relevant
  per file.
- Combine skill-based findings with the **deterministic gates** (typecheck,
  `pnpm arch`, vitest) for the packages that changed.
- **Predict the cloud PR review**: use the same severity scale, verdict, and
  recomputed score, and the same grounding rule, so the local result matches what
  the PR review would say.
- Catch this repo's **known silent breaks**: vendored-contract drift, schema
  changes with no migration, and missing i18n keys.
- **Hard-block** push / PR create / merge when there is ≥ 1 Critical; let
  Warning/Suggestion through with a summary; allow exactly one **deliberate,
  logged override**.
- Be **runnable manually** at any time and run **automatically** before
  GitHub-bound operations — and be **fast**: a no-op when the diff hasn't changed
  since the last clean review.

## User stories

1. **As a developer about to open a PR**, when I run the self-review (or trigger a
   push), Claude reviews my full local diff and gives me the same verdict,
   severity counts, and score the cloud PR review would — so I know up front
   whether it'll pass.
2. **As a developer**, I want UI files reviewed by the frontend skills and backend
   files by the onion/backend skills, so I get relevant feedback per file rather
   than generic advice.
3. **As a developer**, I want typecheck / `pnpm arch` / test failures — and this
   repo's silent-break gates (contract drift, missing migration, i18n gaps) —
   surfaced **alongside** the skill findings, in one report, each with a fix hint.
4. **As a developer**, if the review finds ≥ 1 Critical, I'm **blocked** from
   pushing / creating / merging until I fix it — or, rarely, take one deliberate
   **logged override** — so broken or architecture-violating code never leaves my
   machine unnoticed.
5. **As a developer with only Warning/Suggestion findings**, I can proceed, and I
   still see them in the summary so quality trends up over time.
6. **As a developer**, I can run the self-review **manually** at any point to get
   early feedback, and I trust it not to invent findings — everything it reports
   cites a real changed line.
7. **As a developer**, when I've already run a clean review and changed nothing,
   pushing doesn't re-run the whole review — the gate is effectively instant.

## Functional requirements

### Change detection

"All open changes" = committed changes on the current branch not yet in `main`
(branch diff vs `main`) **plus** uncommitted working-tree changes (staged +
unstaged). Paths under do-not-touch roots (`server/clones/**`,
`**/src/vendor/**`, build output) are excluded from the skill review. Editing a
`server/clones/**` file is a **Critical** (third-party clones are never touched) and
committing build output is a **Warning**. Vendored `src/vendor/shared` contracts *may*
be edited — but every copy must stay identical, so an **unsynced** vendored edit
(drift) is the **Critical**, not a properly synced one.

### File routing

Each changed file is reviewed only with the skills that apply to its surface. Only
the skills whose surface actually appears in the diff are loaded, and only the
changed hunks (plus minimal context) are reviewed.

| Surface | Paths | Skills applied |
|---|---|---|
| UI / frontend | `client/**` (`.tsx`, `.ts`, styles) | frontend-ui-architecture · next-best-practices · react-best-practices · react-testing-library |
| Backend / domain | `server/src/**`, `reviewer-core/src/**` (`.ts`) | onion-architecture · fastify-best-practices · drizzle-orm-patterns · postgresql-table-design |
| Cross-cutting | either surface | typescript-expert · zod · security |
| Excluded (do-not-touch) | `server/clones/**`, `**/src/vendor/**`, build output | none — `clones/**` edits Critical; vendored edits checked for drift |

### Mechanical gates

Deterministic gates run only for packages that have changed files, in parallel
across those packages:

- **client** → `pnpm typecheck` + `pnpm test`
- **server** → `pnpm typecheck` + `pnpm run arch` + unit vitest
  (integration / e2e excluded)
- **reviewer-core** → `npm run typecheck` + `npm test` (+ `npm run arch`)

A failing gate — typecheck error, onion / dependency-cruiser violation, or a
failing unit test — is a **Critical**.

### Repo-specific silent-break gates

- **Vendored-contract drift** — a contract changed in one `**/src/vendor/shared/**`
  copy but not the matching copies (no auto-sync exists) → **Critical**.
- **Migration drift** — a `server/src/db` schema change with no accompanying new
  migration → **Critical** (migrations do not run on boot).
- **i18n completeness** — a UI change that adds or removes a user-facing string
  without the matching `client/src/messages` key → **Warning**.

### Findings discipline

Every finding must cite a real `file:line` in the diff or it is dropped
(grounding). Each finding names the skill or gate it comes from and a short **fix
hint**. Speculative issues ("might be", "if not already handled") are at most
Warning (anti-inflation). No duplicates, and no padding toward a count — zero
findings is a valid, good result.

### Severity, verdict, and score

Reuse the product's model. Severity is **Critical** (blocking) / **Warning** /
**Suggestion** (non-blocking). Verdict is `request_changes` (≥ 1 Critical) /
`comment` (only non-blocking findings) / `approve` (no findings). Score is
**recomputed**, never guessed: 100 base, −35 per Critical, −12 per Warning, −3 per
Suggestion. The block threshold is **critical**, matching the product's `ciFailOn`
default, so the local and cloud gates never disagree.

### Gate, blocking, and override

≥ 1 Critical ⇒ verdict `request_changes` and GitHub-bound operations
(`git push`, `gh pr create`, `gh pr merge`) are **blocked automatically**.
Non-blocking findings never block. The only bypass is a single, **deliberate,
logged override**, so any bypass is auditable.

### Report

One summary: verdict, score, per-severity counts, and each finding with its
`file:line`, its source (which skill or gate raised it), a short rationale, and a
fix hint. Non-blocking findings are **always listed**, even when the review passes.

### Invocation and performance

Runnable on demand, and run automatically before the GitHub-bound operations
above. When the current diff matches the last **clean** review, the review is
**skipped** (a no-op), so an unchanged push isn't re-reviewed.

## Acceptance criteria

- A diff touching both `client/` and `server/` produces a report with UI findings
  from the frontend skills, backend findings from the onion/backend skills, and
  mechanical-gate results for both packages.
- A backend change that violates onion layering (e.g. a service importing Drizzle)
  fails `pnpm run arch`, is reported **Critical**, and blocks push/PR.
- A contract edited in `server/src/vendor/shared` but not `client/src/vendor/shared`
  (or vice versa) is flagged **Critical** (drift).
- A `server/src/db` schema change with no new migration file is flagged
  **Critical**.
- A new user-facing UI string with no matching `client/src/messages` key is flagged
  **Warning** and does **not** block.
- A change with only Suggestion-level findings yields verdict `comment` / `approve`
  and push/PR is allowed, with the suggestions still shown.
- With ≥ 1 Critical, attempting `git push` / `gh pr create` / `gh pr merge` is
  blocked with the Critical(s) listed; the block clears once the diff re-reviews
  clean, or via one logged override.
- A finding that doesn't cite a changed line is not shown; the report's score
  matches the product's formula and the verdict matches what the cloud review would
  return.
- Running the self-review manually on a clean diff yields "approve / no findings"
  and blocks nothing.
- Editing a `server/clones/**` file is flagged **Critical**; a vendored contract edit
  passes when both copies stay identical but is **Critical** when it drifts.
- Pushing twice with no diff change in between re-reviews only once (the second push
  is an instant no-op).

## Non-goals

- Replacing CI or the cloud PR review — this is a fast **local pre-PR** gate, not
  the authoritative review.
- Integration / e2e suites and the full stack (testcontainers Postgres,
  `./scripts/dev.sh`, browser e2e) — too slow for a pre-push gate; left to CI.
- Auto-fixing findings — the review reports, blocks, and hints; it does not rewrite
  the code.
- Changing how severity or score are defined, or how the product's own reviewers
  assign them.
- Reviewing changes already merged to `main`, or assets outside the routing rules.
