# React Code Organization — extended guidance

Companion to `SKILL.md`. Read this when you need worked examples or the reasoning behind a
heuristic. Table of contents:

- [Folder structure: the growth path](#folder-structure-the-growth-path)
- [Feature-based layout in detail](#feature-based-layout-in-detail)
- [Component decomposition: worked examples](#component-decomposition-worked-examples)
- [The hook-vs-util decision](#the-hook-vs-util-decision)
- [Constants, utils, helpers, lib](#constants-utils-helpers-lib)
- [Naming](#naming)
- [State management](#state-management)

---

## Folder structure: the growth path

Structure should track app size. Forcing enterprise structure onto a 10-component app is as
harmful as leaving a 200-component app flat.

**Stage 1 — flat (small apps, < ~15–20 components).** A handful of top-level folders is plenty:

```
src/
  components/
  hooks/
  utils/
  pages/   (or app/ for Next.js)
```

**Stage 2 — grouped (the flat layout starts to hurt).** When `components/` has 40 files and you
can't tell which belong together, group by feature.

**Stage 3 — feature-based (large / multi-team apps).** Each feature is a self-contained mini-app.
This is the scalable default once the app is non-trivial. See below.

You do not commit to one stage forever. Begin with the simplest structure that fits today and
graduate when the current one causes friction — not on a schedule.

## Feature-based layout in detail

Organize around **what the code does** (business domains), not **what it is** (technical type).
Co-locating a feature's components, hooks, API calls, and types means adding or changing a feature
touches one folder instead of five.

```
src/
  features/
    checkout/
      components/      CheckoutForm.tsx, OrderSummary.tsx
      hooks/           useCheckout.ts, useCart.ts
      api/             createOrder.ts, getCart.ts   (queries/actions/services)
      utils/           calculateTotals.ts
      types.ts
      index.ts         (public surface of the feature)
  components/          shared, cross-feature UI (Button, Modal)
  hooks/              shared hooks (useMediaQuery)
  lib/                configured third-party clients (apiClient, dayjs)
  utils/              shared pure helpers (formatDate)
  constants/          shared constants (routes, theme)
```

**Unidirectional import rule (from bulletproof-react).** Enforce a one-way dependency flow:

- `features/*` and the app shell may import from shared modules (`components`, `hooks`, `lib`,
  `utils`, `types`).
- Shared modules must **not** import from `features/*`.
- Features should avoid importing each other directly; share through the shared layer.

This prevents circular dependencies and keeps each feature replaceable. A lint rule (e.g.
`eslint-plugin-import` boundaries) can enforce it mechanically.

**Keep nesting shallow (2–3 levels).** Deep hierarchies make import paths brittle and refactors
expensive. Prefer a flatter tree with clear names over a deep one.

**An `index.ts` per feature** defines its public surface: other code imports from
`features/checkout`, not from deep internal paths. This keeps internals free to move.

## Component decomposition: worked examples

The trigger to split is **more than one reason to change**, which usually shows up as:

1. **Mixed responsibilities** — a component that fetches data, holds form state, *and* renders a
   complex layout has three reasons to change. Split along those seams.
2. **Reuse** — a sub-part is needed somewhere else. Extract it so both sites share one source.
3. **Readability/testability** — the component is large enough that a reader can't hold it in their
   head, or a sub-part has logic worth testing in isolation.

**Counter-trigger — do not split when:** the component is small, focused, and used once. Extracting
it then just adds indirection. A 60-line component that does one clear thing is healthier than six
10-line components threaded together by props.

**Pass narrow props.** When you extract `OrderSummary` from `CheckoutPage`, give it `items` and
`total` — not the entire cart object and three setters. Narrow props make the child's contract
obvious and its tests trivial.

**Logic/view separation, the modern way.** Instead of a container component that wraps a
presentational one, extract the logic into a custom hook:

```tsx
// useDogImages.ts — logic
function useDogImages() {
  const [dogs, setDogs] = useState([]);
  useEffect(() => { /* fetch */ }, []);
  return dogs;
}

// DogList.tsx — view
function DogList() {
  const dogs = useDogImages();   // logic in, JSX out
  return <ul>{dogs.map(d => <img key={d} src={d} />)}</ul>;
}
```

The container/presentational *principle* (separate concerns) survives; hooks are the modern
*mechanism*. Keep an explicit container layer only where a large app or design system benefits from
the extra structure.

## The hook-vs-util decision

A recurring "where does this logic go?" question. Decide by what the logic **touches**:

| Logic | Goes in | Why |
|---|---|---|
| Pure transformation (filter, sort, format, derive) | **`utils/` pure function** | No React → testable in isolation, reusable anywhere |
| Uses state / effects / refs / context | **custom hook** | Tied to React's lifecycle; can't be a plain function |
| Just renders | **the component** | Keep components about UI |

Heuristic: if a function neither needs React nor returns JSX, it should not live inside a component
or a hook — pull it out as a pure function. Tangling pure data work with network calls and DOM
updates is what makes logic hard to test and refactor.

**Custom hook guidelines:**
- `use` prefix; descriptive name (`useCheckout`, `usePagination`).
- One responsibility, one per file; group by domain next to the feature.
- Hooks share **stateful logic, not state** — two components calling `useCounter()` get independent
  counters.
- Don't create thin wrappers around `useEffect` just to have a "lifecycle hook"; encapsulate a
  concrete use case instead (form management, auth, a subscription).

## Constants, utils, helpers, lib

- **Constants** ride the promotion ladder: local `const` → feature `constants.ts` → shared
  `constants/` split by concern. `UPPER_SNAKE_CASE`. Don't dump everything into one mega-file.
- **`utils/`** — pure, stateless, general-purpose (formatters, validators, converters).
- **Helpers** — domain-specific; name by domain (`currency.helpers.ts`). Many small explicit files
  beat one giant `helpers.ts` you can't navigate.
- **`lib/`** — configured wrappers around third-party packages so the app depends on your seam, not
  the vendor's API directly. Swapping a library then touches `lib/`, not 100 call sites.

## Naming

| Thing | Convention | Example |
|---|---|---|
| Component & file | `PascalCase` | `UserProfile.tsx` |
| Component folder + entry | folder `PascalCase`, `index.tsx` | `UserProfile/index.tsx` |
| Hook | `use` + camelCase | `useUserProfile` |
| Function / variable | `camelCase` | `formatPrice` |
| Constant / enum value | `UPPER_SNAKE_CASE` | `MAX_RETRIES` |
| Boolean | `is`/`has`/`should` prefix | `isLoading` |
| Test file | `.test` / `.spec` suffix | `UserProfile.test.tsx` |

The folder-with-`index.tsx` pattern lets consumers `import { UserProfile } from '.../UserProfile'`
while the component keeps its CSS, tests, and sub-parts beside it.

## State management

Order of preference — use the least powerful tool that works:

1. **Local component state** (`useState`/`useReducer`) — colocated with the component. Fewest
   re-renders, least coupling. `useReducer` when several pieces of state update together.
2. **Lifted state** — move to the lowest common ancestor only when a sibling genuinely needs it.
3. **Server state** — data fetched from an API is *not* UI state. Use a query/caching library; don't
   replicate it into global state.
4. **Form state** — use a form library for anything non-trivial (validation, errors, submission).
5. **URL state** — filters, pagination, tabs that should be shareable/bookmarkable belong in the URL.
6. **Global app state** — only genuinely app-wide concerns (auth, theme, global modals). For
   higher-velocity global data, prefer selector-based access to avoid re-rendering unrelated subtrees.

The throughline: **keep state as close to where it's used as possible**, and escalate to a broader
scope only when a concrete need forces it.
