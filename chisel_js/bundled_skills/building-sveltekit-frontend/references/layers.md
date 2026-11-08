# Layer Guide

## Table of Contents

- [Models](#models)
- [Shared services](#shared-services)
- [Repositories](#repositories)
- [Server services](#server-services)
- [Controllers](#controllers)
- [Factories and the composition root](#factories-and-the-composition-root)
- [hooks.server.ts](#hooksserverts)
- [Remote functions](#remote-functions)
- [Routes and loaders](#routes-and-loaders)
- [Stores](#stores)
- [Browser controllers](#browser-controllers)
- [Components](#components)

---

## Models

`src/lib/models/<domain>/` holds values, types, schemas and value constructors. Schemas live next
to the type they produce, so the type is `z.infer` of its schema or a branded value its constructor
returns.

- No behaviour beyond constructing and validating a value.
- No imports from any other layer, and never from components.
- Request shapes and resolved shapes are different types even when they look alike. A resolved type
  carries no optional field for something already decided.
- Two optional fields that are always absent together are one optional object. State-dependent
  payloads are a discriminated union.

## Shared services

`src/lib/services/<domain>/` holds business rules that both the browser and the server need — a
UI preview and a server write that must agree. They are pure functions or stateless classes with
no I/O. One total rule per decision, used by every caller.

## Repositories

`src/lib/server/repositories/<domain>/` is persistence only.

- Domain models in, domain models out. Drizzle row types never leave the repository.
- Parse the rows they read (a stored JSON column is external data).
- No business rules. No reading another domain's tables to make a decision.
- One interface per repository; the service depends on the interface.

## Server services

`src/lib/server/services/<domain>/` holds one cohesive capability: its rules and the I/O it owns
(its repositories, its external provider).

- A stateless class that explicitly implements one or more narrow capability interfaces. Public
  members belong to an implemented interface.
- Capability interfaces and the constructor-dependency type sit beside the service. Data crossing
  the boundary lives in `models/`.
- Never import or receive another service, not even as a callback.
- A service that owns an external provider maps its failures to one domain error with the original
  as `cause`.
- Cohesion test: same data, same consumers, same reason to change. Do not split for size.

## Controllers

`src/lib/server/controllers/<domain>/controller.ts` holds complete operations.

- Sequence services and own transactions. A controller method is one thing a user or system does.
- Depend on service interfaces only. Never import repositories — every write has rules around it.
- Never call another controller.
- Never parse. Inputs arrive as models from the entry point.
- Keep them thin. An `if` over domain data belongs in a service.

## Factories and the composition root

`src/lib/server/factories/` constructs concrete classes and wires them through interfaces.
`src/lib/server/application.ts` is the composition root: it builds the per-request application
from factories and exposes controllers.

- No logic, no workflows, no branching on business state.
- Build heavy immutable resources (database pool, provider clients, config) once per process; build
  the per-request graph lazily.
- No test knobs in production wiring. Tests fake whole services instead.

## hooks.server.ts

Resolve the session, then bind the actor into the request's application (for example,
`event.locals.app = application.forActor(user)`). Redirect unauthenticated requests where the
route requires it. No business logic, no data fetching.

## Remote functions

`src/lib/remote/<domain>/*.remote.ts` is the sole entry point from the UI to the server. Use
`query` for reads, `command` for writes, `form` for progressive-enhancement forms.

- Every remote function takes a schema. The schema comes from `models/`.
- Parse, call exactly one controller operation, shape the result. Nothing else.
- Translate domain errors once, here, into SvelteKit `error()` (see `error-handling.md`).
- Refresh affected queries after a command (`query.refresh()` or single-flight updates) rather than
  hand-maintaining copies in stores.

## Routes and loaders

Prefer remote functions over `+page.server.ts` loaders and actions. Use a loader only where the data
must exist for SSR before the page renders and a remote query cannot serve. `+server.ts` endpoints
exist for public HTTP APIs and webhooks; they parse and delegate exactly like a remote function.

## Stores

`src/lib/stores/<area>/*.svelte.ts` holds client `$state` singletons.

- Reactive state with controlled updates. Derive with `$derived`, never sync with `$effect`.
- No fetching, no remote calls, no provider calls, no business decisions.
- One writer per piece of state.

## Browser controllers

`src/lib/controllers/<area>/` exists only where the browser itself sequences work: a local-first
replica (cache, outbox, sync, conflict review), an upload pipeline, an export render, an editor
session.

- Never wrap a single remote function. Components call remote functions directly.
- Never call another browser controller.

## Components

`src/lib/components/<feature>/` renders and handles interaction.

- Read stores, receive props, call remote functions or a browser controller.
- Never import from `#lib/server/**`.
- Never assemble a multi-step workflow; that is a controller (server or browser).
- Use the shadcn-svelte primitives in `components/ui/`; see the `designing-svelte-ui` skill.
