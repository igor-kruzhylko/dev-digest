# Skills — product requirements

Business- and user-level requirements for **Skills**: reusable, text-only review
instructions that are authored once and shared across agents. A skill is a named
block of Markdown (plus light metadata) that gets injected into an agent's review
prompt. This document is stage 1 of a staged build (requirements → specs → plan →
implementation → validation). Implementation detail lives in the specs
(`specs/skills.md`, written next).

## Background & problem

DevDigest reviews PRs with configurable **agents** — each agent is a provider +
model + system prompt + output schema. The Agent editor already exists, and the
data model already anticipates skills: the `skills`, `skill_versions`, and
`agent_skills` tables exist, the shared `Skill` contract is defined, the agents
module can already link/reorder skills, and the review engine
(`reviewer-core`, `assemblePrompt`) already renders a `## Skills / rules` block
into the prompt and records it in the run trace's prompt assembly.

What is **missing** is the product itself:

- there is **no way for a user to create, edit, list, or import a skill** (no
  Skills page, no skills CRUD on the server);
- linked skills are **never actually loaded into a review** — the run executor
  does not pass an agent's skills to the engine, so today skills have **zero
  effect** on a review;
- the Agent editor has **no Skills tab** to attach, unlink, and order skills.

The core value is **reuse and separation of concerns**: the same review rule
(e.g. "flag breaking API-contract changes") is written once as a skill and
attached to many agents, instead of being copy-pasted into each agent's system
prompt. A skill is **pure text + configuration** — it never carries a model,
provider, output schema, or any executable behaviour of its own.

## Goals

- Let a user **author skills** (name, description, type, Markdown body) in the UI
  and reuse them across multiple agents.
- Give skills their own **library page**: a two-pane master-detail view with a
  left list of cards (name, type, description, enabled toggle) and a right detail
  pane with Config / Preview / Stats / Versions tabs. The **Add** action offers
  Create / Import.
- Let a user **bind skills to an agent** from a Skills tab in the Agent editor:
  attach/unlink and reorder. **Order defines the sequence of skill bodies in the
  prompt's Skills section.**
- **Actually inject** each agent's globally-enabled, linked skills into its review
  prompt, so skills change review behaviour — and make the injected **Skills section**
  visible in the run trace (prompt-assembly section). Whole-run `tokens_in`
  should increase when skills are injected; per-section token attribution is out
  of scope for this iteration.
- Support **import** of a skill from a Markdown file or an archive, with a
  **preview-before-save** step and an explicit **trust** message; **executable
  parts of an archive are never run**.
- **Version** a skill on edit (snapshot into `skill_versions`), mirroring how
  agents are versioned, so history is preserved.
- Ship a **reproducible control experiment** (seed data) that demonstrates skills
  changing a review's outcome on two new agents.

## Non-goals (out of scope for this iteration)

- Skills do **not** get a provider, model, output schema, review strategy, CI
  gate, or repo-intel toggle — those belong to agents only. A skill is text +
  metadata.
- **No execution** of anything shipped inside an imported archive (scripts,
  binaries, resources): the product extracts the skill's text core only.
- No community marketplace / remote skill registry browsing (the `community`
  source and `CommunitySkill` contract already exist in the schema but are not
  part of this build).
- No functional eval/CI tabs for skills, no skill-level analytics. A disabled
  placeholder tab/button may be shown if needed to match the current design
  direction, but it does not execute evals.
- No cross-workspace sharing — skills are workspace-scoped, like agents.

## Personas

- **Author / maintainer** — curates the workspace's review rules; writes and edits
  skills, decides which are enabled in the library.
- **Agent configurator** — assembles an agent by binding the right skills in the
  right order.
- **Importer** — brings in a skill from outside (a colleague's Markdown, a shared
  archive) and must be able to review its contents before trusting it.

## User stories

1. **As an author**, I can open the Skills page, click Add → Create, fill in name,
   description, type, and a Markdown body, and save — so the rule now exists once
   and can be reused.
2. **As an author**, I can click a skill card to preview its body in the detail pane,
   and edit it; my edits are versioned so I can see it changed.
3. **As an author**, I can toggle a skill **enabled/disabled** in the library; a
   disabled skill contributes to **no** agent's prompt.
4. **As an agent configurator**, I open an agent's **Skills** tab, see all
   workspace skills, check the ones this agent should use, drag to reorder them,
   and the agent's prompt is assembled with those skill bodies in that order.
5. **As an agent configurator**, I can remove a single skill from one agent
   without affecting other agents or deleting it from the library.
6. **As an importer**, I can Add → Import a `.md` file or a `.zip` skill package;
   the product extracts the skill's core (title/description/type + Markdown body),
   shows me a **preview**, and warns me that **a foreign skill is foreign
   instructions inside my agent's prompt** — nothing is saved until I confirm, and
   no executable part of the archive is run.
7. **As a reviewer of a run**, I can open a run's trace, find the prompt-assembly
   section, and see the **Skills block** that was injected. Runs with injected
   skills show higher whole-run `tokens_in`; runs with no active linked skills do
   not show a Skills block.

## Functional requirements

### FR-1 Skill storage & library

- The server owns a **CRUD module over the `skills` table**; the database is the
  source of truth. Skills are **workspace-scoped**.
- The Skills page shows a **two-pane master-detail view**: a left list of skill
  cards (name, **type** badge, description, and an **enabled** toggle) and a right
  detail pane with rendered preview, editable configuration, usage, and versions.
- An **Add** control offers **Create** or **Import**.

### FR-2 Skill editor

- A form with: **name**, **description**, **type**, and a **Markdown body**.
- **Type** is one of the existing values: `rubric`, `convention`, `security`,
  `custom`.
- **Description is the skill's interface** — it should be phrased **directively**
  (an instruction, e.g. "Flag any change that breaks an API contract"). The UI
  hints this with helper text under the field.
- Editing the **body** creates a new **version** (snapshot in `skill_versions`,
  `version` bumped) — mirroring agent versioning.

### FR-3 Binding to an agent

- The Agent editor gains a **Skills tab**: it lists **all** workspace skills with a
  **checkbox** (attached/unattached for this agent) and a **drag handle** (order)
  for attached skills.
- **Order determines the order of skill bodies in the assembled prompt's Skills
  section** (earlier attached skill → earlier body in the section).
- Attaching/unlinking/reordering for one agent does not affect other agents.

### FR-4 Global enable + agent link / effect on prompt

There are two gates before a skill contributes to an agent's prompt:

- **Global** — `skill.enabled` on the Skills page (is the skill active in the
  workspace's library at all).
- **Agent link** — a row in `agent_skills` (is this skill attached to this
  agent).

A skill contributes to an agent's Skills section **only if it is globally enabled
AND linked to that agent**. There is no separate per-agent `enabled` column:
checked in the Agent Skills tab means a row exists in `agent_skills`; unchecked
means no row exists. This keeps the data model and tests smaller for the first
version.

### FR-5 Injection into reviews & observability

- When an agent runs a review, its **globally enabled, linked** skills (in link
  order) are **resolved to their bodies and injected** into the review prompt as
  the `## Skills / rules` block (engine support already exists; the wiring in the
  run executor does not).
- The run **trace's prompt-assembly** section shows the injected Skills block and
  the whole-run token totals. If no active linked skills exist, the Skills block
  does not appear at all.

### FR-6 Import

- Accept a **Markdown file** or an **archive (`.zip`)**.
- The product extracts the **skill core**: title/description/type (from optional
  frontmatter or a conventional `SKILL.md`) + the Markdown **body**. Source is
  recorded (e.g. `imported_url` / `extracted`).
- A **preview** of the extracted skill is shown; **nothing is saved until the user
  confirms**.
- **Executable parts of an archive are never processed or run** — only text is
  extracted.
- The UI carries an explicit **trust** message: a foreign skill is **foreign
  instructions embedded in your agent's prompt**.

### FR-7 Demo seed & control experiment

Seed data ships so the feature — and its effect — is demonstrable out of the box:

- **Two new agents**: **Test Quality Reviewer** (flags uncovered branches, missed
  corner cases, over-mocking, flaky tests) and an **API Contract Reviewer** (flags
  breaking route-signature changes). Each has its skills bound **and globally
  enabled**, so the with-skills outcome reproduces immediately after `db:seed`;
  **at least one skill is brought in through the import path** so the whole flow is
  exercised. The **without-skills** case is shown by disabling (or unlinking) a
  skill and re-running.
- **Two demo PRs** for the control experiment:
  - **Test Quality**: a PR whose test covers only the happy path → **without
    skills** the reviewer passes it (miss); **with skills** it flags the uncovered
    branch and a boundary case.
  - **API Contract**: a PR that changes a route signature → **without skills** the
    reviewer passes it (miss); **with skills** it detects the breaking change.
- Opening the run's trace → prompt-assembly section shows the **Skills block** and
  higher whole-run `tokens_in` than the no-skill run.

### FR-8 Delete safety

- Deleting a skill from the library is blocked while it is linked to one or more
  agents. The API returns a conflict response with usage information; the user
  must unlink the skill from those agents before deleting it.
- Skill versions may still be cascaded when an unlinked skill is deleted.

## Trust model (called out explicitly)

Skills are **instructions that run inside an agent's prompt**. A skill authored or
imported from an untrusted source is, in effect, untrusted instructions the model
will follow. Therefore:

- Import always shows a **preview** and requires **explicit confirmation** before
  saving.
- **No executable content from an archive is ever run** — only the text core is
  extracted.
- The import UI states the trust implication plainly.

(Note: the review engine already wraps *diff / PR body / repo-derived* content as
untrusted data via an injection guard. Skill bodies are treated as **trusted-ish
authored instructions** once the user has previewed and saved them — the trust
gate is the human preview-and-confirm step, not runtime sandboxing.)

## Acceptance criteria

The feature is done when:

1. **pr-self-review** still exists with its auto-invoke **disabled**; invoking it
   manually pulls in **both frontend and backend** skills.
2. A skill can be **created and edited in the UI**.
3. Both new agents (**Test Quality Reviewer**, **API Contract Reviewer**) have
   **bound skills**.
4. A run with active linked skills shows an explicit log line and a Skills block
   in the trace; a run with no active linked skills does not.
5. **Import** went through a **preview**, and **no executable content was run**.
6. The **control experiment reproduces on both agents**: without skills the
   reviewer misses the issue; with skills it flags the uncovered branch / boundary
   case (Test Quality) and the breaking signature change (API Contract).

## Decisions (resolved with stakeholder)

1. **Enable model — simplified.** Global `skill.enabled` controls whether the
   skill is active in the library. Per-agent usage is represented by link
   presence in `agent_skills`; no extra `agent_skills.enabled` column is added.
   Unchecking a skill in an agent removes the link. This keeps the first version
   simpler and avoids persisting inactive links.
2. **Import scope — Markdown + archive.** Accept `.md` (optional YAML frontmatter
   for name/description/type) and a `.zip` skill package (read `SKILL.md`; ignore
   scripts/executables). Preview before save.
3. **Demo seed — full.** Seed the two new agents, their skills (one via the import
   path), and two demo PRs so the control experiment reproduces out of the box.
4. **Versioning — yes.** Editing a skill body bumps `version` and writes a
   snapshot into `skill_versions` (mirrors agent versioning).

## Reused vs. new (informational)

**Reused as-is:** `skills` / `skill_versions` / `agent_skills` tables; `Skill`,
`SkillType`, `SkillSource` contracts; the agents module's link/reorder plumbing;
`assemblePrompt`'s `## Skills / rules` block and its prompt-assembly trace record.

**New in this build:** skills CRUD module (server) + `Create/UpdateSkillInput`
contracts; run-executor wiring to load & inject an agent's globally enabled,
linked skills; import (Markdown + zip) with preview; delete protection for linked
skills; the Skills page, skill editor, and skills hook (client); the Agent
editor's Skills tab; the demo seed (agents + skills + PRs). Contract changes must
be applied to **every vendored copy** by hand (`server/src/vendor/shared`,
`client/src/vendor/shared`).


