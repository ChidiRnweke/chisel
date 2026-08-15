# bff-app

A miniature SvelteKit frontend in the **BFF** topology: it owns no database and
talks to a separate backend through a generated API client.

It exists because two behaviours are reachable only in this mode, and until now
neither had a tree to run against. `ApiEndpointsService` is registered by the
factory only under BFF, and `import-boundary:api-client-location` is the one
rule gated by a `modes` entry rather than by a layer.

Deliberately small: unit tests pin what each rule decides, and this tree pins
only that the factory composes them when the mode says so.

## Why there is no src/lib/server/

Detection requires unanimity, and `src/lib/server/` is a signal for
*standalone*. One such directory here would make the tree score for both modes,
which is ambiguous, and ambiguity falls back to standalone — so the BFF rules
would silently never run and the fixture would prove nothing.

That is also the honest shape: a BFF frontend's persistence lives behind the
backend it calls.

## Planted anti-patterns

| File | Anti-pattern | Rule |
|---|---|---|
| `src/lib/stores/todos.svelte.ts` | a store builds its own API client | `import-boundary:api-client-location` |
| `src/routes/todos/+server.ts` | a request handler outside the API tree | `api:request-handler-outside-api` |

## What must stay silent

- `src/lib/api/client.ts` builds the client and is **correct**: under BFF,
  `src/lib/api/**` classifies as the config layer, which is one of the two
  places allowed to name the constructor. It is also the negative control for
  `structure:unclassified-module`, which reports this file under standalone.
- `src/routes/api/todos/+server.ts` is a handler where handlers belong.
- `route-style:prefer-remote-function` must not appear anywhere in this tree.
  A BFF has no remote functions, so there is nothing to prefer over an API
  route, and the factory leaves that service out under this mode.
