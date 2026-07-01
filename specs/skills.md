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
  `enabledCount`, `orderHint`) are largely pre-authored.
- **Nav routing**: `activeKeyFor` already maps `/skills` → `"skills"`.

**Net effect:** once run-executor passes an agent's enabled skill bodies to
`reviewPullRequest`, the block renders in the prompt AND in the trace with no
engine/trace-UI change. The rest is the CRUD module, import, the Skills page, the
agent Skills tab, the `enabled` link column, and the seed.

## 1. Data model & migration

Add a **per-agent enable** flag to the link table (decision 1, two-level enable):

```ts
// server/src/db/schema/agents.ts — agentSkills
enabled: boolean('enabled').notNull().default(true),
```

- Generate the migration with `pnpm -C server db:generate` (creates
  `migrations/NNNN_*.sql` + bumps `meta/_journal.json`). **Never hand-edit
  migrations.** Existing links backfill to `enabled = true` (no behaviour change
  for already-linked skills).
- `skills` / `skill_versions` are unchanged (already sufficient).
- This is a schema change → the pr-self-review migration-drift gate requires the
  generated migration in the same change set.

## 2. Shared contracts (`@devdigest/shared`, vendored ×2)

Edit the canonical contracts, then copy **byte-identically** to
`server/src/vendor/shared` **and** `client/src/vendor/shared`
(`contracts/knowledge.ts` + re-exports in `index.ts`). No auto-sync exists.

**New:**

```ts
const SkillWriteInput = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  type: SkillType,
  body: z.string().min(1),
  source: SkillSource.optional(),      // default 'manual'
  enabled: z.boolean().optional(),     // default true (manual); false for imports
});
export const CreateSkillInput = SkillWriteInput;
export const UpdateSkillInput = SkillWriteInput.partial();

export const SkillVersion = z.object({
  skill_id: z.string(),
  version: z.number().int(),
  body: z.string(),
  created_at: z.string(),
});

// Import preview — parsed skill DRAFT, never persisted by the preview call.
export const SkillImportPreview = z.object({
  name: z.string(),
  description: z.string(),
  type: SkillType,
  body: z.string(),
  source: SkillSource,                 // 'extracted'
  warnings: z.array(z.string()),       // human notes (e.g. "no frontmatter")
  ignored_files: z.array(z.string()),  // executable/non-text entries NOT processed
});
export const ImportSkillInput = z.object({
  filename: z.string().min(1),
  content_base64: z.string().min(1),   // .md or .zip, base64-encoded
});
```

**Changed** (extend, keep legacy forms working):

```ts
export const AgentSkillLink = z.object({
  agent_id: z.string(),
  skill_id: z.string(),
  order: z.number().int(),
  enabled: z.boolean(),                // NEW: per-agent enable
});

const AgentSkillLinkInput = z.object({
  skill_id: z.string().uuid(),
  order: z.number().int(),
  enabled: z.boolean().optional(),     // default true
});
export const SetAgentSkillsInput = z
  .object({
    links: z.array(AgentSkillLinkInput).optional(), // NEW authoritative full set
    skill_ids: z.array(z.string().uuid()).optional(), // legacy: order=index, enabled=true
    skill_id: z.string().uuid().optional(),           // legacy: link one
    order: z.number().int().optional(),
  })
  .refine((b) => b.links || b.skill_ids || b.skill_id, {
    message: 'Provide links, skill_ids, or skill_id',
    path: ['links'],
  });
```

Keeping `skill_ids` / `skill_id` preserves the current agents routes/tests; the
Skills tab uses the new `links` form.

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
| `DELETE /skills/:id` | `IdParams` | `{ ok: true }` (cascades link rows via FK) |
| `GET /skills/:id/versions` | `IdParams` | `SkillVersion[]` (newest first) |
| `POST /skills/import/preview` | `ImportSkillInput` | `SkillImportPreview` (NO DB write) |

**Repository** (`SkillsRepository`, owns `skills` + `skill_versions`):

- `list / getById / insert / deleteById` — workspace-scoped, mirror agents.
- `insert`: writes the skill AND version 1 into `skill_versions` (transaction),
  like `AgentsRepository.insert`.
- `update`: on a **body change** bump `version` and snapshot the new body into
  `skill_versions` (`onConflictDoNothing`); metadata-only edits (name/description/
  type/enabled) do not bump. Mirrors `isConfigChange` in agents (decision 4).
- `listVersions(skillId)` — newest first.
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
  in `ignored_files` and **not read or run**. `warnings` notes what was skipped.
- Malformed input (not a zip, no markdown inside, empty body) → `400` with a
  clear message; the client shows it in the drawer (`skills.drawer.importFailed`).
- **Save is a separate step**: after preview + confirm, the client calls
  `POST /skills` with the previewed fields and **`enabled: false`**
  (`source: 'extracted'`) — imported skills land **disabled until vetted**, per
  the pre-authored copy (`skills.url.success`, `listItem.needsVetting`).

Transport is JSON base64 (not multipart) to avoid adding `@fastify/multipart`;
the client reads the `File` via `FileReader.readAsDataURL` and strips the prefix.

## 5. Agent binding (Skills tab) — server

- `AgentsRepository.setSkills` gains an overload taking
  `links: { skillId; order; enabled }[]` and writes `enabled` (replace-all in a
  transaction, as today). The legacy `skillIds: string[]` path maps to
  `enabled: true, order: index`.
- `linkedSkills(agentId)` returns `{ skill, order, enabled }[]` (select the new
  column; still `ORDER BY order ASC`).
- New `enabledSkillBodies(agentId): Promise<string[]>` — join `agent_skills` ⋈
  `skills` where `agent_skills.enabled AND skills.enabled`, `ORDER BY order`,
  returning `skills.body`. This is the two-level filter (FR-4) and the ONLY thing
  the run-executor needs.
- `AgentsService.setSkills` accepts the `links` shape; `skillLinks` includes
  `enabled` in the returned `AgentSkillLink[]`.
- Routes: `POST /agents/:id/skills` already validates `SetAgentSkillsInput`; it
  now also accepts `links`. No new route.
- **Versioning interaction**: the agent version snapshot records ordered skill
  ids (`skillIdsForAgent`). Keep recording **enabled** links only in the snapshot
  (an agent version = what actually ran), so eval replays match. (Confirm in impl;
  a metadata-only detail.)

## 6. Run-executor wiring (makes skills affect reviews)

In `server/src/modules/reviews/run-executor.ts`, `runOneAgent`, before calling
`reviewPullRequest`:

```ts
const skillBodies = await this.agents.enabledSkillBodies(agent.id);
if (skillBodies.length > 0) {
  runLog.info(`Injecting ${skillBodies.length} enabled skill block(s) into the prompt`);
}
// …
const outcome = await reviewPullRequest({
  systemPrompt: agent.systemPrompt,
  model: agent.model,
  diff,
  llm,
  strategy: agent.strategy ?? REVIEW_STRATEGY,
  ...(skillBodies.length ? { skills: skillBodies } : {}),   // NEW
  ...(callersDigest ? { callers: callersDigest } : {}),
  // …unchanged…
});
```

- `this.agents` is the injected `AgentsRepository` (already available on the
  executor). No reviewer-core change.
- The explicit `runLog.info` gives acceptance #4 its **"separate block in the
  logs"**: enabled skills produce the line + the `## Skills / rules` block in
  `prompt_assembly.skills`; **zero enabled skills → `skills` omitted → the trace
  block is absent** (TraceBody guards on `!= null`).
- **Added tokens**: `tokens_in` rises when skills are injected — the run stats
  already surface it. A per-block token badge is out of scope (verify by comparing
  a with-skills vs without-skills run).

## 7. Client

Data access through `src/lib/hooks/*` over `src/lib/api.ts` (components never
fetch directly). Per-component folders with `index.ts` + `styles.ts`, mirroring
the agents feature.

### 7.1 Hook — `src/lib/hooks/skills.ts`

`useSkills`, `useSkill(id)`, `useCreateSkill`, `useUpdateSkill`,
`useDeleteSkill`, `useImportSkillPreview` (mutation → preview), and
`useSkillVersions(id)` — mirroring `hooks/agents.ts` (React Query, invalidate
`["skills"]`).

### 7.2 Skills page — `src/app/skills/`

- `page.tsx` → `SkillsListView` (mirror `AgentsListView`).
- **Grid of `SkillCard`s**: name, **type** badge, description, **enabled** toggle
  (`useUpdateSkill({ enabled })`). Reuse `skills.json` copy + `agents.card` layout.
- **Add** control (`Dropdown`, like agents): **Create** → `CreateSkillModal`;
  **Import** → `ImportSkillDrawer`.
- **Side preview** on card click: rendered body + metadata (name/type/source/
  version). Either a side panel or `/skills/:id` detail (copy exists under
  `skills.detail` and `skills.preview`). Chosen: a right-side preview panel on the
  list page (matches screenshot 1); `/skills/:id` deep-link optional.
- `CreateSkillModal` (mirror `CreateAgentModal`): fields **name, description,
  type, body(Markdown)**. Description helper text = *"the skill's interface —
  phrase it directively"* (FR-2). NO provider/model/schema fields.
- `ImportSkillDrawer`: file input (`.md`/`.zip`) → `useImportSkillPreview` →
  render the `SkillImportPreview` (name/type/body + `warnings` + `ignored_files`)
  with an explicit **trust notice** (`skills.preview.untrustedNotice`); **Save**
  → `useCreateSkill({ …preview, enabled: false })`. Nothing saved before Save.

### 7.3 Agent editor — Skills tab

- `AgentEditor` (`src/app/agents/[id]/_components/AgentEditor`) currently renders
  only `ConfigTab`. Add tab routing: on `tab === "skills"` render a new
  `SkillsTab`. Tab labels already exist (`agents.editor.tabs.skills`).
- `SkillsTab`: list **all** workspace skills (`useSkills`) with a **checkbox**
  (per-agent `enabled`) and a **drag handle** (order). Header
  `agents.skills.enabledCount` = "{linked} of {total} enabled";
  `agents.skills.orderHint` = "Order matters — earlier skills appear earlier…".
  Persist via `POST /agents/:id/skills` with the `links` array
  (`{ skill_id, order, enabled }`), seeded from `GET /agents/:id/skills`.
- Drag-reorder: a lightweight local reorder (index swap) is acceptable; no new
  dnd dependency required.

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

`en/skills.json` and `agents.skills.*` are largely pre-authored and reused as-is.
Gaps to add (keys only, `en` is the only locale):

- `skills.create.*` for `CreateSkillModal` (title/fields/…) if not covered by the
  existing `file`/`preview` copy.
- `skills.file.*` currently implies paste-a-body; extend copy for **file upload**
  (`.md`/`.zip`) + `ignored_files` note. Reuse `skills.preview.untrustedNotice`
  for the trust message.
- Any new `SkillsTab` strings beyond `agents.skills.*`.

The pr-self-review i18n gate flags a `t("…")` whose key is missing → keep keys in
sync in the same change set.

## 9. Seed (`server/src/db/seed.ts`, decision 3 — full demo)

Extend the idempotent seed (guard each insert by name/number, like today):

- **Skills** (workspace-scoped). At least: `pr-quality-rubric` (rubric),
  `secret-leakage-gate` (security), `lethal-trifecta` (security), plus the two
  experiment skills below. Mark **one** `source: 'extracted'` to represent the
  import path (the live import demo is done via UI in validation). Bodies live in
  a new `seed-skills.ts` (mirror `seed-prompts.ts`).
- **Two new agents** (add prompts to `seed-prompts.ts`):
  - **Test Quality Reviewer** — flags uncovered branches, missed corner cases,
    over-mocking, flaky tests.
  - **API Contract Reviewer** — flags breaking route-signature / contract changes.
- **Skills → agents** links (`agent_skills`, `enabled: true`, `order`):
  - Test Quality Reviewer ← a `test-quality-rubric` skill (the branch/edge/mocking
    rubric). Seed as `source: 'extracted'` to satisfy "≥1 via import".
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
  malformed input). `run-executor` test: agent with 2 enabled + 1 disabled skill →
  `reviewPullRequest` receives the 2 bodies in order; all-disabled → no `skills`.
- **server (`*.it.test.ts`, testcontainers)**: skills CRUD + versioning bump on
  body change; `agent_skills.enabled` round-trip; `enabledSkillBodies` two-level
  filter.
- **client (Vitest + jsdom)**: `SkillCard` toggle, `CreateSkillModal` submit,
  `ImportSkillDrawer` preview→save, `SkillsTab` check/reorder persistence.
- Gates: `pnpm -C server typecheck && run arch`, `pnpm -C client typecheck && test`.
  Contract copies must stay byte-identical (drift gate).

## 12. Out of scope

- Import from **URL** and **community catalog** (copy exists in `skills.json` but
  deferred; the drawer shows the **file** path only).
- Per-prompt-block token badges in the trace (only whole-run tokens shown).
- Cross-workspace skill sharing; skill-level eval/CI/stats tabs.
- Multi-locale i18n (only `en`).

## 13. Verification (control experiment)

1. `pnpm -C server db:migrate && db:seed`; open the studio.
2. **Skills page**: create a skill, edit its body → version bumps; import a `.md`
   (and a `.zip`) → preview shows the parsed skill + `ignored_files`, nothing saved
   until Save; saved import is `enabled: false`.
3. **Agent Skills tab**: on Test Quality Reviewer, all skills listed; enable the
   test-quality skill, reorder; save.
4. **Test Quality experiment**: run the happy-path-only PR with the skill
   **disabled** → reviewer misses the uncovered branch (pass). Enable → re-run →
   flags the uncovered branch + boundary case. Open the run trace → prompt
   assembly shows the **Skills** block; `tokens_in` higher than the no-skill run.
5. **API Contract experiment**: same with the route-signature PR and the
   api-contract skill.
6. **Logs**: the enabled run's Live Log shows "Injecting N enabled skill block(s)";
   the disabled run does not, and its trace has no Skills block.
7. **pr-self-review** (auto-invoke still disabled): run it manually over this
   change set → it pulls **both** frontend and backend skills; resolve any
   findings before pushing.

## 14. Open decisions (surface before implementation)

- **Nav in vendored UI** — adding the Skills item edits `vendor/ui/nav.ts` (the
  only copy; no re-sync path). Acceptable one-liner, or prefer wiring nav through
  `ShellContext` (larger vendored change)? Proposed: edit `nav.ts`.
- **Import source tag** — `.md`/`.zip` → `source: 'extracted'`; reserve
  `imported_url` for the deferred URL path. OK?
- **Preview surface** — side panel on the list page (screenshot 1) vs `/skills/:id`
  detail page. Proposed: side panel now, detail route optional.
