---
name: frontend-ui-architecture
description: >-
  Decide WHERE frontend code should live and HOW to structure it — folder layout,
  component decomposition, and the placement of constants, utils/helpers, business
  logic, custom hooks, state, and naming — plus Next.js App Router architecture
  (route groups, private folders, colocation, and the server/client boundary). Use
  this whenever writing, reviewing, refactoring, or organizing React or Next.js
  frontend code and a question of code organization comes up: "where should this
  go?", "is this component too big?", "should this be a hook or a util?", "how do I
  structure this folder?", "where do constants belong?", "should this be a server or
  client component?" — even if the user never says the word "architecture". This skill
  is about code and folder structure and where logic belongs — NOT about React/Next
  API usage or hooks rules, styling/CSS approach (CSS-in-JS vs CSS Modules, where
  stylesheets go), build/tooling setup, or which library to pick (other skills cover those).
version: 1.0.1
---

# Frontend UI Architecture

Guidance for organizing React and Next.js frontend code: where each piece belongs,
how to split it, and how to keep the structure from rotting as the app grows.

## What you are actually optimizing

The goal is **not** "tidy folders." It is to minimize two real costs:

1. **Change amplification** — how many files you must touch to make one logical change.
   Good structure keeps a change local; bad structure scatters it.
2. **Findability** — how long it takes someone (including future-you) to locate where a
   thing lives. If you have to grep the whole repo to find where prices are formatted,
   the structure has failed.

Every heuristic below serves one of those two. When a rule and these goals conflict,
the goals win — structure is a means, not an end. Resist imposing heavy structure on a
small app; resist leaving a large app flat. Match the structure to the current size.

## The promotion ladder — the one model that answers "where does X go?"

Most "where should this live?" questions resolve with a single principle:
**start as local as possible, promote only when reuse demands it.**

A piece of code (component, constant, helper, hook, type) climbs this ladder only when a
real second consumer appears — not in anticipation of one:

1. **Inline / same file** — used once, small. Keep it where it is used.
2. **Sibling file in the same feature/route folder** — used a few times within one feature,
   or big enough to deserve its own file, but still feature-local.
3. **Shared top-level (`components/`, `hooks/`, `lib/`, `utils/`, `constants/`)** — genuinely
   used across multiple features.

Premature promotion to "shared" is the most common structural mistake: it creates a junk
drawer of vaguely-global helpers that nobody can safely change. Colocate first. Promote on
the second real use, not the first imagined one.

## Folder structure: by feature, not by file type

Organizing by technical type (`components/`, `hooks/`, `utils/` at the root holding
*everything*) breaks down past ~15–20 components, because one feature's code ends up smeared
across every folder. Organize by **feature/domain** instead — each feature owns its
components, hooks, logic, and types:

```
src/
  features/
    checkout/
      components/
      hooks/
      api/        (queries / actions / services)
      utils/
      types.ts
    auth/
      ...
  components/     (shared, cross-feature UI only)
  hooks/          (shared hooks)
  lib/            (third-party wrappers, configured clients)
  utils/          (shared pure helpers)
  constants/      (shared constants)
```

Two rules keep this honest:

- **Unidirectional imports.** Features may import from shared modules; shared modules must
  never import from features; ideally features don't import each other (go through shared).
  This is what stops the dependency graph from turning into a knot. (bulletproof-react.)
- **Cap nesting at ~2–3 levels.** Deep trees make import paths fragile and moves painful.
  If a path reads `features/dashboard/widgets/weather/current/small/index.tsx`, you've gone
  too far — flatten it.

Start flat for small apps (a simple `components/`, `hooks/`, `pages/` is fine). Adopt the
feature layout when the flat one starts to hurt — not before.

## Components: when to split, when to leave alone

Split a component when it has **more than one reason to change** — it mixes unrelated
responsibilities, a piece of it is reused elsewhere, or it's grown large enough that splitting
genuinely improves readability or testability.

Do **not** split just to make files shorter. Premature extraction produces a maze of tiny
components wired together by props — over-abstracted and as hard to follow as the monolith you
were avoiding. The two failure modes are equal and opposite: monolith components that do too
much, and over-extracted soup. Aim for the middle, and let real pressure (reuse, complexity)
drive extraction rather than a line count.

When you do split, pass each child only the data it needs — narrow props keep components
focused and decoupled.

**Presentational vs container (modern take):** the old "container component fetches, presentational
renders" split is now usually expressed as **a custom hook for logic + a component for view**.
The principle (separate logic from presentation) still holds; the implementation moved from
wrapper components to hooks. Reach for an explicit container layer only in large apps/design
systems where it earns its keep.

## Where specific things go

### Constants
- Used in one component → a `const` at the top of that file.
- Used across a feature → a `constants.ts` in that feature.
- Truly app-wide (theme tokens, config keys, enums) → shared `constants/`, split by concern
  (`routes.ts`, `theme.ts`) rather than one giant file.
- Name them `UPPER_SNAKE_CASE`. Keep them near where they're used until reuse forces promotion.

### Utils vs helpers vs lib
- **`utils/`** — pure, stateless, general-purpose functions (formatters, validators, converters).
  Pure functions are trivial to test, so push data work (filtering, sorting, formatting) here
  rather than burying it in components or hooks.
- **Helpers** — domain-specific functions. Name them explicitly by domain (`currency.helpers.ts`,
  `validation.helpers.ts`) so they're easy to find in the IDE. Avoid one thousand-line `helpers.ts`.
- **`lib/`** — wrappers and configured instances around third-party packages (the API client,
  the date library, the analytics SDK), so the rest of the app depends on your wrapper, not the
  vendor directly.

### Business logic: component vs custom hook vs util
Decide by what the logic *touches*:
- **Pure data transformation** (filter, sort, derive, format) → a **pure function in `utils/`**.
  No React, no state — maximally testable.
- **Stateful or lifecycle-bound logic** (data fetching, subscriptions, form state, anything using
  `useState`/`useEffect`) → a **custom hook**.
- **Rendering** stays in the component. A component that only renders and delegates logic to a hook
  + pure utils is easy to read and to test.
- If a component has only a few lines of logic, don't ceremonially extract it — inline is fine.

### Custom hooks
- Prefix with `use`; give a name that says what it does (`useCheckout`, not `useLogic`).
- One hook, one responsibility, ideally one per file. Group hooks **by domain** (next to their
  feature), not in a giant `hooks/` bucket of unrelated things.
- Hooks share **stateful logic, not state** — each call site gets its own independent state.
- Don't wrap `useEffect` in a thin convenience hook just to have a hook; abstract a concrete use case.

## Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Component & its file | `PascalCase` | `UserProfile.tsx` |
| Component-in-a-folder | folder `PascalCase`, entry `index.tsx` | `UserProfile/index.tsx` |
| Hook | `use` + camelCase | `useUserProfile` |
| Variables & functions | `camelCase` | `formatPrice` |
| Constants / enum values | `UPPER_SNAKE_CASE` | `MAX_RETRIES` |
| Booleans | `is`/`has`/`should` prefix | `isLoading`, `hasAccess` |
| Test files | `.test`/`.spec` suffix | `UserProfile.test.tsx` |

Consistency matters more than the specific choice — pick one and hold it across the project.

## State: keep it close, lift only when shared

- **Colocate state** with the component that uses it. Local state that doesn't need to be shared
  causes the fewest re-renders and the least coupling.
- **Lift** state only when another component genuinely needs it — and lift it to the lowest common
  ancestor, not all the way to the top.
- **Global app state** (auth, theme, global modals/notifications) is the *exception*, not the default.
  Reach for it only for genuinely app-wide concerns.
- Don't hand-roll **server state** (fetched data) into global state — use a data-fetching/caching
  library. Likewise use a form library for non-trivial **form state**, and the URL for shareable
  state (filters, pagination).

## Next.js App Router

If the project uses Next.js (App Router), the rules above still apply, with framework-specific
structure layered on top — route groups, private folders, colocation inside `app/`, and the
all-important server/client boundary. The single most consequential decision is **where `use client`
falls in the tree**: keep data and heavy logic in Server Components, push the client boundary down to
the smallest interactive leaves.

**Read [references/nextjs-app-router.md](references/nextjs-app-router.md)** before structuring an
App Router project or deciding server vs client components.

## Deeper references

- **[references/react-code-organization.md](references/react-code-organization.md)** — expanded React
  guidance with examples: feature layout, decomposition walkthroughs, the hook-vs-util decision, and
  naming details.
- **[references/nextjs-app-router.md](references/nextjs-app-router.md)** — Next.js App Router: project
  structure, route groups `(group)`, private folders `_folder`, colocation, and the server/client
  boundary.
- **[README.md](README.md)** — skill scope, how it differs from related skills, version, and the full
  list of research sources behind this guidance.
