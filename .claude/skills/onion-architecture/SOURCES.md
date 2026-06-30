# Onion Architecture — Source List

Research bibliography for the `onion-architecture` skill (DevDigest-specific).
⭐ = canonical / primary source (original author, official docs, or widely-cited
reference). Others are supporting. These are kept here so they aren't lost — they
will also be linked from the README later.

Mapping note: each section is tied to the DevDigest ring it informs —
`@devdigest/shared` (core/ports), `reviewer-core` (pure engine), `service.ts`
(application), `repository.ts` + `adapters/*` (infrastructure), `routes.ts`
(transport), `container.ts` (composition root).

---

## A. Onion Architecture — primary sources & theory

- ⭐ **Jeffrey Palermo — The Onion Architecture, part 1** (origin of the term; parts 2–4 follow).
  https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/
- ⭐ **Herberto Graça — Onion Architecture** (Software Architecture Chronicles).
  https://medium.com/the-software-architecture-chronicles/onion-architecture-79529d127f85
- ⭐ **Herberto Graça — DDD, Hexagonal, Onion, Clean, CQRS… how I put it all together.**
  https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/
- **NDepend — Onion Architecture: Going Beyond Layers.**
  https://blog.ndepend.com/onion-architecture-layers/
- **tms-outsource — What Is Onion Architecture? Structuring Code from the Core Out.**
  https://tms-outsource.com/blog/posts/onion-architecture/
- **DZone — Onion Architecture Is Interesting.**
  https://dzone.com/articles/onion-architecture-is-interesting
- **theCodeReaper — The Onion Architecture.**
  https://thecodereaper.com/2020/05/02/the-onion-architecture/
- **takt.dev — Onion (dependency-rule layered) pattern tutorial.**
  https://takt.dev/design-pattern/architecture/structural/layered/dependency-rule-layered/onion
- **Wikipedia — Hexagonal architecture (software).**
  https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)

## B. Onion / Clean architecture in Node.js + TypeScript

- ⭐ **André Bazaglia — Clean architecture with TypeScript: DDD, Onion.**
  https://bazaglia.com/clean-architecture-with-typescript-ddd-onion/
- **Sankhadip Samanta — Onion Architecture in Node.js with TypeScript.**
  https://sankhadip.medium.com/onion-architecture-in-node-js-with-typescript-5508612a4391
- **Remo Jansen (DEV) — Implementing SOLID and the Onion Architecture in Node.js with TypeScript and InversifyJS.**
  https://dev.to/remojansen/implementing-the-onion-architecture-in-nodejs-with-typescript-and-inversifyjs-10ad
- **Remo Jansen (Wolk Software, same article, original host).**
  http://blog.wolksoftware.com/implementing-solid-and-the-onion-architecture-in-node-js-with-typescript-and-inversifyjs
- **Remo Jansen (DEV) — Enforce Clean Architecture with fresh-onion.**
  https://dev.to/remojansen/enforce-clean-architecture-in-your-typescript-projects-with-fresh-onion-45pi
- **Melzar — onion-architecture-boilerplate (Node / Express / TS).**
  https://github.com/Melzar/onion-architecture-boilerplate
- **JeffMangan — typescript-onion.**
  https://github.com/JeffMangan/typescript-onion
- **freeCodeCamp — A TypeScript Stab at Clean Architecture.**
  https://www.freecodecamp.org/news/a-typescript-stab-at-clean-architecture-b51fbb16a304/
- **Rajesh Chaudhari — Onion Architecture in Node.js.**
  https://medium.com/@myjob.rajesh/onion-architecture-in-node-js-05a475ada097

## C. Hexagonal / Ports & Adapters (TS) — closest to `adapters/*` + `@devdigest/shared`

- ⭐ **Sairyss — Domain-Driven Hexagon** (reference repository).
  https://github.com/Sairyss/domain-driven-hexagon
  · README: https://github.com/Sairyss/domain-driven-hexagon/blob/master/README.md
  · DEV writeup: https://dev.to/sairyss/domain-driven-hexagon-18g5
- ⭐ **marcoturi — fastify-boilerplate** (Fastify 5 + clean architecture + DDD + CQRS).
  https://github.com/marcoturi/fastify-boilerplate
- **generalistprogrammer — Hexagonal Architecture: Complete Guide with a TypeScript Example (2026).**
  https://generalistprogrammer.com/tutorials/hexagonal-architecture-complete-guide
- **Walid Karray — Building a Todo App with TypeScript using Clean Hexagonal Architecture.**
  https://medium.com/@walid.karray/building-a-todo-app-with-typescript-using-clean-hexagonal-architecture-a-detailed-look-at-the-d9e177f9f31
- **Christian Inyekaka — Building a REST API: A Hexagonal Approach with TypeScript, TypeORM, PostgreSQL, JWT.**
  https://medium.com/@christianinyekaka/building-a-rest-api-a-hexagonal-approach-with-typescript-typeorm-postgresql-and-jwt-946d372860ee
- **FuryBee — Hexagonal Architecture Explained.**
  https://code.furybee.org/articles/hexagonal-architecture/
- **Carlos Cunha (Better Programming) — Ports and Adapters with TypeScript.**
  https://betterprogramming.pub/how-to-ports-and-adapter-with-typescript-32a50a0fc9eb
- **GitHub Topics — hexagonal-architecture (TypeScript).**
  https://github.com/topics/hexagonal-architecture?l=typescript
- **mcpmarket — Hexagonal TypeScript Claude Code Skill** (prior-art for the skill format; do not copy).
  https://mcpmarket.com/tools/skills/hexagonal-architecture-for-typescript

## D. Drizzle + Repository pattern → `repository.ts`

- ⭐ **vimulatus — Repository Pattern with Drizzle ORM.**
  https://medium.com/@vimulatus/repository-pattern-in-nest-js-with-drizzle-orm-e848aa75ecae
- ⭐ **cosmicpython — Repository Pattern** (Architecture Patterns with Python, ch. 2 — language-agnostic).
  https://www.cosmicpython.com/book/chapter_02_repository
- ⭐ **Microsoft Learn — Designing the infrastructure persistence layer (DDD/CQRS).**
  https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-design
- **Sentry Blog — Atomic Repositories in Clean Architecture and TypeScript.**
  https://blog.sentry.io/atomic-repositories-in-clean-architecture-and-typescript/
- **João Batista da Silva — Transactions with DDD and Repository Pattern in TypeScript (Part 2).**
  https://medium.com/@joaojbs199/transactions-with-ddd-and-repository-pattern-in-typescript-a-guide-to-good-implementation-part-2-da0af3e10901
- **Drizzle ORM — official docs.**
  https://orm.drizzle.team/
- **SoftwareMill — 5 Reasons to Choose Drizzle ORM.**
  https://softwaremill.com/5-reasons-to-choose-drizzle-orm-over-traditional-javascript-orms/
- **Reza Owliaei (gist) — Vertical Slicing & Clean Architecture.**
  https://gist.github.com/RezaOwliaei/477ed74fc77aa5df2a854789538dd79d

## E. Enforcement via dependency-cruiser → `enforcement.md`

- ⭐ **dependency-cruiser — rules-reference** (official).
  https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md
  · repo: https://github.com/sverweij/dependency-cruiser
- ⭐ **Khalil Stemmler — The Dependency Rule.**
  https://khalilstemmler.com/wiki/dependency-rule/
- ⭐ **AtomicObject — Dependency Cruiser: Restrict Imports in JavaScript.**
  https://spin.atomicobject.com/dependency-cruiser-imports/
- **Ken Miyashita (Better Programming) — Validate Dependencies According to Clean Architecture.**
  https://betterprogramming.pub/validate-dependencies-according-to-clean-architecture-743077ea084c
- **Synapse Studios — Dependency Cruiser Configuration (Clean Architecture / DDD).**
  https://docs.synapsestudios.com/implementation/frameworks/nest/dependency-cruiser-config
- **Jacob Andrewsky (DEV) — Avoid Cross Module Dependencies with Dependency Cruiser.**
  https://dev.to/jacobandrewsky/avoid-cross-module-dependencies-with-dependency-cruiser-3b0b
- **Stefanos Lignos — Three Ways to Enforce Module Boundaries in an Nx Monorepo.**
  https://www.stefanos-lignos.dev/posts/nx-module-boundaries
- **jmulholland — 6 Tools for Enforcing Good Web Architecture.**
  https://jmulholland.com/architecture-tools/

## F. Zod / boundary validation → `@devdigest/shared` (core contracts)

- ⭐ **cekrem — Parse, Don't Validate — In a Language That Doesn't Want You To (TypeScript).**
  https://cekrem.github.io/posts/parse-dont-validate-typescript/
- **LogRocket — When to use Zod, TypeScript, or both.**
  https://blog.logrocket.com/when-use-zod-typescript-both-developers-guide/
- **LogRocket — Schema validation in TypeScript with Zod.**
  https://blog.logrocket.com/schema-validation-typescript-zod/
- **Zod — repository & docs.**
  https://github.com/colinhacks/zod · API: https://zod.dev/api
- **Zod discussion #962 — parse vs validate.**
  https://github.com/colinhacks/zod/discussions/962
- **cekrem — ArkType: the Parse-Don't-Validate sequel.**
  https://cekrem.github.io/posts/arktype-parse-dont-validate-sequel/
- **Convex stack — Zod with TypeScript for server-side validation and end-to-end types.**
  https://stack.convex.dev/typescript-zod-function-validation
- **DEV (young_gao) — Zod vs Joi vs Class-Validator (2026).**
  https://dev.to/young_gao/input-validation-in-typescript-apis-zod-vs-joi-vs-class-validator-2gcg

## G. Dependency Injection / composition root → `container.ts`

- ⭐ **Martin Fowler — Dependency Composition.**
  https://martinfowler.com/articles/dependency-composition.html
- ⭐ **thetshaped.dev — Dependency Injection in Node.js & TypeScript (the part nobody teaches).**
  https://thetshaped.dev/p/dependency-injection-in-nodejs-and-typescript-dependency-inversion-part-no-body-teaches-you
- **oneuptime — How to Create a Dependency Injection Container in TypeScript.**
  https://oneuptime.com/blog/post/2026-01-30-typescript-dependency-injection-container/view
- **Vahid Najafi — Implement a Dependency Injection Container from Scratch.**
  https://medium.com/@vahid.vdn/implement-a-dependency-injection-container-from-scratch-7092c8a0ae7a
- **GameChanger — Dependency Injection in TypeScript with tsyringe.**
  https://tech.gc.com/dependency-injection/
- **LogRocket — Top 5 TypeScript dependency injection containers.**
  https://blog.logrocket.com/top-five-typescript-dependency-injection-containers/
