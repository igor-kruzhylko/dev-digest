# Skills — implementation plan

Ordered, phased build plan for the Skills feature. Requirements → `docs/skills.md`;
technical spec → `specs/skills.md`. Each phase is self-contained, independently
testable, and a commit boundary that leaves the tree green (typecheck + tests).
Dependency root is **Phase 0**; everything else builds on it.

Cumulatively ~6 commits. Product/design decisions are locked in
`specs/skills.md` (§14); remaining open questions are documented in §15 with
recommended simple defaults.

## Phase 0 — Contracts + schema (foundation)

**Goal:** every type and table the server and client depend on.

- **Shared contracts:** add `CreateSkillInput`, `UpdateSkillInput`
  (+ `version_label`), `SkillVersion` (+ `label`), `SkillImportPreview`,
  `ImportSkillInput`, `SkillUsage`. In the current checkout, edit
  `server/src/vendor/shared` and `client/src/vendor/shared` byte-identically
  unless a canonical shared source is introduced first.
- **No per-agent enabled field:** keep `AgentSkillLink` and
  `SetAgentSkillsInput` in their existing shape (`skill_ids` full-set form +
  `skill_id` single-link form). Link presence = active for that agent.
- **Schema** (`db/schema/skills.ts`): add `skill_versions.label` →
  `pnpm -C server db:generate` (migration; never hand-edit). Do **not** add
  `agent_skills.enabled`.
- **rows.ts**: add `SkillRow`, `SkillVersionRow`.
- **Gate:** `pnpm -C server typecheck` + `pnpm -C client typecheck`; contract-drift
  (copies identical); migration generated + `_journal.json` bumped.
- **Commit:** `feat(skills): contracts + version labels for skills CRUD`
## Phase 1 — Server skills module (CRUD + versioning + usage + import)

**Goal:** the DB is the source of truth for skills; endpoints work.

- `modules/skills/{repository,service,routes,helpers,constants,import}.ts` (mirrors
  the `agents` triple).
- **repository:** workspace-scoped CRUD; version bump + snapshot on `body` change
  (mirror `isConfigChange`); `listVersions`; `usage` / `usageAll`; delete
  guard returning `409 skill_in_use` while linked to agents.
- **import.ts:** md frontmatter (hand-rolled parser, no YAML dep); zip via **`fflate`**
  (new server dep) with `ignored_files`; conservative size limits; **preview
  only — no DB write, no execution**.
- **service:** `toSkillDto`. **routes:** GET/POST/PUT/DELETE `/skills`,
  `/skills/:id/versions`, `/skills/:id/usage`, `/skills/usage`,
  `/skills/import/preview`.
- Register in `modules/index.ts`; add lazy `container.skillsRepo`.
- **Tests:** import-parser unit tests (frontmatter / fallback / zip with executable /
  malformed/oversized input); `*.it.test.ts` — CRUD + versioning bump + usage +
  delete linked skill blocked.
- **Commit:** `feat(skills): server CRUD module with versioning, usage, import preview`

## Phase 2 — Agent binding + inject into reviews

**Goal:** skills actually change a review (core of the control experiment).

- **AgentsRepository:** keep `setSkills(skillIds)` as replace-all; keep
  `linkedSkills` returning `{ skill, order }`; add
  `promptSkillBodiesForAgent(agentId)` — filter linked skills by
  `skills.enabled`, `ORDER BY order`, return bodies.
- **AgentsService:** validate all submitted `skill_ids` are in the same workspace
  as the agent before writing links.
- **run-executor:** load `promptSkillBodiesForAgent` → pass as `skills` to
  `reviewPullRequest`; `runLog.info("Injecting N linked skill block(s)")`.
- **Tests:** run-executor (2 linked enabled + 1 linked globally disabled → 2
  bodies in order; no active linked skills → no `skills`); `it.test` for
  set/reorder round-trip, cross-workspace rejection, and global-enable filter.
- **Commit:** `feat(skills): inject linked enabled skills into review prompt`
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
- **Tests (jsdom):** card toggle, Create submit, Import preview→save, linked
  delete guard UX, Config dirty/version, Preview render, Versions + Restore,
  Stats usage.
- **Commit:** `feat(skills): Skills library page with tabbed detail, editor, import`

## Phase 4 — Agent editor Skills tab

**Goal:** bind / unlink / reorder skills per agent.

- `AgentEditor`: add tab routing; `SkillsTab` (all workspace skills + checkbox +
  drag-reorder for attached skills → `POST /agents/:id/skills` with the existing
  ordered `skill_ids` form).
- `constants.ts TABS` + the `skills` tab.
- **Tests:** check / uncheck / reorder persistence.
- **Commit:** `feat(agents): Skills tab — bind and reorder agent skills`
## Phase 5 — Seed (demo + control experiment)

**Goal:** everything reproduces out of the box.

- `seed-skills.ts` (bodies); `seed-prompts.ts` (+2 agent prompts).
- `seed.ts`: skills (one `source:'extracted'` to represent imported origin) +
  `skill_versions` with `label` for `pr-quality-rubric` + two agents (**Test
  Quality Reviewer**, **API Contract Reviewer**) + ordered `agent_skills` links +
  **two demo PRs** with `pr_files.patch` (reviewable offline).
- Idempotent (guard each insert by name/number).
- **Commit:** `feat(skills): seed demo agents, skills, versions, control-experiment PRs`

## Phase 6 — Validation + wrap-up (build step 5)

- `pnpm -C server db:migrate && db:seed`; run the studio; execute the §13
  verification scenarios: both agents — no active linked skills → miss, with
  linked globally enabled skills → flag; the run trace shows the Skills block +
  higher `tokens_in`; the Live Log shows "Injecting N…"; import goes through
  preview with nothing executed; linked skill delete is blocked until unlinked.
- Gates: typecheck (all packages), `arch`, vitest, contract-drift, migration, i18n.
- `/pr-self-review` manually (auto-invoke still disabled) → pulls **both** frontend
  and backend skills.
- `/engineering-insights` into the touched modules' `INSIGHTS.md`.

## Risks & guards

- **Contract drift** — vendor the two copies in the SAME commit as the canonical edit.
- **Schema without migration** — run `db:generate` in Phase 0 for
  `skill_versions.label` (the pr-self-review migration-drift gate blocks
  otherwise).
- **New dependency** — `fflate` added to `server` (pure-JS, zero native).
- **Delete semantics** — block linked skill deletes in service code; do not rely on
  FK cascade as user-visible behaviour.
- **Demo PRs** — must populate `pr_files.patch` or `loadDiff` yields an empty diff.
- **Live LLM variability** — demo runs may vary; deterministic coverage belongs in
  mock-LLM tests, not a brittle live-model gate.


