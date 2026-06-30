# Next.js App Router — architecture & structure

Companion to `SKILL.md`. Read this when structuring a Next.js (App Router) project or deciding
server vs client components. Everything in the React guidance still applies; this layers the
framework-specific structure on top. Table of contents:

- [Project structure](#project-structure)
- [Routing organization: route groups, private folders, colocation](#routing-organization)
- [The server/client boundary — the key decision](#the-serverclient-boundary)
- [Where data, logic, and actions live](#where-data-logic-and-actions-live)
- [Feature-based structure for large apps](#feature-based-structure-for-large-apps)

---

## Project structure

Use the optional **`src/`** directory to separate application code from root config files
(`next.config.js`, `tsconfig.json`). It keeps the project root clean.

```
src/
  app/            routing tree only — pages, layouts, route handlers
  components/      shared UI (ui/ for primitives, layout/ for shells)
  features/        feature-specific code (see below)
  lib/             data access, server clients, configured third-party
  hooks/           shared client hooks
  utils/           shared pure helpers
  constants/
public/            static assets
```

**Resist putting everything in `app/`.** `app/` is for routing (pages, layouts, loading/error
states, route handlers). Components, hooks, and logic that grow beyond a single route belong in
`features/` or the shared folders — otherwise `app/` becomes an unnavigable dumping ground.

## Routing organization

The App Router gives three structural tools. Knowing them prevents both over-nesting and the
"everything in app/" anti-pattern.

### Colocation
Files inside `app/` are **not** routable unless they're a special file (`page.tsx`, `layout.tsx`,
`route.ts`, etc.). So you can safely place route-specific components, hooks, and helpers right next
to the route that uses them:

```
app/
  dashboard/
    page.tsx
    _components/      DashboardChart.tsx   (private, see below)
    _hooks/           useDashboardData.ts
```

Apply the promotion ladder: keep route-only code colocated; promote to `features/` or shared only
when a second route needs it.

### Route groups — `(group)`
Wrap a folder in parentheses to organize routes **without affecting the URL**:

```
app/
  (marketing)/      shares a marketing layout; "(marketing)" is NOT in the URL
    page.tsx        → /
    about/page.tsx  → /about
  (app)/            shares an authenticated layout
    dashboard/page.tsx → /dashboard
```

Use them to group routes by section/intent/team and to give each group its own `layout.tsx`.

### Private folders — `_folder`
Prefix a folder with an underscore to opt it (and everything under it) **out of routing**. Use it
to keep non-route implementation detail (components, hooks, utils) colocated inside `app/` without
the router trying to treat it as a segment: `app/dashboard/_components/`, `app/dashboard/_lib/`.

Route groups `(x)` = "organize routes, don't change the URL". Private folders `_x` = "this isn't a
route at all."

## The server/client boundary

> The single most consequential architectural decision in an App Router app is **where the
> `use client` boundary falls in the component tree.**

Server Components are the default and run only on the server: they can `await` data directly, read
env vars and secrets, hit the database, and ship **zero** JS to the browser. A component must become
a Client Component (`'use client'` at the top) only if it uses one of:

- browser APIs (`window`, `document`, `localStorage`)
- React state/effects/refs (`useState`, `useEffect`, `useRef`)
- event handlers (`onClick`, `onChange`, …)
- real-time subscriptions
- a third-party library that itself uses any of the above

**Push the boundary down.** Once `'use client'` sits on a component, its entire subtree becomes
client-side and ships to the browser. So keep data fetching and heavy logic in Server Components and
make the Client Components small interactive **leaves**.

**Anti-pattern:** one big Client Component that both fetches data and renders interactive UI. It
forces all that data and logic into the browser bundle, and tends to create awkward prop-drilling of
server data.

**Pattern:** the server fetches → passes data via props across the boundary → small client leaves
handle interaction.

```
Server Component (page.tsx)        ← await getOrders()
  └─ OrderTable (server)           ← renders rows
       └─ RowActions ('use client')← only the interactive bit is a client leaf
```

Mental model: **Server Components handle reads, Server Actions handle writes, Client Components are
the interactive surface that connects them.**

## Where data, logic, and actions live

- **Data fetching / queries** → `lib/data/` (or a feature's `api/`), called from Server Components.
  Don't scatter `fetch`/DB calls through the UI; keep a dedicated data-access layer.
- **Mutations** → **Server Actions** (`'use server'`), colocated in the feature or `lib/actions/`.
- **Route handlers** (REST/webhooks) → `app/api/.../route.ts`.
- **Never** call backend APIs directly inside presentational components — go through the data/actions
  layer so the seam is swappable and testable.

## Feature-based structure for large apps

For large or multi-team apps, combine the App Router with the same feature-based layout as plain
React. `app/` stays thin (routing + wiring); the substance lives in `features/`:

```
features/
  billing/
    components/
    actions/      Server Actions ('use server')
    queries/      server-side data access
    schemas/      Zod schemas / validation
    types.ts
    utils/
app/
  (app)/
    billing/
      page.tsx    imports from features/billing, stays thin
```

Same discipline as before: unidirectional imports (features → shared, never the reverse), shallow
nesting, colocate-then-promote, and a thin routing layer over substantial feature modules.
