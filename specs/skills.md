# Skills — spec

Implementation of the Skills feature described in `docs/skills.md`. Skills are
reusable, **text-only** review rules (name, description, type, Markdown body)
authored once and bound to many agents, injected as the `## Skills / rules`
prompt block. Most of the substrate already exists; this spec covers the CRUD
module, the import flow, the run-executor wiring that makes skills actually
affect a review, the Agent-editor Skills tab, and the demo seed.

## What already exists (reused, do not rebuild)

- **DB**: `skills`, `skill_versions`, `agent_skills` tables
  (`server/src/db/schema/skills.ts`, `…/agents.ts`).
- **Contracts**: `Skill`, `SkillType` (`rubric|convention|security|custom`),
  `SkillSource` (`manual|imported_url|extracted|community`), `AgentSkillLink`,
  `SetAgentSkillsInput` (`server/src/vendor/shared/contracts/knowledge.ts`).
- **Agent link plumbing**: `AgentsRepository.setSkills / linkSkill / unlinkSkill /
  linkedSkills / skillIdsForAgent`; routes `GET/POST /agents/:id/skills`; version
  snapshots already record ordered skill ids.
- **Engine**: `assemblePrompt` renders `## Skills / rules` from `skills: string[]`
  and records it in `prompt_assembly.skills`; `reviewPullRequest` accepts
  `skills?: string[]` (`reviewer-core`).
- **Trace UI**: `TraceBody` already renders `prompt_assembly.skills` as its own
  `PromptBlock` when non-null (`…/RunTraceDrawer/_components/TraceBody`).
- **i18n**: `client/messages/en/skills.json` and `agents.skills.*` (incl.
  `enabledCount`, `orderHint`, `page.selectPrompt`, `detail`, `preview`) are
  largely pre-authored for the master-detail design.
- **Markdown render**: vendored `Markdown` primitive (`@devdigest/ui`,
  `react-markdown` + `remark-gfm` already deps) powers the Preview tab.
- **Nav routing**: `activeKeyFor` already maps `/skills` → `"skills"`.

**Net effect:** once run-executor passes an agent's enabled skill bodies to
`reviewPullRequest`, the block renders in the prompt AND in the trace with no
engine/trace-UI change. The rest is the CRUD module, import, the Skills page, the
agent Skills tab, delete protection for linked skills, and the seed.

## 1. Data model & migration

Keep `agent_skills` simple: **do not add a per-agent enable flag**. Link
presence means "this agent uses this skill"; absence means "not used". The
existing `order` column is meaningful only for linked skills.

Add an optional **version label** to the snapshot table (the Versions tab shows a
human label per version, e.g. "Added Tests dimension"):

```ts
// server/src/db/schema/skills.ts — skillVersions
label: text('label'),   // nullable; "what changed" note shown in the Versions tab
```

- Generate the migration with `pnpm -C server db:generate` (creates
  `migrations/NNNN_*.sql` + bumps `meta/_journal.json`). **Never hand-edit
  migrations.** Existing `skill_versions` rows get `label = null` (no behaviour
  change).
- No `agent_skills.enabled` migration is needed.
- Deleting a skill is a service-level operation: `skills`/`skill_versions` may
  cascade when the skill is unused, but `DELETE /skills/:id` must return `409`
  while any `agent_skills` links exist.
- This is still a schema change because of `skill_versions.label`; the
  pr-self-review migration-drift gate requires the generated migration in the
  same change set.
## 2. Shared contracts (`@devdigest/shared`, vendored ×2)

In this checkout there is no standalone canonical `shared/contracts/knowledge.ts`
file. Edit the two vendored copies **byte-identically**:
`server/src/vendor/shared/contracts/knowledge.ts` and
`client/src/vendor/shared/contracts/knowledge.ts` (plus each `index.ts` if a new
contract file/export is introduced). If a canonical shared source is restored
later, edit it first and re-sync the vendors.

**New:**

```ts
const SkillWriteInput = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  type: SkillType,
  body: z.string().min(1).max(80_000),
  source: SkillSource.optional(),       // default 'manual'
  enabled: z.boolean().optional(),      // default true (manual); false for imports
  version_label: z.string().max(160).optional(),
});
export const CreateSkillInput = SkillWriteInput;
export const UpdateSkillInput = SkillWriteInput.partial();

export const SkillVersion = z.object({
  skill_id: z.string(),
  version: z.number().int(),
  body: z.string(),
  label: z.string().nullish(),
  created_at: z.string(),
});

export const SkillUsage = z.object({
  skill_id: z.string(),
  agent_count: z.number().int(),
  agents: z.array(z.object({ id: z.string(), name: z.string() })),
});

export const SkillImportPreview = z.object({
  name: z.string(),
  description: z.string(),
  type: SkillType,
  body: z.string(),
  source: SkillSource,                  // 'extracted'
  warnings: z.array(z.string()),
  ignored_files: z.array(z.string()),
});

export const ImportSkillInput = z.object({
  filename: z.string().min(1).max(260),
  content_base64: z.string().min(1),    // size checked after decode
});
```

**Unchanged for agent binding:**

- `AgentSkillLink` remains `{ agent_id, skill_id, order }`.
- `SetAgentSkillsInput` keeps the existing `skill_ids` full-set form and
  `skill_id` single-link form. The Agent Skills tab uses `skill_ids` in desired
  order; checked = included in `skill_ids`, unchecked = omitted.
## 3. Server — skills module

New Fastify module `server/src/modules/skills/` (mirrors the `agents` triple):
`routes.ts → service.ts → repository.ts` (+ `helpers.ts`, `constants.ts`).
Register in `server/src/modules/index.ts` (`skills` key). Workspace-scoped via
`getContext`, like agents.

**Endpoints:**

| Method & path | Body / params | Returns |
|---|---|---|
| `GET /skills` | — | `Skill[]` (workspace) |
| `GET /skills/:id` | `IdParams` | `Skill` (404 if absent) |
| `POST /skills` | `CreateSkillInput` | `201 Skill` |
| `PUT /skills/:id` | `IdParams`, `UpdateSkillInput` | `Skill` (bumps version + snapshots on body change) |
| `DELETE /skills/:id` | `IdParams` | `{ ok: true }` when unused; `409 skill_in_use` with usage details when linked |
| `GET /skills/:id/versions` | `IdParams` | `SkillVersion[]` (newest first) |
| `GET /skills/:id/usage` | `IdParams` | `SkillUsage` (agents linking this skill) |
| `GET /skills/usage` | — | `SkillUsage[]` (all skills; powers the list cards) |
| `POST /skills/import/preview` | `ImportSkillInput` | `SkillImportPreview` (NO DB write) |

**Restore** (Versions tab) needs no new endpoint: it re-`PUT`s the chosen
version's `body` (with a `version_label` like "Restored v3"), which bumps the
version and snapshots — history stays append-only.

**Repository** (`SkillsRepository`, owns `skills` + `skill_versions`):

- `list / getById / insert / deleteById` — workspace-scoped, mirror agents.
- `insert`: writes the skill AND version 1 into `skill_versions` (transaction),
  like `AgentsRepository.insert`.
- `update`: on a **body change** bump `version` and snapshot the new body into
  `skill_versions` (`onConflictDoNothing`); metadata-only edits (name/description/
  type/enabled) do not bump. Mirrors `isConfigChange` in agents (decision 4).
- `listVersions(skillId)` — newest first (includes `label`).
- `usage(skillId)` / `usageAll()` — join `agent_skills` ⋈ `agents` (workspace).
  `usage(skillId)` returns the full agent id/name list for the Stats tab;
  `usageAll()` may return **counts only** (the cards need just "{n} agents"),
  keeping the list payload light.
- `deleteById(workspaceId, skillId)` checks usage first. If linked, throw an
  `AppError('skill_in_use', ..., 409, { agents })`; otherwise delete the skill
  and allow `skill_versions` to cascade.
- Row type `SkillRow = typeof t.skills.$inferSelect` re-exported from
  `server/src/db/rows.ts` (add it there, next to `AgentRow`).

**Service** maps rows → `Skill` DTO (`toSkillDto`), snake_case contract fields.

**Container**: add a lazy `skillsRepo` getter mirroring `agentsRepo`
(`server/src/platform/container.ts`) so cross-module consumers don't reach into
the folder.

## 4. Import (Markdown + zip, preview-only)

`POST /skills/import/preview` decodes `content_base64`, detects type by extension
(`.md` / `.markdown` vs `.zip`) and returns a `SkillImportPreview`. **It never
writes to the DB and never executes anything.** Lives in
`modules/skills/import.ts`.

- **Markdown**: parse optional YAML-ish frontmatter — a `---`-fenced block of
  `key: value` lines (`name`, `description`, `type`) parsed by a **minimal
  hand-rolled reader** (no new YAML dep). Body = content after the frontmatter.
  Fallbacks: `name` ← first `# heading`; `description` ← first non-empty
  paragraph; `type` ← `custom`. `source = 'extracted'`.
- **Zip**: unzip in memory with **`fflate`** (pure-JS, zero native deps; new
  server dependency). Read `SKILL.md` (or the first root-level `*.md`) and parse
  as above. Every **non-Markdown** entry (scripts, binaries, resources) is listed
  in `ignored_files` and **not run**. Do not parse or inspect non-Markdown
  payload contents beyond archive metadata needed to list the ignored path.
- Apply conservative import limits in `constants.ts` (recommended defaults:
  1 MiB markdown body, 5 MiB base64 request, 10 MiB inflated zip content, 100 zip
  entries). Oversized input returns `400`.
- Malformed input (not a zip, no markdown inside, empty body) → `400` with a
  clear message; the client shows it in the drawer (`skills.drawer.importFailed`).
- **Save is a separate step**: after preview + confirm, the client calls
  `POST /skills` with the previewed fields and **`enabled: false`**
  (`source: 'extracted'`) — imported skills land **disabled until vetted**
  (`listItem.needsVetting`; add a file-import equivalent of `skills.url.success`,
  which is URL-specific copy). Note: this "imported ⇒ disabled" rule is for the
  **live import path only** — the demo **seed** enables its skills explicitly (§9).

Transport is JSON base64 (not multipart) to avoid adding `@fastify/multipart`;
the client reads the `File` via `FileReader.readAsDataURL` and strips the prefix.

## 5. Agent binding (Skills tab) — server

- `AgentsRepository.setSkills(agentId, skillIds)` remains the authoritative
  replace-all operation. It deletes existing links and inserts `skillIds` with
  `order = index`.
- `linkedSkills(agentId)` remains `{ skill, order }[]`, ordered by
  `agent_skills.order`.
- New `promptSkillBodiesForAgent(agentId): Promise<string[]>` — join
  `agent_skills` ⋈ `skills` where `skills.enabled = true`, `ORDER BY order`,
  returning `skills.body`. This is the global-enable + link-presence filter and
  the only thing the run-executor needs.
- `AgentsService.setSkills(workspaceId, agentId, skillIds)` must verify:
  1. the agent belongs to the workspace;
  2. every submitted skill id belongs to the same workspace.
  Reject cross-workspace or missing skills before writing links.
- Routes: `POST /agents/:id/skills` already validates `SetAgentSkillsInput`; the
  Skills tab uses the existing `skill_ids` full-set form. No new route and no new
  `links` shape.
- Versioning interaction: the current `agent_versions.config.skills` snapshot
  records ordered linked skill ids. For this iteration, past run reproducibility
  is guaranteed by persisted `run_traces.prompt_assembly.skills`; exact future
  replay of old agent versions after skill edits is an open question (§15).
## 6. Run-executor wiring (makes skills affect reviews)

In `server/src/modules/reviews/run-executor.ts`, `runOneAgent`, before calling
`reviewPullRequest`:

```ts
const skillBodies = await this.agents.promptSkillBodiesForAgent(agent.id);
if (skillBodies.length > 0) {
  runLog.info(`Injecting ${skillBodies.length} linked skill block(s) into the prompt`);
}
// …
const outcome = await reviewPullRequest({
  systemPrompt: agent.systemPrompt,
  model: agent.model,
  diff,
  llm,
  strategy: agent.strategy ?? REVIEW_STRATEGY,
  ...(skillBodies.length ? { skills: skillBodies } : {}),
  ...(callersDigest ? { callers: callersDigest } : {}),
  // …unchanged…
});
```

- `this.agents` is the injected `AgentsRepository` (already available on the
  executor). No reviewer-core change.
- Enabled globally + linked skills produce the log line and the `## Skills /
  rules` block in `prompt_assembly.skills`; zero active linked skills → `skills`
  omitted → the trace block is absent (`TraceBody` guards on `!= null`).
- Added tokens are represented by higher whole-run `tokens_in`. Per-block token
  attribution is out of scope.
## 7. Client

Data access through `src/lib/hooks/*` over `src/lib/api.ts` (components never
fetch directly). Per-component folders with `index.ts` + `styles.ts`, mirroring
the agents feature.

### 7.1 Hook — `src/lib/hooks/skills.ts`

`useSkills`, `useSkill(id)`, `useCreateSkill`, `useUpdateSkill`,
`useDeleteSkill`, `useImportSkillPreview` (mutation → preview),
`useSkillVersions(id)`, `useSkillUsage(id)` and `useSkillsUsage()` — mirroring
`hooks/agents.ts` (React Query; invalidate `["skills"]` + `["skill", id]`).

### 7.2 Skills page — master-detail (`src/app/skills/`)

A **two-pane** view (screenshots): a persistent **left list** + a **right detail
pane** with tabs. Routes: `/skills` (list + "Select a skill" empty state —
`skills.page.selectPrompt`) and `/skills/[id]` (list + selected skill detail).
Both render a shared `SkillsView`; the `[id]` route selects the detail.

**Left list** (`SkillsList` + `SkillCard`):

- Header: title, search (`skills.page.searchPlaceholder`), **Add Skill** dropdown
  (`skills.page.addSkill`) → **Create** (`CreateSkillModal`) / **Import**
  (`ImportSkillDrawer`).
- `SkillCard`: icon, name (mono), **enabled** toggle (`useUpdateSkill({enabled})`),
  description, **type** badge, **source** label (`skills.listItem.source.*`), and a
  stats line **"{n} agents"** from `useSkillsUsage()` (real). The mockup's
  `% pull / % accept` are analytics with no data source → **omitted** in the real
  build (dropped per §14). Selecting a card routes to `/skills/:id`.
- **Delete** (from the card or the detail header) → `useDeleteSkill`; a
  `409 skill_in_use` response is surfaced with the linking agents, prompting the
  user to unlink the skill from those agents first (FR-8).

**Right detail** (`SkillDetail`) — header shows name + **type** badge + **version**
badge (`v{version}`) + a **Run on evals** button (part of the deferred Evals
surface — rendered disabled/placeholder). Tabs mirror the Agent editor
(`Tabs` from `@devdigest/ui`, tab state in `?tab=`):

- **Config** — `name` (required), `description` (helper: *"the skill's interface —
  phrase it directively"*, FR-2), `type` select, **Skill body** Markdown editor.
  The body editor shows a filename chip `${slug(name)}.md`, an **unsaved** badge
  when dirty, a **token estimate** (`~ceil(chars/4)`), and an **Enabled** toggle +
  `v{version}` badge (top-right). Save → `useUpdateSkill` (body change bumps
  version). NO provider/model/schema fields (skills are text + config).
- **Preview** — renders the body via the vendored **`Markdown`** primitive
  (`@devdigest/ui`, `react-markdown` + `remark-gfm` already deps). Caption:
  `skills.page` / `"Rendered as the reviewing agent receives it."`
- **Evals** — **deferred** (user: skip for now). The tab exists in the design;
  render a placeholder like the not-yet-built agent tabs. No functionality.
- **Stats** — `useSkillUsage(id)`: **USED BY** = `agent_count` and **AGENTS USING
  THIS SKILL** = the `agents` list (each links to `/agents/:id`) are **real**. The
  other cards (pull frequency, accept rate, findings 30d, findings-by-category,
  cost) have **no data source** (no skill→finding attribution; agent Stats are
  likewise an unbuilt "A5 mount") → rendered as **"—" / "not tracked yet"**,
  **no fabricated numbers** (decision, §14). The layout matches the mockup but the
  unavailable cards are honestly empty.
- **Versions** — `useSkillVersions(id)`: list newest-first with `v{n}`, `label`,
  date; the current version tagged. **Restore** → `useUpdateSkill({ body,
  version_label: "Restored v{n}" })`. **Diff** → a minimal client-side line diff of
  two version bodies (no new dep). Caption: *"Every save snapshots the body so eval
  runs stay reproducible against the exact text they scored."*

**Modals/drawers:**

- `CreateSkillModal` (mirror `CreateAgentModal`): **name, description, type,
  body(Markdown)**; on save → route to `/skills/:id?tab=config`.
- `ImportSkillDrawer`: file input (`.md`/`.zip`) → `useImportSkillPreview` →
  render the `SkillImportPreview` (name/type/body + `warnings` + `ignored_files`)
  with an explicit **trust notice** (`skills.preview.untrustedNotice`); **Save** →
  `useCreateSkill({ …preview, enabled: false })`. Nothing saved before Save.

### 7.3 Agent editor — Skills tab

- `AgentEditor` (`src/app/agents/[id]/_components/AgentEditor`) currently renders
  only `ConfigTab`. Add tab routing: on `tab === "skills"` render a new
  `SkillsTab`. Tab labels already exist (`agents.editor.tabs.skills`).
- `SkillsTab`: list **all** workspace skills (`useSkills`) with a **checkbox**
  (attached to this agent) and a **drag handle** for attached skills. Header can
  reuse `agents.skills.enabledCount` as "{linked} of {total} linked" unless the
  copy is renamed; `agents.skills.orderHint` = "Order matters — earlier skills
  appear earlier…". Persist via `POST /agents/:id/skills` with the existing
  `skill_ids` array in desired order, seeded from `GET /agents/:id/skills`.
- Reorder: **no new dnd dependency** — implement as up/down controls or a simple
  pointer drag on the handle, then persist the resulting `skill_ids` order. (The
  mockup shows drag handles; either affordance is acceptable.)

### 7.4 Navigation

Sidebar `NAV` is static in `client/src/vendor/ui/nav.ts` (no per-app injection via
`ShellContext`). Add a **"SKILLS LAB"** section (matches the existing "Skills Lab"
breadcrumb) with a **Skills** item before **Agents**:

```ts
{ key: "skills", label: "Skills", icon: "Sparkles", href: "/skills", gKey: "s" }
```

`nav.ts` is UI-vendored and has **no canonical/​re-sync path** (unlike shared
contracts), so this one-line config addition is edited in place. Flagged as a
decision below.

## 8. i18n

`en/skills.json` and `agents.skills.*` are largely pre-authored and reused as-is
(`page.selectPrompt`, `detail`, `preview`, `listItem`, `drawer`). Gaps to add
(keys only, `en` is the only locale):

- `skills.create.*` for `CreateSkillModal` (title/fields/…) if not covered by the
  existing `file`/`preview` copy.
- `skills.file.*` currently implies paste-a-body; extend copy for **file upload**
  (`.md`/`.zip`) + `ignored_files` note. Reuse `skills.preview.untrustedNotice`
  for the trust message.
- **Detail tabs**: `skills.tabs.*` (config/preview/evals/stats/versions),
  `skills.config.*` (body/tokens/unsaved), `skills.stats.*` (usedBy, agentsUsing,
  and the deferred metric labels), `skills.versions.*` (title, current, diff,
  restore, snapshotNote), and the **Run on evals** button label.
- Any new `SkillsTab` strings beyond `agents.skills.*`.

The pr-self-review i18n gate flags a `t("…")` whose key is missing → keep keys in
sync in the same change set.

## 9. Seed (`server/src/db/seed.ts`, decision 3 — full demo)

Extend the idempotent seed (guard each insert by name/number, like today):

- **Skills** (workspace-scoped). At least: `pr-quality-rubric` (rubric),
  `secret-leakage-gate` (security), `lethal-trifecta` (security), plus the two
  experiment skills below. Mark **one** `source: 'extracted'` to represent the
  import path (the live import demo is done via UI in validation). **All seeded
  skills are `enabled: true`** — the "imported ⇒ disabled" rule (§4) is for the
  live UI import only, so the control experiment works right after `db:seed`.
  Bodies live in a new `seed-skills.ts` (mirror `seed-prompts.ts`).
- **Version history** — seed a few `skill_versions` rows (with `label`s) for
  `pr-quality-rubric` so the Versions tab is populated in the demo (matches the
  "5 versions" mockup). Set the skill's `version` to the latest.
- **Two new agents** (add prompts to `seed-prompts.ts`):
  - **Test Quality Reviewer** — flags uncovered branches, missed corner cases,
    over-mocking, flaky tests.
  - **API Contract Reviewer** — flags breaking route-signature / contract changes.
- **Skills → agents** links (`agent_skills`, ordered by `order`) — so the seeded
  default is *with skills* (each experiment skill is linked **and** globally
  enabled); the demo disables/unlinks to show the miss:
  - Test Quality Reviewer ← a `test-quality-rubric` skill (the branch/edge/mocking
    rubric). Seed as `source: 'extracted'` to represent imported origin; the live
    preview→save import path is still validated through UI/API.
  - API Contract Reviewer ← an `api-contract-gate` skill (breaking-change rules).
- **Two demo PRs** (reviewable **offline**: populate `pr_files.patch` with the
  unified-diff hunk so `loadDiff` reconstructs the diff without a clone —
  `diff-loader.ts`):
  - **PR: happy-path-only test** — a diff adding a function with a branch plus a
    test that exercises only the happy path. With the test-quality skill enabled,
    the reviewer flags the uncovered branch + a boundary case; disabled → pass.
  - **PR: route signature change** — a diff changing a route's params/return.
    With the api-contract skill enabled → breaking-change finding; disabled → pass.

## 10. Trust model (enforcement specifics)

- Import is **preview → confirm**; `POST /skills/import/preview` performs **no
  persistence**. Only the subsequent `POST /skills` writes.
- **No archive content is executed**; `fflate` only inflates bytes in memory; only
  `*.md` entries are read; everything else is listed in `ignored_files`.
- Imported skills default `enabled: false` (needs vetting) and carry
  `source: 'extracted'`; the UI shows the untrusted/vetting notice.
- Skill bodies, once saved, are **authored instructions** (trusted-ish) and are
  injected as the `## Skills / rules` block — NOT delimiter-wrapped like the diff.
  The trust gate is the **human preview-and-confirm**, not runtime sandboxing.
  (The engine's injection guard still hardens the untrusted diff/PR-body path.)

## 11. Testing

- **reviewer-core**: unchanged; existing `assemblePrompt` skills-block tests cover
  rendering. Add one asserting order preservation if not present.
- **server (hermetic)**: `SkillsRepository`/service via mocked container; import
  parser unit tests (md frontmatter, md fallback, zip with ignored executables,
  malformed/oversized input). `run-executor` test: agent with 2 linked globally
  enabled skills + 1 globally disabled linked skill → `reviewPullRequest`
  receives the 2 bodies in order; no active linked skills → no `skills`.
- **server (`*.it.test.ts`, testcontainers)**: skills CRUD + versioning bump on
  body change; `agent_skills` set/reorder round-trip; cross-workspace skill ids
  rejected when setting agent skills; `promptSkillBodiesForAgent` global-enable
  filter; delete linked skill returns `409 skill_in_use`; delete unlinked skill
  succeeds.
- **client (Vitest + jsdom)**: `SkillCard` toggle, `CreateSkillModal` submit,
  `ImportSkillDrawer` preview→save, `SkillsTab` check/uncheck/reorder
  persistence via `skill_ids`, the detail **Config** dirty/version behaviour,
  **Preview** Markdown render, **Versions** list + Restore, **Stats** usage render.
- Gates: `pnpm -C server typecheck && run arch`, `pnpm -C client typecheck && test`.
  Contract copies must stay byte-identical (drift gate).
## 12. Out of scope

- Import from **URL** and **community catalog** (copy exists in `skills.json` but
  deferred; the drawer shows the **file** path only).
- The **Evals** tab and **Run on evals** action (user: skip for now) — the tab is
  rendered as a placeholder, like the not-yet-built agent tabs; no eval pipeline.
- **Stats analytics** beyond usage: pull frequency, accept rate, findings-by-
  category, and cost have **no data source** (findings aren't attributed to skills)
  → shown as **"—" / not tracked yet**, no fabricated numbers (§14). Only USED BY /
  agents-using are real.
- Per-prompt-block token badges in the trace (only whole-run tokens shown).
- Cross-workspace skill sharing.
- Multi-locale i18n (only `en`).

## 13. Verification (control experiment)

1. `pnpm -C server db:migrate && db:seed`; open the studio.
2. **Skills page** (master-detail): create a skill, edit its body in the
   **Config** tab → version bumps (unsaved indicator clears); **Preview** tab
   renders the Markdown; **Versions** tab lists the snapshots (Diff/Restore
   work); import a `.md` (and a `.zip`) → preview shows the parsed skill +
   `ignored_files`, nothing saved until Save; saved import is `enabled: false`.
   **Stats** tab shows USED BY + agents-using (real).
3. **Agent Skills tab**: on Test Quality Reviewer, all workspace skills are listed;
   the seeded `test-quality-rubric` is already attached (checked) and ordered.
4. **Test Quality experiment**: run the happy-path-only PR **as seeded** (skill
   linked + globally enabled) → the reviewer **flags** the uncovered branch + a
   boundary case. Open the run trace → prompt assembly shows the **Skills** block;
   `tokens_in` higher than the no-skill run. Then **disable** the skill (global
   toggle off, or uncheck it on the agent) → re-run → the reviewer **misses** it
   (the control). Re-enable to restore.
5. **API Contract experiment**: same with the route-signature PR and the
   api-contract skill — seeded on → flags the breaking change; disabled → misses.
6. **Logs**: the with-skills run's Live Log shows "Injecting N linked skill
   block(s)"; the disabled run does not, and its trace has no Skills block.
7. **Delete guard**: try deleting a skill linked to an agent → API/UI blocks with
   usage; unlink it from all agents → delete succeeds.
8. **pr-self-review** (auto-invoke still disabled): run it manually over this
   change set → it pulls **both** frontend and backend skills; resolve any
   findings before pushing.
## 14. Resolved decisions

- **Nav in vendored UI** — RESOLVED (approved): edit `vendor/ui/nav.ts` in place to
  add the Skills item (the only copy; no re-sync path) rather than wiring nav
  through `ShellContext`.
- **Import source tag** — RESOLVED (approved): `.md`/`.zip` → `source: 'extracted'`;
  `imported_url` reserved for the deferred URL path.
- **Preview / detail surface** — RESOLVED: a **detail page `/skills/:id`** with
  tabs (Config / Preview / Evals / Stats / Versions), master-detail with the
  persistent left list — as the screenshots show. This supersedes the earlier
  "side panel now, detail route optional" wording in the product draft.
- **Stats analytics data** — RESOLVED: render **USED BY + agents-using** from real
  `agent_skills` data; show **"—" / "not tracked yet"** for pull frequency, accept
  rate, findings-by-category and cost. **No fabricated numbers** — the layout
  matches the mockup, the unavailable cards are honestly empty (real attribution
  is a future lesson). Also drop `% pull / % accept` from the list cards.
- **Per-agent skill state** — RESOLVED: no `agent_skills.enabled`. Link presence
  means active for that agent; unchecking removes the link. Global
  `skills.enabled` remains the library-level kill switch.
- **Delete semantics** — RESOLVED: deleting a linked skill is blocked with `409`
  and usage details. Unlinked skills can be deleted; their versions cascade.

## 15. Open questions and recommendations

1. **Exact replay of old agent versions after skill edits.**
   Recommendation: keep v1 simple. Persisted run traces already capture the exact
   injected Skills block for completed runs. Do not add skill-version references
   to `agent_versions` until eval replay requires it.

2. **Control experiment determinism with live LLMs.**
   Recommendation: treat the seeded PRs as a demo validation, not a CI gate. Cover
   deterministic behaviour with mock-LLM tests that assert skills are passed to
   `reviewPullRequest` in order and omitted when not active.

3. **Canonical shared contracts source.**
   Recommendation: for this task, edit the two vendored copies byte-identically
   because that is the current checkout reality. Separately decide whether to
   introduce a real canonical `shared/` source later.

4. **Import limits exact values.**
   Recommendation: use the conservative constants in §4 for the first version and
   tune only if real skill packages exceed them.
