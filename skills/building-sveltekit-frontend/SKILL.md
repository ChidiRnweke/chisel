---
name: building-sveltekit-frontend
description: Provides architecture and engineering patterns for SvelteKit projects, both standalone SSR apps that own their data layer via Drizzle and BFF frontends over a separate API. Triggered when scaffolding, building, or reviewing SvelteKit features, loaders, remote functions, repositories, stores, or openapi-fetch clients. Enforces layer separation and orchestrates services via controllers.
---

# SvelteKit SWE Skill

Opinionated architecture for production SvelteKit projects. Every layer has a job — stay in your lane.

## First: which topology?

The layering discipline is identical either way. What differs is what sits
at the bottom of the stack.

| Mode | Bottom of the stack | Tell |
| --- | --- | --- |
| **Standalone SSR** | `repositories` under `$lib/server`, querying Drizzle | `drizzle-orm` dependency, a `src/lib/server/` directory |
| **BFF** | A generated `openapi-fetch` client | `openapi-fetch` dependency, a generated `schema.d.ts` |

Check `chisel.config.json` for `"mode"`. If there is none, run
`chisel-js init`, which detects it and writes the file.

Everything else — no business logic in loaders, controllers for
multi-service orchestration, stores for client state, factories with no
logic — applies unchanged in both.

## Reference files

Read these when working in the relevant area:

- `references/layers.md` — Full layer-by-layer guide with patterns and anti-patterns
- `references/openapi.md` — **BFF only.** openapi-fetch + openapi-typescript setup and typed client patterns
- `references/error-handling.md` — Service errors, loader/action errors, error boundaries
- `references/patterns-examples.md` — Full code examples for all layers

---

## Blueprint

IMPORTANT: ask the user if they want you to start coding or explicitly invoke the `planning-features` skill to write a detailed plan.

## Architecture Overview — standalone SSR

```
Browser
  └── +page.svelte          # UI only. No service calls. Reads $props, writes to stores.
        ├── stores/          # Client-side singletons. $state fields. Populated from loader data.
        └── client/          # Browser-only adapters: IndexedDB, transports, Svelte hooks

SvelteKit Server
  ├── hooks.server.ts        # Auth only — attach locals.user. No business logic.
  ├── +layout.server.ts      # Session-level data available to all routes
  ├── +page.server.ts        # load() and actions. Delegates to a controller.
  ├── lib/remote/*.remote.ts # Remote functions. The other entry point; same rules as a loader.
  │     └── AppFactory       # Assembles concrete implementations. Lives under $lib/server.
  │           └── Controller # Orchestrates multiple services. Has DI (interface-typed deps).
  │                 └── Service(s)     # One concern each. Returns domain models.
  │                       └── Repository  # Drizzle queries. Under $lib/server. Returns domain models.
  │
  └── lib/
        ├── models/          # Shared domain types. Universal — the UI consumes them.
        ├── errors.ts        # Universal
        ├── utils.ts         # Universal pure functions
        ├── components/      # Client
        ├── stores/          # Client-side $state singletons
        ├── client/          # Browser-only adapters
        ├── remote/          # *.remote.ts — server body, client-callable stub
        └── server/          # EVERY server-side layer lives here
              ├── db/              # Drizzle schema and connection (part of repositories)
              ├── repositories/    # Persistence. The only place Drizzle is importable.
              ├── services/        # One concern each. Wraps a capability, returns models.
              ├── controllers/     # Orchestrates services. DI via interface-typed deps.
              ├── config.ts
              └── app-factory.ts   # Concrete assembly, no logic
```

**`$lib/server/<name>/` *is* layer `<name>`.** Nothing is server-only by
convention, only by location — and SvelteKit refuses to bundle that subtree for
the client, so a component importing a service is a *build* error rather than
merely a lint finding. A folder under `server/` that is not a layer name is a
structure error: an adapter for an external capability (an AI client, a PDF
generator, a mail sender) is a **service**, because it wraps one concern and
returns domain models. Repositories are persistence.

`models`, `errors` and `utils` stay universal. They are pure data and pure
functions, and a remote function's return type flows straight into the UI.

**The rule that catches most mistakes:** anything under `$lib/server`, and
anything named `*.server.ts` or `*.remote.ts`, is server-only. It may be
imported *only* from another server-only module. A `.svelte` component or a
universal `+page.ts` reaching into it is a hard error
(`server-layer-leak:client-reachable-import`) — note that a `+page.ts` is
**not** server-only even when a `+page.server.ts` sits beside it. Use
`import type` when you only need the shape; type imports are erased and
don't leak.

## Architecture Overview — BFF

Identical, minus the server data layer: a service wraps the generated API
client instead of calling a repository.

```
+page.server.ts
  └── AppFactory       # Assembles concrete implementations
        └── Controller # Orchestrates multiple services
              └── Service(s)   # One concern each. Wraps API client. Returns domain models.
                    └── openapi-fetch client  # Typed HTTP calls via generated schema
```

---

## Layer Rules (quick reference)

| Layer             | Can do                                                                             | Cannot do                                   |
| ----------------- | ---------------------------------------------------------------------------------- | ------------------------------------------- |
| `+page.svelte`    | Render, read `$props`, write to stores, call `enhance`                             | Import services, controllers, repositories, the factory, or anything server-only |
| `+page.ts` (universal) | Client-safe transforms of loader data                                         | Import anything server-only — it runs in the browser too |
| `+page.server.ts` | Load data, handle form actions, build from the factory, `error()`, `redirect()`    | Business logic, importing services or repositories directly |
| `*.remote.ts`     | Same as a server loader; the other entry point                                     | Business logic, importing services or repositories directly |
| `hooks.server.ts` | Set `locals.user`, validate session token                                          | Business logic, data fetching               |
| Controller        | Orchestrate multiple services, map to loader-friendly shape                        | Call another controller, touch repositories, know about SvelteKit |
| Service           | One concern. Call repository interfaces, map to models, throw domain errors        | Call another service, import Drizzle, import `@sveltejs/kit` |
| Repository        | Drizzle queries, map rows to domain models                                         | Import services/controllers/factory; let an ORM type escape |
| Factory           | Instantiate concrete classes, wire dependencies                                    | Logic of any kind — no `if`/`for`/`try`     |
| Store             | Hold reactive client state, expose methods to mutate                               | Server calls, business logic, importing controllers |
| `client/`         | Browser-only adapters (IndexedDB, transports, hooks)                               | Import any server layer                     |

Dependency direction, one way only:

```
components / stores / client  →  routes + remote  →  factory  →  controllers  →  services  →  repositories  →  Drizzle
```

### Never import on the same level

The core spine — `models`, `services`, `controllers`, `factory` — never imports
sideways. **One service never imports another. One controller never imports
another. A model never imports another model.**

When two services need the same type, that type is domain data: **move it to
`$lib/models`**. Service-local data is fine, but no other service may reach for
it. When two services need the same *behaviour*, that is what a controller is
for.

### Laying out `$lib/models`

One file per domain, each self-contained, barrelled through `index.ts`:

```
src/lib/models/
├── notes.ts        NoteId, Note, NoteRevision — the type lives with its model
├── agent-runs.ts   AgentRunId, AgentRun
├── todos.ts        TodoId, Todo
└── index.ts        export * from './notes'; export * from './agent-runs'; …
```

Consumers import from the barrel: `import type { Note } from '$lib/models'`.

**Do not create a `shared.ts`** holding branded IDs or common aliases for every
domain to import. It looks like DRY and is actually a dependency graph inside
the layer that is supposed to have none — and the barrel cannot rescue it,
because `index.ts` re-exporting `shared` still leaves `agent-runs.ts` importing
it directly. `NoteId` belongs in `notes.ts` next to `Note`.

The only same-level import allowed anywhere is an `index.ts` barrel at a layer
root re-exporting that layer — it declares the layer's public surface rather
than coupling two siblings.

Components, stores and client adapters are exempt: a Card using a Badge is how
UI works.

---

## File Naming & Location

Standalone SSR. In BFF mode, drop `server/` and put `AppFactory.ts` in
`lib/factories/`.

```
src/lib/
├── models/
│   ├── User.ts
│   ├── Recipe.ts
│   └── index.ts            # barrel export
├── services/
│   ├── IRecipeService.ts   # interface
│   ├── RecipeService.ts    # implementation
│   └── index.ts
├── controllers/
│   ├── RecipeController.ts
│   └── index.ts
├── server/                 # server-only; unreachable from the client bundle
│   ├── AppFactory.ts       # one file, static methods
│   ├── db/
│   │   └── schema.ts       # Drizzle schema
│   └── repositories/
│       └── PostgresRecipes.ts
├── remote/
│   └── recipes.remote.ts   # the .remote.ts suffix is what defines this layer
└── stores/
    ├── recipeStore.ts
    └── uiStore.ts

src/routes/
├── hooks.server.ts
├── +layout.server.ts
├── +layout.svelte
└── recipes/
    ├── +page.server.ts
    ├── +page.svelte
    └── +error.svelte
```

---

## Code Examples

For full code examples of the architecture layers in practice, please read:
- **`references/patterns-examples.md`** — Examples for Models, Services, Controllers, Factory, and Stores.

---

## For detailed patterns, read:

- **Setting up openapi-fetch + typed client** → `references/openapi.md`
- **Error handling across all layers** → `references/error-handling.md`
- **Full layer guide with more examples** → `references/layers.md`

## Validation Checklist

Before concluding any implementation task, copy this checklist into your response scratchpad to track your progress:
- [ ] Run the type-checker (`pnpm svelte-check`).
- [ ] Run the linter (`pnpm lint`).
- [ ] Run tests if applicable.
- [ ] If errors occur, autonomously fix them and repeat the loop until the checks pass. Do not ask the human to fix your structural or typing errors.

## Enforced Rule IDs

`chisel-js` is the deterministic counterpart of this skill. Each rule below is owned by this skill — `chisel-js explain <rule-id>` prints fix guidance, and `chisel-js check .` flags violations. The paired UI skill (`designing-svelte-ui`) owns the colour and component rules listed in its own SKILL.md.

### Structural

Deliberately small. The `$effect`/`onMount`/`writable`/timers rules were removed: they encoded a position on Svelte reactivity rather than on layering or the design system, and argued with working code. Svelte idiom is the compiler's business.

- `structural:inline-style-banned` — inline `style=` outside `components/ui/`.
- `structural:style-block-banned` — `<style>` blocks banned outside `app.css` and `components/ui/`.
- `structural:missing-service-interface` — Concrete service without `I<ServiceName>` interface.
- `structural:factory-contains-logic` — a factory contains an if/for/while/switch/try/ternary. Instance methods are fine; deciding things is not.
- `structural:hooks-locals-limited` — `hooks.server.ts` may set only `locals.user`.

### Import boundaries

These are checked against a real import graph: `$lib` and relative specifiers are resolved through your tsconfig, so violations carry the actual file and line.

- `import-boundary:banned-layer-import` — an import crossed a layer boundary in a banned direction. See the dependency-direction diagram above.
- `import-boundary:layer-no-internal-imports` — a pure layer (`models`, `errors`, `config`) imported another internal layer.
- `import-boundary:orm-leak` — Drizzle imported outside the repository layer.
- `import-boundary:framework-leak` — `@sveltejs/kit` imported by a layer that must stay framework-agnostic.
- `import-boundary:server-only-specifier` — `$app/server` or a private `$env/*` entry point imported from a client-reachable module.
- `import-boundary:api-client-location` — **BFF only.** The generated API client constructed outside the factory.
- `import-boundary:unresolved-import` — a specifier that resolves to no file. Broken, and it hides layer violations behind an edge the graph cannot follow.

### Server-only placement
- `server-layer-leak:client-reachable-import` — a client-reachable module imported something under `$lib/server` or a `*.server.ts` / `*.remote.ts` file. Move the work server-side, or use `import type` if you only need the shape.

### Structure
- `structure:layer-outside-server` — a server-side layer at a universal path (`src/lib/services/`). Move it under `$lib/server/`. Reported once per directory.
- `structure:unknown-server-folder` — a folder under `$lib/server/` that is not a layer name. `$lib/server/` holds `db/`, `repositories/`, `services/`, `controllers/`, `factories/`, `config.ts` and the factory. An external-capability adapter is a service, not a repository. Reported once per folder.
- `structure:unclassified-module` — a `src/lib/` module that matches no canonical layer location (warning). Ad-hoc folders get no boundary rules of their own, so give it a home.

Wiring may stay flat at the server root or be grouped under `factories/` with subfolders beneath it. Group it once a handful of factory modules have accumulated and the directory listing has stopped reading as architecture.

### Topology
- `topology:layer-barrel-import` — importing a layer root (`$lib/models`) instead of a domain (`$lib/models/notes`). A layer-wide barrel makes every consumer depend on everything. A *domain's* own `index.ts` remains the sanctioned entry point.
- `topology:deep-feature-import` — a cross-feature import reaching past a component feature's `index.ts` into its internals. A feature is a folder under `$lib/components/` that publishes an entry point; that entry point is its contract. Within a feature, relative imports are fine.
- `topology:generic-bucket-directory` — a directory named `misc/`, `common/`, `helpers/`, `pages/` or `panels/`. A name that describes nothing collects anything. Reported once per directory.
- `topology:composition-root-concrete-import` — `$lib/server/application.ts` importing a concrete service or repository. `import type` is fine; it is erased.
- `topology:composition-root-construction` — the composition root constructing something other than a factory.
- `topology:composition-root-placeholder` — `undefined as unknown as T` or a `LateValue` in the composition root. A placeholder means two objects need each other; restructure rather than park one.
- `topology:factory-shape` — a `*-factory.ts` under `factories/` that does not export exactly one value. Exported types do not count.

### Coherence
- `coherence:empty-test-glob` — an `include` pattern in the vitest/vite config that matches no files. This is the "ran zero tests and passed" failure: the suite silently shrinks while CI stays green.
- `coherence:broken-doc-path` — a backtick-quoted `src/`, `tests/` or `scripts/` path in root or `docs/` markdown that does not exist. Generated reference output is excluded.

### Bundle budget
- `bundle:oversized-app-chunk` — an emitted client chunk over 500 kB that contains application code. Vendor-only chunks are tolerated. Not part of `check`: run `chisel-js bundle` after a production build, since it reads what the bundler emitted.

### Route style
- `route-style:prefer-remote-function` — a `+server.ts` serving your own UI (warning). A remote function keeps types across the wire and needs no URL. Genuinely-HTTP routes (OAuth callbacks, webhooks, SSE, downloads, protocol endpoints) are detected and exempt.

### API endpoints (BFF mode only)
- `api:request-handler-outside-api` — `RequestHandler` export outside `src/routes/api/`.
- `api:route-count-ratio` — API routes exceed 20% of page routes (warning).

These do not run in `sveltekit-standalone` mode, where `+server.ts` endpoints and remote functions are normal.

### Error flow
- `error-flow:raw-http-status` — Raw HTTP status outside `error_handlers` / API `+server.ts` JSON return. API routes under `src/routes/api/**/+server.ts` may `return json(payload, { status })`.

### Project structure
- `project-structure:*` — `pnpm`-only, `frontend/.env` / `backend/.env` separation, etc. (see `constraints.md` §5).

### Tests (paired with `qa` skill)
- `test-structure:test-file-location` — Tests must live under `tests/unit/`, `tests/integration/`, or `tests/e2e/`.
- `test-structure:test-naming` — Names must describe the invariant (`test_cannot_X`, `test_returns_Y_when_Z`).
- `test-structure:one-assert-per-test` — Exactly one `expect` per test.
- `test-structure:mocking-banned` — `jest.mock`, `vi.mock`, `spyOn` banned — write a fake.
- `test-structure:skip-without-reason` — `test.skip` requires a `reason`.

### Suppression
Inline `// chisel-ignore rule-id -- <reason>` (TypeScript) or `<!-- chisel-ignore rule-id -- <reason> -->` (Svelte), on the offending line or the line above it. `// chisel-ignore-file rule-id -- <reason>` in the first five lines covers a whole file.

A suppression without a reason suppresses nothing: the original violation stands and `suppression:missing-reason` is added on top of it.
