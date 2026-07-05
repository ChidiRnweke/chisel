---
title: Constraints spec
description: The canonical architectural rules both checkers implement. Mirrors constraints.md at the repo root.
sidebar:
  order: 2
tableOfContents:
  minHeadingLevel: 2
  maxHeadingLevel: 3
---

:::note[Source of truth]
This page is a rendered copy of [`constraints.md`](https://github.com/ChidiRnweke/chisel/blob/master/constraints.md) at the repo root. Edit it there — the docs site refreshes automatically on build.
:::

# Architectural Constraints

## 1. 🐍 Python Backend

### Import Boundaries

| Layer | Allowed imports | Banned imports |
|---|---|---|
| `models/` | nothing | everything |
| `errors.py` | nothing | everything |
| `config.py` | stdlib, third-party only | all internal layers |
| `services/` | `models/`, repository Protocols, `errors` | other services, `sqlalchemy`, `fastapi`, `starlette`, `controllers`, `factory`, `config` |
| `repositories/` | `models/`, `errors`, ORM models (internal only) | `services`, `controllers`, `fastapi`, `config` |
| `controllers/` | service Protocols/concrete services for workflow composition, `models/`, `errors` | `fastapi`, `starlette`, `sqlalchemy`, `config`, other controllers |
| `factory.py` | concrete implementations for app/checker construction, `sqlalchemy.ext.asyncio` session types | nothing banned, but must contain zero logic |
| `routes/` | `factory`, `models`, `fastapi` | `services`, `repositories`, `sqlalchemy` |
| `dependencies.py` | `factory`, `models`, `fastapi`, `config`, `sqlalchemy.ext.asyncio.AsyncSession` for request-scoped session wiring | `services`, `repositories`, raw SQLAlchemy query APIs |
| `app.py` | `fastapi`, `routes`, `dependencies`, `error_handlers`, `config` | domain service/repository/controller assembly |
| `error_handlers.py` | `errors`, `fastapi`, `starlette` | domain layers |

- ORM types (`*ORM`) never imported outside `repositories/` — including `repositories/orm/`
- `AsyncSession` / `sqlalchemy` never imported in `services/` or `controllers/`
- `HTTPException`, `status_code` never appear outside `error_handlers.py`
- `os.getenv()` called only in `config.py`
- `fastapi` imported only in `app.py`, `routes/`, `dependencies.py`, `error_handlers.py`
- Concrete service classes imported only in `factory.py` or `controllers/` — importing a concrete service anywhere else is banned
- `factory.py` imported only in `routes/` and `dependencies.py` — importing it in any other layer is banned

### Structural Invariants

  - 🔴 Hard error: missing in any `.py` file
- All imports must be at the top of the file — import statements inside functions, methods, or conditional blocks are banned
  - 🔴 Hard error: `import` or `from ... import` below the module's top-level import block (Ruff `E402`)
  - Exception: `if TYPE_CHECKING:` blocks
- `getattr` and `setattr` banned in all application code — use explicit attribute access and properly typed constructors
  - 🔴 Hard error: `getattr(` or `setattr(` anywhere in `src/`
  - No suppression permitted
- `%` string interpolation banned — use f-strings or `.format()` for application strings, structured key-value arguments for logging
  - 🔴 Hard error: `%` formatting operator on strings anywhere in `src/`
- f-strings in logger calls banned — structlog takes structured key-value arguments, not interpolated strings
  - 🔴 Hard error: f-string as first argument to any `logger.*` call
- Module-level free functions in `services/` banned unless they are Protocol definitions — pure utilities belong in `utils/`, domain logic belongs on a model
  - 🔴 Hard error: non-Protocol, non-dataclass top-level function in any file under `services/`
- `print()` banned in `src/`
  - 🔴 Hard error: `print(` in any file under `src/`
- Every service implementation must have a corresponding `typing.Protocol` decorated with `@runtime_checkable`
- Every dataclass uses `slots=True`; value objects and output models also use `frozen=True`; input models omit `frozen`
- Any `@dataclass` with zero method definitions found in `services/`, `controllers/`, or `repositories/` (excluding ORM classes) is a misplaced model — move to `models/`
  - 🔴 Hard error
- `logger` always module-level — never a dataclass field
- `AppFactory` has no `@staticmethod`, no conditional logic, no business logic of any kind
- ORM models always use `Mapped[T]` — bare `Column()` is banned
- `AppError` and its subclasses never contain HTTP status codes
- `AppError` is never raised directly — only named subclasses
- `match/case` used only in `error_handlers.py` — `if/elif` everywhere else
- No `try/except` inside route handlers

### `app.py` Constraints

- Contains only `create_app()` and the lifespan context manager
- All routers registered via `include_router()`, all handlers via `register_error_handlers()`
- No route definitions (`@router.get` etc.) inside `app.py`
- LoC cap: ≤ 50 lines
- Cyclomatic complexity: 1
- 🔴 Hard error: route definitions inside `app.py` or LoC > 50

### Complexity Thresholds

- **Controllers:** ≤ 30 LoC per method, cyclomatic complexity ≤ 3
  - Suppressible with `# noqa: controller-loc — <reason>`
- **Routes:** ≤ 20 LoC per endpoint
  - Suppressible with `# noqa: route-loc — <reason>`
- **Factory:** cyclomatic complexity = 1 — zero branching, absolutely

### Concurrency

- `asyncio.TaskGroup` always — `asyncio.gather` banned unconditionally, no exceptions

### Session

- `AsyncSession` always request-scoped — never stored on a class variable or singleton
- `AppFactory` instantiated per-request — never as a singleton
- `session.execute()` called only inside `repositories/`

### Error Flow

- `NotFoundError` raised by repositories when a record is absent
- `InfraError` wraps all infrastructure failures in repositories
- HTTP status codes decided exclusively in `error_handlers.py`

### Config & Startup

- All env vars read at startup via `AppConfig.from_env()` — fail fast if missing
- `AppConfig` passed as a dependency — never re-read from env mid-request

### Project Structure

- Backend uses src layout: `backend/src/<appname>/` — `.py` application files at `backend/` root or `backend/src/` root are invalid
- `pyproject.toml` only — presence of `setup.py` or `requirements.txt` anywhere in the backend tree fails the build
- All ORM models imported via `repositories/orm/__init__.py` for Alembic

---

## 2. ⚡ SvelteKit Frontend

### Import Boundaries

| Layer | Allowed imports | Banned imports |
|---|---|---|
| `models/` | nothing | everything |
| `services/` | `models/`, API client types | other services, `@sveltejs/kit`, `stores/` |
| `controllers/` | service interfaces/concrete services for workflow composition, `models/` | `@sveltejs/kit`, other controllers, `createApiClient`, `fetch` (global) |
| `factories/` | concrete services for app construction, controllers | logic of any kind |
| `stores/` | `models/` | `services/`, `controllers/`, `@sveltejs/kit/server`, `fetch` (global) |
| `hooks.server.ts` | `AppFactory`, auth service only | `services/` directly, `controllers/` directly |
| `+page.server.ts` | `AppFactory`, `models/`, SvelteKit utilities | business logic, `fetch` (global) |
| `+page.svelte` | stores, components, `$props` | `services/`, `controllers/`, `fetch` (global) |

- Concrete service classes imported only in `AppFactory` — importing a concrete service anywhere else is banned
- `AppFactory` imported only in `src/routes/` — importing it in `src/lib/` or components is banned
- `components['schemas']['X']` types never used outside a service file
- Raw API types never returned from a service method — always mapped to domain models first
- `createApiClient()` instantiated only in `AppFactory` — never in services or controllers
- `$app/stores` banned — use `$app/state` (Svelte 5 API)
  - 🔴 Hard error: any import from `$app/stores`

### API Endpoint Restrictions

- Raw API endpoint handlers (`GET`, `POST`, `PUT`, `DELETE`, `PATCH` exported as `RequestHandler`) banned outside `src/routes/api/` — loaders and form actions are unrestricted
  - 🔴 Hard error: `RequestHandler` export outside `src/routes/api/`
- Prefer loaders and form actions over API routes — when an API route exists that could be a loader or action, it is flagged
  - 🟡 Warning: API route count exceeds 20% of total page route count

### Structural Invariants

- Every class in `services/` implements a corresponding `I<ServiceName>` TypeScript interface — concrete class without interface is invalid
- `AppFactory` uses static methods only and contains zero logic
- Both `data` and `error` always handled from every `openapi-fetch` call — never assume success
- `schema.d.ts` treated as a lockfile — never hand-edited, regenerated on every backend spec change
- `hooks.server.ts` sets only `locals.user` — no other locals, no route guards, no data fetching
- Svelte 4 `writable()` stores banned — use `$state` runes
- Stores populated from loader data via `$derived` — never via `$effect` or fetched directly

### `$effect` Constraints

`$effect` is banned except when the block contains a `return () => {}` cleanup function AND references a browser-only imperative API (`bind:this` ref, a third-party constructor, a websocket/SSE connection). All other uses are wrong:

- Syncing `data` props to `$state` → use `$derived`
- Initialising a store → use module-level initialisation or the loader
- Reacting to a boolean to reset state → use an event handler
- Calling a single function with no reactive dependencies → use `onMount`

🔴 Hard error: `$effect` without a `return` statement
🔴 Hard error: `$effect` that only calls a single function with no reactive dependencies
🟡 Warning: any `$effect` — presence alone warrants review

### `onMount` Constraints

`onMount` is banned except when referencing `localStorage`, `sessionStorage`, a `bind:this` DOM ref, or a browser-only third-party constructor. Everything else is a `$derived`, a store initialised at module level, or logic that belongs in the loader.

🔴 Hard error: `onMount` that references none of the above

### Complexity Thresholds

- **Controllers:** ≤ 40 LoC per method, cyclomatic complexity ≤ 3
  - Suppressible with `// noqa: controller-loc — <reason>`
- **`load` functions and form `actions`:** ≤ 20 LoC per function
  - Suppressible with `// noqa: loader-loc — <reason>`
- **`+page.svelte`:** 🟡 Warning at 80 LoC, 🔴 hard error at 100 LoC
  - Suppressible with `<!-- noqa: page-loc — <reason> -->`

### General Bans

- `fetch` (global) in `services/` is 🟡 warning — use the typed `openapi-fetch` client; suppress with `// noqa: raw-fetch — <reason>` for legitimate edge cases (streaming, file upload, third-party APIs without OpenAPI spec)
- `inline style=` attributes banned in all `.svelte` files outside `components/ui/`
  - 🔴 Hard error
- `<style>` blocks banned in all `.svelte` files outside `app.css` and `components/ui/`
  - 🔴 Hard error
- `console.log` / `console.error` / `console.warn` banned in all `.svelte` and `.ts` files outside `scripts/`
  - 🔴 Hard error
- `setTimeout` / `setInterval` banned in `.svelte` files and `$lib/`
  - 🔴 Hard error
- Inline `<svg>` with more than 2 child elements banned outside `components/` — extract to `$lib/components/`; Lucide icons preferred where available
  - 🔴 Hard error
- Duplicate utility functions across page files banned — if the same function body appears in 2+ files, extract to `$lib/utils/`
  - 🟡 Warning

### Error Flow

- `throw error(...)` for unrecoverable errors — renders `+error.svelte`
- `return fail(...)` for recoverable form errors — stays on page
- Raw HTTP status codes never leak past the service layer
- `+error.svelte` co-located at the route level — global root error page is last resort only

### Concurrency

- `Promise.all` across multiple services used only inside controllers — never directly in loaders
- Single-service controllers are an anti-pattern — call service directly from loader via factory

---

## 3. 🎨 UI & Design System

### Shadcn Component Enforcement

Raw HTML elements are banned everywhere outside `components/ui/` and `components/primitives/`. The following mapping is exhaustive and enforced by pre-commit:

| Banned HTML | Required shadcn replacement |
|---|---|
| `<button>` | Button, Toggle |
| `<input type="text">`, `<input type="*">` | Input, InputOTP, Checkbox, Switch, Slider, RadioGroup |
| `<textarea>` | Textarea |
| `<select>` | Select, NativeSelect, Combobox |
| `<label>` | Label |
| `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` | Table, DataTable |
| `<progress>` | Progress |
| `<details>`, `<summary>` | Accordion, Collapsible |
| `<dialog>` | Dialog, AlertDialog, Drawer, Sheet |
| `<nav>` | NavigationMenu, Breadcrumb, Menubar, Sidebar, Pagination |
| `<kbd>` | Kbd |
| `<hr>` | Separator |
| `<img>` used as avatar | Avatar |
| `<ol>`, `<ul>`, `<li>` used as menus | DropdownMenu, ContextMenu, Command |
| `<form>` | Formsnap |
| `<fieldset>` | Field |

Freely usable without restriction: `<div>`, `<span>`, `<p>`, `<h1>`–`<h6>`, `<a>`, `<section>`, `<article>`, `<main>`, `<header>`, `<footer>`, `<aside>`, `<svg>`, `<img>` (non-avatar usage), `<ol>/<ul>/<li>` (non-menu usage).

### Colour Enforcement

- Only CSS custom properties defined in `app.css` are permitted as Tailwind colour tokens
- Arbitrary value syntax banned unconditionally: `bg-[...]`, `text-[...]`, `border-[...]`, `ring-[...]`, `fill-[...]`, `stroke-[...]`, `shadow-[...]`, `outline-[...]`, `decoration-[...]`, `accent-[...]`, `caret-[...]`, `divide-[...]`, `placeholder-[...]`
- Dynamic class construction banned: `bg-${colour}`, `text-${variable}` etc. — use a lookup object of pre-approved token names instead
- Any Tailwind colour class not resolving to a token defined in `app.css` fails the build
- If dark mode is configured, `app.css` must explicitly declare the `.dark` selector block — toggling dark mode without defining tokens is invalid

### Style Isolation

- `<style>` blocks banned in all `.svelte` files — zero exceptions outside `app.css` and `components/ui/`
- Suppressible with `<!-- noqa: svelte-style — <reason> -->` — should be essentially never used
- `inline style=` attributes banned in all `.svelte` files outside `components/ui/` — the escape hatch agents reach for when `<style>` is banned
  - 🔴 Hard error

### Modifier Classes

- Experimental visual modifiers (`.glass`, `.neumorphic`, etc.) must not be applied to semantic HTML elements (`<form>`, `<table>`, `<nav>`, `<fieldset>`)
- Modifier classes restricted to whitelisted zones: Hero components, Overlay widgets only

### Responsiveness

- Fixed pixel width classes (`w-[400px]`, `w-96`, etc.) banned on root elements of page components
- Absolute positioning without a corresponding breakpoint variant (`md:`, `lg:`) banned on layout-level elements
- `whitespace-nowrap` without a responsive variant banned on layout-level elements
- Every `+page.svelte` must have an approved layout wrapper component (`<PageShell>`, `<Container>`, `<AppLayout>` or equivalent) as its direct root child
  - Suppressible with `<!-- noqa: page-wrapper — <reason> -->`
- Every `.svelte` file outside `components/ui/` should contain at least one breakpoint modifier class (`sm:`, `md:`, `lg:`)
  - 🟡 Warning only, non-blocking

### Component Structure

- `components/ui/` — shadcn generated, never hand-edited
- `components/primitives/` — themed wrappers around shadcn, the only place raw shadcn components are consumed
- `components/layout/` — page-level structure components
- `components/domain/` — feature-specific components

---

## 4. 🧪 Testing

### Absolute Bans

- Mocking libraries banned unconditionally: `unittest.mock`, `pytest-mock`, `jest.mock()`, `vi.mock()`, `spyOn()`, or any mocking framework — no exceptions
- Assertions on implementation details banned: `.call_count`, `.assert_called_with()`, `.toHaveBeenCalled()`, argument matchers — test state and output only
- Shared mutable state between tests banned — every test sets up its own state, any execution order must be valid
- `time.sleep` and `asyncio.sleep` banned in tests outside `tests/e2e/`
  - 🔴 Hard error

### Test Structure

- Test files must live under `tests/unit/`, `tests/integration/`, or `tests/e2e/` — no `test_*.py` files at project root, source root, or alongside source files
  - 🔴 Hard error
- Every test function contains exactly one `assert` statement — enforced by AST node count, no suppression permitted
- Test names describe the invariant: `test_cannot_X`, `test_returns_Y_when_Z` — never `test_method_name`
- Fakes live in `tests/fakes/` — never duplicated per test file
- Fakes implement the full Protocol/interface — partial stubs are invalid
- Model test setup blocks must not instantiate any fakes or dependencies
- Every invariant in `invariants.md` maps to at least one test — gaps are build failures
- Every test maps to a documented invariant — unmapped tests are invalid
- `pytest.mark.skip` requires a reason string
  - 🔴 Hard error: `@pytest.mark.skip` without `reason=`

### Live Application Constraints

- The following are banned outside `tests/e2e/`:
  - `TestClient` imports
  - `AsyncClient` targeted at a live app URL
  - `uvicorn` imports
  - 🔴 Hard error in `tests/unit/` and `tests/integration/`

### Structural Coverage

- Every concrete service class and controller class must have at least one corresponding test file that imports it directly or via its fake — a service or controller with zero test file presence is a hard failure
  - 🔴 Hard error: concrete service or controller with no test file importing it or its fake

### Layer-Specific Rules

- Repository tests use real Postgres via testcontainers — SQLite and mocked sessions banned
- Service and controller tests inject fakes — no real database
- Integration tests cover the full stack — unit tests cover services and controllers

### Semantic Guidance (skill doc only)

- Tests asserting on state and output rather than implementation details
- Test scenarios exercising meaningful domain invariants rather than trivial getters

---

## 5. 🏗️ Fullstack Structure

### Repository Layout

- Always a monorepo — single repo regardless of stack size
- `frontend/` uses pnpm exclusively — npm and yarn banned
- `backend/src/<appname>/` is the only valid location for application Python code
- `CLAUDE.md` at project root — read first every session
- `AGENTS.md` at project root — design system decisions

### Security & Environment

- `frontend/.env` must not contain backend infrastructure variables: `DATABASE_URL`, `POSTGRES_*`, backend cloud secrets — hard failure
- `frontend/.env` and `backend/.env` are always separate — secrets never shared between them
- All env vars validated at startup — fail fast with a clear message if missing

### Suppression Policy

All suppressible warnings require a structured comment with an explicit reason string. A suppression without a reason fails the pre-commit hook. Suppressions are visible in code review by design — the comment is the smell made explicit.

---

## 6. 🔴🟡🔵 Severity Tiers

| Tier | Behaviour | Examples |
|---|---|---|
| 🔴 Hard error | Blocks commit, no override | Import boundary violations, `asyncio.gather`, ORM leaking outside repositories, mocking libraries, banned HTML elements, arbitrary colour values, `<style>` in components, `inline style=`, `$app/stores`, `$effect` without cleanup, `onMount` without browser API, `getattr`/`setattr`, f-string in logger, `print()` in `src/`, `RequestHandler` outside `/api/`, banned env vars in `frontend/.env` |
| 🟡 Warning | Blocks commit, suppressible with reason comment | Controller/route LoC thresholds, page LoC approaching limit, missing page wrapper, zero breakpoint classes, raw `fetch` in services, duplicate utility functions, any `$effect` presence, API route count ratio |
| 🔵 Info | Logged, non-blocking | Logging convention deviations |

