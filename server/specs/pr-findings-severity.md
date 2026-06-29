# PR Findings by Severity — server spec

Expose each PR's findings on the list endpoint so the client can show a FINDINGS
column (per-severity counts + hover/click popover) without a per-row fetch. No
new model calls — findings already exist in the `findings` table; this re-reads
and aggregates them. Keep delete + freshness semantics consistent so the column
never drifts.

## Contract additions (`@devdigest/shared`, vendored)

Edit `server/src/vendor/shared/contracts/platform.ts`, then mirror by hand into
`client/src/vendor/shared/` (no auto-sync).

- `PrMeta` += `findings: z.array(Finding).nullish()` (imports `Finding` from
  `./findings.js`).
  - **Must be optional (`.nullish()`)**, like `score` / `cost_usd`. `PrMeta` is
    also the return type of the GitHub adapter (`listPullRequests`) and the base
    of `PrDetail` (`getPullRequest` + the offline fallback), none of which carry
    list-only finding data. A required field (or `.default([])`, whose zod
    *output* type is required) breaks `octokit.ts` / `mocks.ts` / the detail
    handler at typecheck.
  - The list route fills it; everyone else omits it → `null`/absent.

## GET `/repos/:id/pulls` (`PrMeta[]`)

`findings` = **all findings across the PR's `kind = 'review'` runs**, mirroring
the PR detail page which flattens findings across every run. Computed on read in
the same `prIds.length > 0` block as `score`/`cost_usd`:

```
findings ⨝ reviews ON findings.review_id = reviews.id
WHERE reviews.pr_id IN (prIds) AND reviews.kind = 'review'
```

then grouped per `pr_id` in JS into `findingsByPr`. Each row maps DB columns →
the `Finding` shape (`start_line`/`end_line`, `kind`, `category`, `rationale`,
`suggestion`, `confidence`, …); `trifecta_components`/`evidence` are omitted
(optional in the contract). The route has no Zod response schema, so the mapped
array is cast to `Finding[]`. PRs with no review findings → `findings: []`.

It is a read-time aggregate (no stored/denormalized count to drift) — deleting a
run or dismissing a finding is reflected on the next fetch.

## Delete + freshness semantics

So the list FINDINGS column and the timeline stay consistent after mutations:

- **`ReviewService.deleteReview`** — when the review has a `run_id`, delete the
  whole agent run (`deleteAgentRun`) rather than just the review row, so the
  timeline run and its findings disappear together. Workspace-scoped: returns
  `false` if the review is missing or not in the caller's workspace.
- **`deleteAgentRun`** (run.repo) — deletes the run's `reviews` (cascading their
  findings) and the `agent_runs` row; returns `true` if **either** deletion hit a
  row (a review may outlive its run row).
- **Client query invalidation** (`client/src/lib/hooks/reviews.ts`) — review/run
  mutations now also invalidate `["pulls"]` (and `pr-runs` / `pr-active-runs`) so
  the FINDINGS column refetches: `useDeleteReview`, `useRunReview`,
  `useFindingAction`.

## Out of scope

- `reviewer-core` (already produces findings).
- Denormalizing a per-severity count onto `pull_requests` (kept as a read-time
  aggregate, like `cost_usd`).
- `multi_agent_runs` / `ci_runs` / `eval_runs` finding aggregates.
