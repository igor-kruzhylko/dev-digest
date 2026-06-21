<!-- Map for client/. Root CLAUDE.md has repo-wide facts — don't repeat them.
     Link with plain markdown (lazy), never @import. Keep it short. -->

# client/ — `@devdigest/web`

Next.js 15 (App Router) studio UI on :3000. Talks to the API over REST + SSE.
Overview & route map → [README.md](README.md).

## Commands
`pnpm dev` (:3000) · `build` · `start` · `typecheck` · `test` (Vitest + jsdom).

## Conventions (non-default)
- App Router under `src/app` (pages: repos, agents, settings, onboarding).
- Data access through `src/lib/hooks/*` over `src/lib/api.ts` — components don't fetch directly.
- Contracts come from `@devdigest/shared` (vendored at `src/vendor/shared`); UI primitives in `src/vendor/ui` ([README](src/vendor/ui/README.md)).
- i18n messages in `src/messages` / `src/i18n`.

## Do-not-touch
- `.next/**` — build output.
- `src/vendor/**` — vendored shared contracts + UI; see root CLAUDE.md.

## More
[docs/](docs/) · [specs/](specs/) · [INSIGHTS.md](INSIGHTS.md)
