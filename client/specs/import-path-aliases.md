# Import path alias sweep — client spec

Replace deep relative imports under `src/app/**` with the `@/*` alias
(`tsconfig.json` → `"@/*": ["./src/*"]`). Found during a UI architecture
review: 24 files reach into `src/lib` or `src/components` via 4–7 levels of
`../`, which is exactly the "fragile import path from deep nesting" smell —
any future folder move silently breaks them, and the depth makes the import
unreadable at a glance.

## Rule

An import in `src/app/**` must use `@/*` instead of a relative path when the
target lives **outside the current route/feature subtree** — i.e. it crosses
into `src/lib`, `src/components`, `src/i18n`, or another top-level `src/*`
folder. Relative imports **stay relative** when the target is colocated
within the same feature (sibling file, child `_components/`, parent
`_components/index`) — those are not in scope and should not be touched.

In practice: every import below with **4 or more** `../` segments is in
scope. The same rule applies to `vi.mock(...)` module-path arguments in test
files — they are equally fragile relative paths into `src/lib`, just not
caught by an `import ... from` grep. Nothing else changes.

## File-by-file changes

### `agents/[id]` route
- `_components/AgentEditor/AgentEditor.test.tsx`
  - `"../../../../../lib/toast"` → `"@/lib/toast"`
  - `"../../../../../../messages/en/agents.json"` → **out of scope**, see below
- `_components/AgentEditor/_components/ConfigTab/ConfigTab.tsx`
  - `"../../../../../../../lib/hooks/agents"` → `"@/lib/hooks/agents"`
  - `"../../../../../../../lib/toast"` → `"@/lib/toast"`
  - `"../../../../../../../lib/model-label"` → `"@/lib/model-label"`

### `agents` list route
- `_components/AgentCard/AgentCard.test.tsx`
  - `"../../../../../messages/en/agents.json"` → **out of scope**, see below
- `_components/AgentCard/AgentCard.tsx`
  - `"../../../../lib/hooks/agents"` → `"@/lib/hooks/agents"`
- `_components/AgentsListView/AgentsListView.tsx`
  - `"../../../../components/app-shell"` → `"@/components/app-shell"`
  - `"../../../../lib/hooks/agents"` → `"@/lib/hooks/agents"`
- `_components/AgentsListView/_components/CreateAgentModal/CreateAgentModal.tsx`
  - `"../../../../../../lib/hooks/agents"` → `"@/lib/hooks/agents"`

### `repos/[repoId]/pulls` route
- `constants.ts`
  - `"../../../../lib/types"` → `"@/lib/types"`
- `[number]/page.tsx`
  - `"../../../../../components/app-shell"` → `"@/components/app-shell"`
  - `"../../../../../lib/hooks"` → `"@/lib/hooks"`
  - `"../../../../../lib/hooks/reviews"` → `"@/lib/hooks/reviews"`
  - `"../../../../../lib/repo-context"` → `"@/lib/repo-context"`
  - `"../../../../../lib/api"` → `"@/lib/api"`
  - `"../../../../../lib/github-urls"` → `"@/lib/github-urls"`
- `[number]/_components/FindingCard/FindingCard.test.tsx`
  - `"../../../../../../../../messages/en/prReview.json"` → **out of scope**, see below
- `[number]/_components/FindingCard/FindingCard.tsx`
  - `"../../../../../../../lib/github-urls"` → `"@/lib/github-urls"`
- `[number]/_components/FindingsPanel/FindingsPanel.test.tsx`
  - `"../../../../../../../../messages/en/prReview.json"` → **out of scope**, see below
- `[number]/_components/FindingsPanel/FindingsPanel.tsx`
  - `"../../../../../../../lib/hooks/reviews"` → `"@/lib/hooks/reviews"`
- `[number]/_components/ReviewRunAccordion/ReviewRunAccordion.tsx`
  - `"../../../../../../../lib/hooks/reviews"` → `"@/lib/hooks/reviews"`
- `[number]/_components/RunHistory/RunHistory.test.tsx`
  - `"../../../../../../../../messages/en/prReview.json"` → **out of scope**, see below
- `[number]/_components/RunReviewDropdown/RunReviewDropdown.test.tsx`
  - `"../../../../../../../../messages/en/prReview.json"` → **out of scope**, see below
- `[number]/_components/RunReviewDropdown/RunReviewDropdown.tsx`
  - `"../../../../../../../lib/hooks/agents"` → `"@/lib/hooks/agents"`
  - `"../../../../../../../lib/hooks/reviews"` → `"@/lib/hooks/reviews"`
- `[number]/_components/RunStatus/RunStatus.test.tsx`
  - `"../../../../../../../../messages/en/prReview.json"` → **out of scope**, see below
- `[number]/_components/RunStatus/RunStatus.tsx`
  - `"../../../../../../../lib/hooks/reviews"` → `"@/lib/hooks/reviews"`
- `[number]/_components/RunTraceDrawer/RunTraceDrawer.test.tsx`
  - `"../../../../../../../../messages/en/runs.json"` → **out of scope**, see below (drop the stray `// apps/web/messages/en/runs.json` trailing comment too — stale path reference, predates the `client/` rename)
- `[number]/_components/VerdictBanner/VerdictBanner.test.tsx`
  - `"../../../../../../../../messages/en/prReview.json"` → **out of scope**, see below

### `settings/[section]` route
- `_components/SettingsView/SettingsView.tsx`
  - `"../../../../../components/app-shell"` → `"@/components/app-shell"`
- `_components/SettingsView/_components/SettingsApiKeys/constants.ts`
  - `"../../../../../../../lib/types"` → `"@/lib/types"`
- `_components/SettingsView/_components/SettingsApiKeys/SettingsApiKeys.tsx`
  - `"../../../../../../../lib/hooks"` → `"@/lib/hooks"`
  - `"../../../../../../../lib/api"` → `"@/lib/api"`
  - `"../../../../../../../lib/types"` → `"@/lib/types"`
- `_components/SettingsView/_components/SettingsModels/SettingsModels.tsx`
  - `"../../../../../../../lib/hooks"` → `"@/lib/hooks"`
  - `"../../../../../../../lib/hooks/agents"` → `"@/lib/hooks/agents"`
  - `"../../../../../../../lib/model-label"` → `"@/lib/model-label"`
  - `"../../../../../../../lib/feature-models"` → `"@/lib/feature-models"`
  - `"../../../../../../../lib/types"` → `"@/lib/types"`

## `vi.mock()` specifiers (additional, found via separate grep)

- `AgentEditor.test.tsx:9` — `vi.mock("../../../../../lib/hooks/agents", ...)` → `vi.mock("@/lib/hooks/agents", ...)`
- `FindingsPanel.test.tsx:7` — `vi.mock("../../../../../../../lib/hooks/reviews", ...)` → `vi.mock("@/lib/hooks/reviews", ...)`
- `RunReviewDropdown.test.tsx:9` — `vi.mock("../../../../../../../lib/hooks/agents", ...)` → `vi.mock("@/lib/hooks/agents", ...)`
- `RunReviewDropdown.test.tsx:12` — `vi.mock("../../../../../../../lib/hooks/reviews", ...)` → `vi.mock("@/lib/hooks/reviews", ...)`
- `RunStatus.test.tsx:6` — `vi.mock("../../../../../../../lib/hooks/reviews", ...)` → `vi.mock("@/lib/hooks/reviews", ...)`
- `RunTraceDrawer.test.tsx:22` — `vi.mock("../../../../../../../lib/hooks/trace", ...)` → `vi.mock("@/lib/hooks/trace", ...)`
- `RunTraceDrawer.test.tsx:25` — `vi.mock("../../../../../../../lib/hooks/reviews", ...)` → `vi.mock("@/lib/hooks/reviews", ...)`

## Out of scope

5 test files import fixture JSON from `client/messages/en/*.json`, which
lives **outside `src/`** — `@/*` only maps to `./src/*`, so it cannot reach
these. Leave them as relative imports:

- `AgentEditor.test.tsx`, `AgentCard.test.tsx`, `FindingCard.test.tsx`,
  `FindingsPanel.test.tsx`, `RunHistory.test.tsx`,
  `RunReviewDropdown.test.tsx`, `RunStatus.test.tsx`,
  `RunTraceDrawer.test.tsx`, `VerdictBanner.test.tsx`

If these are worth aliasing later, that needs a new `tsconfig.json` entry
(e.g. `"@messages/*": ["./messages/*"]`) — a separate, deliberate decision,
not part of this mechanical sweep.

## Verification

1. `pnpm typecheck` — must pass with zero errors after the sweep (path
   resolution is purely lexical; behavior cannot change).
2. `pnpm test` — must pass unchanged.
3. Re-run the audit query and confirm only the messages-fixture imports
   remain:
   ```
   grep -rnE "from [\"'](\.\./){4,}" src/app
   ```
