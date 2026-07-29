# Specimen: standalone SvelteKit SSR app

An acceptance fixture for the checker, not a working app. It is a small,
mostly-conformant standalone SSR tree (SvelteKit owning its own data layer via
Drizzle) into which one instance of each architectural anti-pattern has been
planted.

**This tree does not compile, on purpose.** It has dangling imports and
references packages it does not install, because those are among the things the
checker must catch. It is excluded from `tsconfig.json` for that reason — if
`bunx tsc --noEmit` ever starts reporting errors from here, the exclusion has
been lost, not the fixture.

Each anti-pattern is marked with an `ANTI-PATTERN:` comment naming what it
demonstrates:

The conformant spine lives under `src/lib/server/` (`services/`, `controllers/`,
`repositories/`, `db/`, `app-factory.ts`), which is where SvelteKit itself
refuses to bundle it for the client. `models/`, `errors.ts` and the client
layers stay universal.

| File | Anti-pattern |
|---|---|
| `src/lib/models/domain.ts` | A model importing another model — models are pure data |
| `src/lib/server/domain/openai-client.ts` | A folder under `$lib/server/` that is not a layer; its contents are services |
| `src/lib/services/`, `src/lib/factories/` | Server-side layers at a universal path |
| `src/routes/api/notes/+server.ts` | A JSON API route that should be a remote function |
| `src/lib/components/app/note-badge.svelte` | Hardcoded palette colour instead of a semantic token |
| `src/lib/factories/production-controller-factory.ts` | Composition root at a universal path, importing concrete server impls |
| `src/lib/components/app/note-card.svelte` | Component reaching into a repository, and into a service directly |
| `src/lib/services/notes/search.ts` | Unresolved import alias — invisible to a regex engine |
| `src/routes/offline/+page.ts` | Universal load importing a server module, beside a `+page.server.ts` sibling |
| `src/lib/remote/resource-queries.ts` | File in a marker-defined layer without the marker |
| `src/lib/navigation/safe-return-url.ts` | Ad-hoc `lib/` folder matching no layer |
| `src/lib/stores/notes.svelte.ts` | Store importing a controller |
| `src/lib/services/notes/stats.ts` | ORM imported outside the repository layer |
| `src/lib/hooks/is-mobile.svelte.ts` | Name collision with the framework `hooks` layer |
| `src/lib/client/note-sync/indexeddb-note-sync-repository.ts` | Client adapter named `*-repository` |

`src/lib/components/app/note-title.svelte` is the control for type-only imports:
it imports a type across a layer boundary, which is coupling but not a runtime
leak, and must not be reported as one.
