---
name: building-sveltekit-frontend
description: Provides architecture and engineering patterns for full-stack SvelteKit applications that use remote functions, Drizzle and a layered server (models, services, repositories, controllers, factories). Triggered when scaffolding, building, or reviewing SvelteKit features, remote functions, loaders, stores, browser controllers, or server layers. Enforces layer separation and the import direction in AGENTS.md.
---

# SvelteKit Full-Stack Skill

Opinionated architecture for one SvelteKit application that owns its UI, its server logic and its
database. Every layer has a job — stay in your lane. `AGENTS.md` holds the project's layout table;
this skill explains how to write each layer.

## Reference files

Read these when working in the relevant area:

- `references/layers.md` — Layer-by-layer guide with rules and anti-patterns
- `references/error-handling.md` — Domain errors, the remote-function boundary, error boundaries
- `references/patterns-examples.md` — Code examples for every layer

---

## Blueprint

IMPORTANT: ask the user whether to start coding or to invoke the `planning-features` skill to write a detailed plan. Read the ADRs in
`docs/decisions/` that may cover the area before you change its structure.

## Architecture Overview

```
Browser
  ├── components/            # Render and interact. Call remote functions directly.
  ├── stores/                # $state singletons. Reactive state only — no fetching.
  ├── controllers/           # Only where the browser sequences work itself (offline replica, uploads, exports).
  └── client/                # Browser-only helpers: IndexedDB, storage readers, drag payloads.

Entry points (the only way in)
  ├── remote/<domain>/       # query / command / form, schema-validated. The sole UI→server seam.
  ├── routes/**/+server.ts   # Public HTTP API and webhooks only.
  └── hooks.server.ts        # Resolve the session and build the per-request application.

Server (src/lib/server/)
  ├── application.ts         # Composition root: builds the per-request graph from factories.
  ├── factories/             # Construct and wire. No logic.
  ├── controllers/<domain>/  # Complete operations: sequence services, own transactions.
  ├── services/<domain>/     # One cohesive capability: rules + the I/O it owns.
  ├── repositories/<domain>/ # Persistence only. Drizzle rows in, domain models out.
  └── db/                    # Drizzle schema and client.

Shared (browser and server)
  ├── models/<domain>/       # Values, types, schemas, constructors. No behaviour.
  └── services/<domain>/     # Pure business rules both sides use. No I/O.
```

A request flows one way: component → remote function (parse) → controller → services →
repositories → database. Nothing calls back up.

---

## Layer Rules (quick reference)

| Layer              | Can do                                                                 | Cannot do                                                 |
| ------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------- |
| Component          | Render, handle input, read stores, call remote functions               | Import server code, assemble multi-step workflows         |
| Store              | Hold `$state`, expose methods that change it                           | Fetch, call remote functions, make business decisions     |
| Browser controller | Sequence local work (replica, outbox, upload, export)                  | Wrap a single remote call, call another controller        |
| Remote function    | Parse input with a schema, call one controller operation, shape result | Business rules, call several operations, touch the DB     |
| `hooks.server.ts`  | Resolve the session, bind the actor into the request's application     | Business logic, data fetching                             |
| Controller         | Sequence services, own a transaction                                   | Import repositories, call other controllers, parse input  |
| Service            | Enforce rules, use its own repositories and providers                  | Call other services, know about HTTP or SvelteKit         |
| Repository         | Read and write rows, map them to domain models                         | Business rules, decisions over other domains' tables      |
| Factory            | Construct concrete classes, wire interface-typed dependencies          | Logic of any kind, workflows, branching on business state |
| Model              | Types, schemas, value constructors                                     | Behaviour, I/O, imports from other layers                 |

---

## File Naming & Location

```
src/lib/
├── models/recipes/recipe.ts                 # Recipe type + schema
├── services/recipes/servings.ts             # Pure rule shared by browser and server
├── server/
│   ├── application.ts
│   ├── factories/recipes-factory.ts
│   ├── controllers/recipes/controller.ts    # RecipesController interface + implementation
│   ├── services/recipes/recipe-service.ts   # RecipeService + its capability interfaces
│   ├── repositories/recipes/recipe-repository.ts
│   └── db/schema.ts
├── remote/recipes/recipes.remote.ts         # query / command / form
├── stores/recipes/filter.svelte.ts
├── components/ui/                           # Vendored shadcn-svelte primitives (ours to edit)
├── components/recipes/RecipeCard.svelte
└── testing/in-memory-recipe-repository.ts   # Fakes for tests

src/hooks.server.ts                          # Session → per-request application

src/routes/
├── layout.css                               # Tailwind entry + design tokens
├── +layout.svelte
└── recipes/
    ├── +page.svelte
    └── +error.svelte
```

Import through the `#lib/*` subpath alias (or `$lib/*`), never with long relative paths across layers.

---

## Core rules

- **Parse at the boundary; inside, types are total.** Remote functions parse with a schema from
  `models/`. Repositories parse the rows they read. Nothing inward re-validates.
- **Services never call services.** If one needs another, recut the capability or sequence both
  in a controller.
- **The server is stateless.** State lives in a value inside one operation or in a database row.
  No module-level caches or registries holding request data.
- **The actor is bound at composition.** `hooks.server.ts` builds the request's application for
  the signed-in user. Methods do not take a user parameter. Work across all users uses a separate
  system composition.
- **Dependencies are interfaces.** Never type a dependency as a concrete class.
- **Components call remote functions directly.** A browser controller exists only where the
  browser itself sequences work.
- **Fail loudly.** No silent `catch`. A caught failure is rethrown or returned as an explicit
  failure value the caller must read.

---

## Code Examples

For full code examples, read `references/patterns-examples.md`. For error flow, read
`references/error-handling.md`. For the full layer guide, read `references/layers.md`.

## Validation Checklist

Before concluding any implementation task, copy this checklist into your scratchpad:

- [ ] Run the type-checker (`pnpm check`).
- [ ] Run the linter (`pnpm lint`).
- [ ] Run the unit tests (`pnpm test:unit --run`).
- [ ] Check new imports follow the direction in `AGENTS.md`.
- [ ] If errors occur, fix them and repeat until the checks pass. Do not ask the human to fix your
      structural or typing errors.
