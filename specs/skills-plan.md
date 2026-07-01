# Skills — implementation plan

Ordered, phased build plan for the Skills feature. Requirements → `docs/skills.md`;
technical spec → `specs/skills.md`. Each phase is self-contained, independently
testable, and a commit boundary that leaves the tree green (typecheck + tests).
Dependency root is **Phase 0**; everything else builds on it.

Cumulatively ~6 commits. All product/design decisions are locked in `specs/skills.md`
(§14) — no open questions remain for the plan.

## Phase 0 — Contracts + schema (foundation)

**Goal:** every type and table the server and client depend on.

- **Canonical contracts** (`shared/contracts/knowledge.ts`): add `CreateSkillInput`,
  `UpdateSkillInput` (+ `version_label`), `SkillVersion` (+ `label`),
  `SkillImportPreview`, `ImportSkillInput`, `SkillUsage`; extend `AgentSkillLink`
  (+ `enabled`) and `SetAgentSkillsInput` (+ `links[]`, keep legacy forms). Export
  from `index.ts`.
- **Vendor ×2** byte-identically → `server/src/vendor/shared` + `client/src/vendor/shared`.
- **Schema** (`db/schema/{agents,skills}.ts`): `agent_skills.enabled` +
  `skill_versions.label` → `pnpm -C server db:generate` (migration; never hand-edit).
- **rows.ts**: add `SkillRow`, `SkillVersionRow`.
- **Gate:** `pnpm -C server typecheck` + `pnpm -C client typecheck`; contract-drift
  (copies identical); migration generated + `_journal.json` bumped.
- **Commit:** `feat(skills): contracts + schema for skills CRUD, per-agent enable`

## Phase 1 — Server skills module (CRUD + versioning + usage + import)

**Goal:** the DB is the source of truth for skills; endpoints work.

- `modules/skills/{repository,service,routes,helpers,constants,import}.ts` (mirrors
  the `agents` triple).
- **repository:** workspace-scoped CRUD; version bump + snapshot on `body` change
  (mirror `isConfigChange`); `listVersions`; `usage` / `usageAll`.
- **import.ts:** md frontmatter (hand-rolled parser, no YAML dep); zip via **`fflate`**
  (new server dep) with `ignored_files`; **preview only — no DB write, no execution**.
- **service:** `toSkillDto`. **routes:** GET/POST/PUT/DELETE `/skills`,
  `/skills/:id/versions`, `/skills/:id/usage`, `/skills/usage`,
  `/skills/import/preview`.
- Register in `modules/index.ts`; add lazy `container.skillsRepo`.
- **Tests:** import-parser unit tests (frontmatter / fallback / zip with executable /
  malformed input); `*.it.test.ts` — CRUD + versioning bump + usage.
- **Commit:** `feat(skills): server CRUD module with versioning, usage, import preview`

## Phase 2 — Agent binding + inject into reviews

**Goal:** skills actually change a review (core of the control experiment).

- **AgentsRepository:** `setSkills(links)` (writes `enabled`); `linkedSkills`
  (+ `enabled`); new `enabledSkillBodies(agentId)` — filter `link.enabled AND
  skill.enabled`, `ORDER BY order`, return bodies.
- **AgentsService:** accept the `links` shape; `skillLinks` returns `enabled`.
- **run-executor:** load `enabledSkillBodies` → pass as `skills` to
  `reviewPullRequest`; `runLog.info("Injecting N enabled skill block(s)")`.
- **Tests:** run-executor (2 enabled + 1 disabled → 2 bodies in order; all disabled →
  no `skills`); `it.test` for `enabled` round-trip + `enabledSkillBodies` filter.
- **Commit:** `feat(skills): inject enabled skills into review prompt (two-level enable)`

## Phase 3 — Client Skills page (master-detail + tabs)

**Goal:** create / edit / preview / import skills in the UI.

- `lib/hooks/skills.ts` (list / one / create / update / delete / import-preview /
  versions / usage).
- `app/skills/page.tsx` + `[id]/page.tsx` + `SkillsView` (two-pane), `SkillsList`,
  `SkillCard` (`{n} agents` from usage; no `% pull / % accept`).
- `SkillDetail` with `Tabs`: **ConfigTab** (name/description/type + Markdown body
  editor: `${slug}.md` chip, unsaved badge, token estimate, Enabled toggle,
  `v{version}`), **PreviewTab** (vendored `Markdown`), **EvalsTab** (placeholder,
  deferred), **StatsTab** (USED BY + agents-using real; other cards "—"),
  **VersionsTab** (list + Diff + Restore).
- `CreateSkillModal`; `ImportSkillDrawer` (file `.md`/`.zip` → preview → trust notice
  → Save as `enabled:false`).
- **nav.ts:** add "Skills" item (SKILLS LAB section, `gKey:"s"`).
- **i18n:** fill gaps — `skills.tabs/config/stats/versions/create` + file-upload copy.
- **Tests (jsdom):** card toggle, Create submit, Import preview→save, Config
  dirty/version, Preview render, Versions + Restore, Stats usage.
- **Commit:** `feat(skills): Skills library page with tabbed detail, editor, import`

## Phase 4 — Agent editor Skills tab

**Goal:** bind / enable / reorder skills per agent.

- `AgentEditor`: add tab routing; `SkillsTab` (all workspace skills + checkbox +
  drag-reorder → `POST /agents/:id/skills` with the `links` form).
- `constants.ts TABS` + the `skills` tab.
- **Tests:** check / reorder persistence.
- **Commit:** `feat(agents): Skills tab — bind, enable, reorder per agent`

## Phase 5 — Seed (demo + control experiment)

**Goal:** everything reproduces out of the box.

- `seed-skills.ts` (bodies); `seed-prompts.ts` (+2 agent prompts).
- `seed.ts`: skills (one `source:'extracted'`) + `skill_versions` with `label` for
  `pr-quality-rubric` + two agents (**Test Quality Reviewer**, **API Contract
  Reviewer**) + `agent_skills` links + **two demo PRs** with `pr_files.patch`
  (reviewable offline).
- Idempotent (guard each insert by name/number).
- **Commit:** `feat(skills): seed demo agents, skills, versions, control-experiment PRs`

## Phase 6 — Validation + wrap-up (build step 5)

- `pnpm -C server db:migrate && db:seed`; run the studio; execute the §13
  verification scenarios: both agents — no skills → miss, with skills → flag; the
  run trace shows the Skills block + higher `tokens_in`; the Live Log shows
  "Injecting N…"; import goes through preview with nothing executed.
- Gates: typecheck (all packages), `arch`, vitest, contract-drift, migration, i18n.
- `/pr-self-review` manually (auto-invoke still disabled) → pulls **both** frontend
  and backend skills.
- `/engineering-insights` into the touched modules' `INSIGHTS.md`.

## Risks & guards

- **Contract drift** — vendor the two copies in the SAME commit as the canonical edit.
- **Schema without migration** — run `db:generate` in Phase 0 (the pr-self-review
  migration-drift gate blocks otherwise).
- **New dependency** — `fflate` added to `server` (pure-JS, zero native).
- **Demo PRs** — must populate `pr_files.patch` or `loadDiff` yields an empty diff.
