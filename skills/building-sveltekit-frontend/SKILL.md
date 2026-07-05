---
name: building-sveltekit-frontend
description: Provides architecture and engineering patterns for SvelteKit BFF frontend projects. Triggered when scaffolding, building, or reviewing SvelteKit features, loaders, stores, or openapi-fetch clients. Enforces layer separation and orchestrates services via controllers.
---

# SvelteKit SWE Skill

Opinionated architecture for production SvelteKit BFF projects. Every layer has a job — stay in your lane.

## Reference files

Read these when working in the relevant area:

- `references/layers.md` — Full layer-by-layer guide with patterns and anti-patterns
- `references/openapi.md` — openapi-fetch + openapi-typescript setup and typed client patterns
- `references/error-handling.md` — Service errors, loader/action errors, error boundaries
- `references/patterns-examples.md` — Full code examples for all layers

---

## Blueprint

IMPORTANT: ask the user if they want you to start coding or explicitly invoke the `planning-features` skill to write a detailed plan.

## Architecture Overview

```
Browser
  └── +page.svelte          # UI only. No service calls. Reads $props, writes to stores.
        └── stores/          # Client-side singletons. $state fields. Populated from loader data.

SvelteKit Server
  ├── hooks.server.ts        # Auth only — attach locals.user. No business logic.
  ├── +layout.server.ts      # Session-level data available to all routes
  ├── +page.server.ts        # load() and actions. No business logic — delegates to controller/service.
  │     └── AppFactory       # Assembles concrete implementations
  │           └── Controller # Orchestrates multiple services. Has DI (interface-typed deps).
  │                 └── Service(s)   # One concern each. Wraps API client. Returns domain models.
  │                       └── openapi-fetch client  # Typed HTTP calls via generated schema
  │
  └── lib/
        ├── models/          # Shared TS interfaces used across all layers
        ├── services/        # IServiceName interface + ServiceName implementation
        ├── controllers/     # Controller classes with injected service interfaces
        ├── factories/       # AppFactory — concrete assembly, no DI
        └── stores/          # Client-side $state singletons
```

---

## Layer Rules (quick reference)

| Layer             | Can do                                                                             | Cannot do                                   |
| ----------------- | ---------------------------------------------------------------------------------- | ------------------------------------------- |
| `+page.svelte`    | Render, read `$props`, write to stores, call `enhance`                             | Import services, call fetch, business logic |
| `+page.server.ts` | Load data, handle form actions, call controllers/services, `error()`, `redirect()` | Business logic, direct API calls            |
| `hooks.server.ts` | Set `locals.user`, validate session token                                          | Business logic, data fetching               |
| Controller        | Orchestrate multiple services, map to loader-friendly shape                        | Direct API calls, HTTP concerns             |
| Service           | Wrap API client, map responses to models, throw domain errors                      | Orchestration, SvelteKit concerns           |
| Factory           | Instantiate concrete classes, wire dependencies                                    | Logic of any kind                           |
| Store             | Hold reactive client state, expose methods to mutate                               | Server calls, business logic                |

---

## File Naming & Location

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
├── factories/
│   └── AppFactory.ts       # one file, static methods
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

`chisel-js` is the deterministic counterpart of this skill. Each rule below is owned by this skill — `chisel-js explain <rule-id>` prints fix guidance, and `chisel-js check .` flags violations. The paired UI skill (`designing-svelte-ui`) owns the colour/component/responsiveness rules listed in its own SKILL.md.

### Structural (SvelteKit runtime invariants)
- `structural:console-log-banned` — `console.*` banned in `.svelte`/`.ts` outside `scripts/`.
- `structural:timers-banned` — `setTimeout`/`setInterval` banned in `.svelte` and `$lib/`.
- `structural:inline-style-banned` — inline `style=` outside `components/ui/`.
- `structural:style-block-banned` — `<style>` blocks banned outside `app.css` and `components/ui/`.
- `structural:app-stores-banned` — `import from "$app/stores"` (use `$app/state`).
- `structural:writable-banned` — Svelte 4 `writable()`/`readable()` (use `$state`).
- `structural:inline-svg-banned` — Inline `<svg>` with >2 child elements outside `components/`.
- `structural:effect-no-cleanup` — `$effect` without `return () => {}` cleanup.
- `structural:effect-single-call` — `$effect` that only calls a single function with no reactive deps (use `onMount`).
- `structural:effect-present` — Any `$effect` warrants review (warning).
- `structural:onmount-no-browser-api` — `onMount` without `localStorage`/`sessionStorage`/DOM ref/WebSocket.
- `structural:store-should-use-derived` — `$effect` syncing `data`/`$props` into `$state` (use `$derived`).
- `structural:derived-calls-fetch` — `$derived` calling `fetch` or a service method.
- `structural:raw-fetch` — Raw `fetch` in `services/` (use the `openapi-fetch` client). Suppress with `// noqa: raw-fetch — <reason>`.
- `structural:missing-service-interface` — Concrete service without `I<ServiceName>` interface.
- `structural:factory-static-only` — `AppFactory` (and any `*Factory.ts` / `/factories/` file) must use static methods only.
- `structural:hooks-locals-limited` — `hooks.server.ts` may set only `locals.user`.

### Import boundaries
- `import-boundary:*` — services/controllers/routes/stores only import what their row of the Constraints table permits. See `references/layers.md`.

### Complexity
- `complexity:page-loc-limit` — `+page.svelte` > 100 LoC (hard error).
- `complexity:page-loc-warning` — `+page.svelte` > 80 LoC (warning, suppressible).
- `complexity:controller-loc-limit` — Controller method > 40 LoC.
- `complexity:loader-loc-limit` — `load`/form action > 20 LoC.

### API endpoints
- `api:request-handler-outside-api` — `RequestHandler` export outside `src/routes/api/`.
- `api:route-count-ratio` — API routes exceed 20% of page routes (warning).

### Concurrency
- `concurrency:promise-all-warning` — `Promise.all` across services in a loader (use a controller).

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
Inline `// noqa: rule-id — <reason>` (TypeScript) or `<!-- noqa: rule-id — <reason> -->` (Svelte). A suppression without a reason string fails the check.
