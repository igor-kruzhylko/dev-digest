# Frontend UI Architecture — skill

**Version:** 1.0.0
**Skill id:** `frontend-ui-architecture`

A skill that helps decide **where frontend code should live and how to structure it** — for React
and Next.js (App Router) codebases. It answers organizational questions: folder layout, component
decomposition, and the placement of constants, utils/helpers, business logic, custom hooks, state,
and naming, plus Next.js-specific architecture (route groups, private folders, colocation, and the
server/client boundary).

---

## Focus

The skill is deliberately scoped to **structure and organization** — the "where does this go?"
class of questions — not to React/Next.js *API usage* or general coding tips. Its center of gravity
is one principle: **colocate code as locally as possible and promote it to a shared location only
when real reuse demands it**, expressed through a feature-based folder layout with unidirectional
imports.

## What it covers

- **Folder structure** — flat → grouped → feature-based growth path; feature-based layout;
  unidirectional import flow; nesting limits.
- **Component decomposition** — when to split a component, when *not* to (avoiding over-extraction),
  narrow props, and the modern hook-based take on container/presentational.
- **Constants** — local vs feature vs shared; naming; avoiding mega-files.
- **Utils / helpers / lib** — what belongs in each and how to name domain helpers.
- **Business-logic placement** — the component-vs-hook-vs-pure-util decision.
- **Custom hooks** — naming, single responsibility, domain grouping, sharing logic not state.
- **Naming conventions** — components, files, folders, hooks, constants, booleans, tests.
- **State management** — colocation, lifting, server/form/URL/global state.
- **Next.js App Router** — `src/` layout, route groups `(group)`, private folders `_folder`,
  colocation inside `app/`, the server/client boundary, and where data/actions/queries live.

## When to use it (cases)

Trigger this skill when working on React or Next.js frontend and an **organizational** question
arises, e.g.:

- "Where should this component / constant / helper / hook go?"
- "Is this component too big — should I split it?"
- "Should this logic be a custom hook or a plain util?"
- "How should I structure this folder / feature / project?"
- "Should this be a Server Component or a Client Component? Where does `use client` go?"
- Reviewing or refactoring a frontend codebase for structure and maintainability.

It applies even when the user never says the word "architecture" — the signal is a code-placement or
code-structure decision.

## How it differs from related skills

This skill was built specifically to **avoid overlapping** with existing frontend skills. The
dividing line is *organization/placement* vs *API/usage*:

| Skill | Its lane | This skill's lane |
|---|---|---|
| `react-best-practices` | Component design, hooks misuse, performance, anti-patterns, data fetching *patterns* | **Where** code lives and **how** the project/files are structured |
| `next-best-practices` | Next.js file conventions, RSC mechanics, async APIs, metadata, route handlers *(how features work)* | **Structuring** an App Router project: route groups, colocation, feature layout, *where* the server/client boundary should fall |
| `react-testing-library` | How to write component tests | (out of scope — only notes test-file naming) |
| `typescript-expert` | Type-level programming, tooling | (out of scope) |

Rule of thumb: if the question is **"where does this belong / how do I structure it?"** → this skill.
If it's **"how do I use this API / write this component correctly?"** → one of the others.

## Structure of this skill

```
frontend-ui-architecture/
├── SKILL.md                              core decision framework (loaded on trigger)
├── README.md                             this file — scope, differences, version, sources
└── references/
    ├── react-code-organization.md        expanded React guidance + worked examples
    └── nextjs-app-router.md              Next.js App Router structure + server/client boundary
```

`SKILL.md` holds the lean, always-applicable heuristics; the `references/` files hold depth and
examples and are read on demand.

---

## Sources

The full research bibliography behind this skill. ⭐ = canonical / primary source (official docs or
widely-cited reference); these take priority when guidance conflicts.

### React — project & folder structure
- ⭐ bulletproof-react — Project Structure — https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md
- ⭐ Robin Wieruch — React Folder Structure Best Practices [2026] — https://www.robinwieruch.de/react-folder-structure/
- ⭐ Josh W. Comeau — Delightful React File/Directory Structure — https://www.joshwcomeau.com/react/file-structure/
- profy.dev — Popular React Folder Structures and Screaming Architecture — https://profy.dev/article/react-folder-structure
- Tania Rascia — How to Structure and Organize a React Application — https://www.taniarascia.com/react-architecture-directory-structure/
- Web Dev Simplified — How To Structure React Projects — https://blog.webdevsimplified.com/2022-07/react-folder-structure/
- DEV (Pramod Boda) — Recommended Folder Structure for React 2025 — https://dev.to/pramod_boda/recommended-folder-structure-for-react-2025-48mc
- Netguru — Professional React Project Structure in 2025 — https://www.netguru.com/blog/react-project-structure
- DZone — Production-Grade React Project Structure — https://dzone.com/articles/production-grade-react-project-structure
- Medium (Priyen Mehta) — React Best Practices for Folder Structure & System Design — https://javascript.plainenglish.io/react-best-practices-for-folder-structure-system-design-architecture-8fc2f09e3fff

### React — component decomposition
- ⭐ React docs — Thinking in React — https://react.dev/learn/thinking-in-react
- ⭐ Kent C. Dodds — When to break up a component into multiple components — https://kentcdodds.com/blog/when-to-break-up-a-component-into-multiple-components
- ⭐ Developer Way — React components composition: how to get it right — https://www.developerway.com/posts/components-composition-how-to-get-it-right
- David Tang (DailyJS) — Techniques for decomposing React components — https://medium.com/dailyjs/techniques-for-decomposing-react-components-e8a1081ef5da
- Abbas Roholamin — Six Pillars of Component Architecture — https://medium.com/@abbas-roholamin/splitting-a-ui-into-components-in-react-six-pillars-of-component-architecture-04538e542ce5
- Thiraphat Phutson — Splitting Components in React — https://thiraphat-ps-dev.medium.com/splitting-components-in-react-a-path-to-cleaner-and-more-maintainable-code-f0828eca627c
- Glinteco — Break Down Components in React — https://glinteco.com/en/post/break-down-components-in-react-a-guide-to-better-code-structure/

### React — business-logic placement (component vs hook vs utils)
- ⭐ profy.dev — Path To A Clean(er) React Architecture (Part 6): Business Logic Separation — https://profy.dev/article/react-architecture-business-logic-and-dependency-injection
- Felix Gerschau — Separation of concerns with React hooks — https://felixgerschau.com/react-hooks-separation-of-concerns/
- Priyanka Daida — React Custom Hooks vs. Helper Functions — https://medium.com/@priyankadaida/react-custom-hooks-vs-helper-functions-when-to-use-both-e40167325479
- DEV (Andrew Baisden) — React Custom Hooks vs. Helper Functions — https://dev.to/andrewbaisden/react-custom-hooks-vs-helper-functions-when-to-use-both-2587
- Sairys — Separating responsibilities using React Hooks — https://sairys.medium.com/react-separating-responsibilities-using-hooks-b9c90dbb3ab9

### React — custom hooks
- ⭐ React docs — Reusing Logic with Custom Hooks — https://react.dev/learn/reusing-logic-with-custom-hooks
- DEV (austinwdigital) — Mastering Custom React Hooks — https://dev.to/austinwdigital/mastering-custom-react-hooks-best-practices-for-clean-scalable-code-40b1
- DEV (hasancse) — Best Practices for Creating Reusable Custom Hooks — https://dev.to/hasancse/best-practices-for-creating-reusable-custom-hooks-in-react-37nj

### React — constants, utils & helpers
- Medium (Austin Paley) — How To Add a Constants File to Your React Project — https://medium.com/@austinpaley32/how-to-add-a-constants-file-to-your-react-project-6ce31c015774
- DEV (Suraj Jadhav) — How should we structure our React code? (2/2) — https://dev.to/surajjadhav/how-should-we-structure-our-react-code-2-2-kgh

### React — naming conventions
- Sufle — Naming Conventions in React — https://www.sufle.io/blog/naming-conventions-in-react
- Hands on React — Code Organization & Conventions — https://handsonreact.com/docs/code-organization-conventions
- gist (koistya) — File and folder naming convention for React.js components — https://gist.github.com/koistya/d7a507438c741ee6adb5
- Better Programming (faraz amiruddin) — An Opinionated Guide to React Folder Structure and File Naming — https://betterprogramming.pub/an-opinionated-guide-to-react-folder-structure-file-naming-8b723d39a0d6
- Business Compass — React Naming Conventions and Coding Standards — https://knowledge.businesscompassllc.com/react-naming-conventions-and-coding-standards-best-practices-for-scalable-frontend-development/

### React — state management
- ⭐ bulletproof-react — State Management — https://github.com/alan2207/bulletproof-react/blob/master/docs/state-management.md
- bulletproof-react — Performance — https://github.com/alan2207/bulletproof-react/blob/master/docs/performance.md

### React — design patterns (container / presentational)
- ⭐ patterns.dev — Container/Presentational Pattern — https://www.patterns.dev/react/presentational-container-pattern/
- TSH.io — Container-presentational pattern in React — https://tsh.io/blog/container-presentational-pattern-react
- MirrorCodex — Presentational vs Container Components: Still Relevant in 2025? — https://mirrorcodex.com/presentational-vs-container-components/

### Next.js — project & folder structure
- ⭐ Next.js docs — Getting Started: Project Structure — https://nextjs.org/docs/app/getting-started/project-structure
- Wisp CMS — The Ultimate Guide to Organizing Your Next.js 15 Project Structure — https://www.wisp.blog/blog/the-ultimate-guide-to-organizing-your-nextjs-15-project-structure
- DEV (bajrayejoon) — Best Practices for Organizing Your Next.js 15 (2025) — https://dev.to/bajrayejoon/best-practices-for-organizing-your-nextjs-15-2025-53ji
- DEV (krunal_groovy) — The Next.js 15 App Router Project Structure That Scales — https://dev.to/krunal_groovy/the-nextjs-15-app-router-project-structure-that-scales-with-examples-47ha
- Melvin Prince — Inside the App Router: Best Practices for File & Directory Structure (2025) — https://medium.com/better-dev-nextjs-react/inside-the-app-router-best-practices-for-next-js-file-and-directory-structure-2025-edition-ed6bc14a8da3
- Magic UI — Next.js project structure: Master the setup for scalable apps — https://magicui.design/blog/next-js-project-structure

### Next.js — routing organization (route groups, private folders, colocation, src/)
- ⭐ Next.js docs — Routing: Project Organization & Colocation — https://nextjs.org/docs/app/building-your-application/routing/colocation
- ⭐ Next.js docs — File-system conventions: Route Groups — https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
- Next.js Colocation Template — Scalable Folder Structure Guide — https://next-colocation-template.vercel.app/
- DEV (bridget_amana) — Understanding Route Visibility and Colocation in Next.js App Router — https://dev.to/bridget_amana/understanding-route-visibility-and-colocation-in-nextjs-app-router-2bni
- shahin.page — Organizing Routes and Files: Private Folders and Project Structure — https://shahin.page/article/nextjs-routing-private-folders-and-project-structure

### Next.js — server/client component boundary
- ⭐ Next.js docs — Getting Started: Server and Client Components — https://nextjs.org/docs/app/getting-started/server-and-client-components
- ⭐ Vercel Academy — Client-Server Component Boundaries — https://vercel.com/academy/nextjs-foundations/client-server-boundaries
- I am Raghuveer — Next.js Server vs Client Components: Drawing the Right Boundary — https://www.iamraghuveer.com/posts/nextjs-server-vs-client-components/
- Zayne Lovecraft — Understanding Client Components and Client Boundaries (`use client`) — https://www.zaynelovecraft.com/articles/understanding-client-components-and-client-boundaries

### Next.js — feature-based / scalable large-app architecture
- DEV (addwebsolution) — Architecting Large-Scale Next.js Applications — https://dev.to/addwebsolutionpvtltd/architecting-large-scale-nextjs-applications-folder-structure-patterns-best-practices-2dpj
- freeCodeCamp — How to Build Reusable Architecture for Large Next.js Applications — https://www.freecodecamp.org/news/reusable-architecture-for-large-nextjs-applications/
- Medium (CodeTune) — The Scalable Next.js Folder Structure Every Large Project Needs — https://medium.com/skillstuff/the-scalable-next-js-folder-structure-every-large-project-needs-b440178821f4
- Groovy Web — Next.js Project Structure 2026: Scalable Full-Stack Template — https://www.groovyweb.co/blog/nextjs-project-structure-full-stack

### Meta / full handbooks
- ⭐ bulletproof-react (repo root) — https://github.com/alan2207/bulletproof-react
- React Handbook — Project Standards — https://reacthandbook.dev/project-standards

---

## Changelog

- **1.0.0** — Initial release. React + Next.js App Router organization guidance; `SKILL.md` core
  framework + two reference files; full research bibliography.
