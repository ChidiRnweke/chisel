# conformant-app

A miniature SvelteKit application that obeys every rule chisel enforces. It must
produce **zero** violations, and chisel's own conformant-app e2e test asserts
the whole violation list rather than a count.

This is the opposite specimen to `standalone-app/`, and the two catch opposite
failures. That tree is anti-patterns end to end, so it proves a rule still
*fires*; a rule that starts firing on correct code cannot be caught there,
because there is no correct code in it. Two false positives shipped that way
before this fixture existed.

Every layer that carries architectural intent appears here at least once, so no
rule is left unexercised. Adding a rule means checking it stays silent against
this tree, not just that it speaks against the other one.

## The shapes that matter

Each of these is deliberate. They are the negative controls, and flattening one
because it looks like ceremony will hand back the false positive it exists to
catch.

- **Model barrels are leaves.** `src/lib/models/todos/index.ts` re-declares
  foreign branded identifiers locally and unexported, exporting only the id it
  owns. Importing the projects model to borrow `ProjectId` would make one model
  depend on another, which is what keeps the layer pure data.
- **The service satisfies its role interfaces structurally.**
  `src/lib/server/services/todos/catalog.ts` carries no `implements` clause and
  never imports `src/lib/server/services/todos/contracts.ts` — that edge would
  be services-to-services. The roles exist for the consumer, so the controller
  imports them and the compiler checks the fit at the wiring point.
- **Config imports nothing internal.** `src/lib/server/config.ts` reads the
  environment and stops. The database handle it used to build now comes from
  `src/lib/server/db/index.ts`, because config sits at the bottom of the graph
  and a dependency there is a cycle.
- **The wiring file is only wiring.** `src/lib/server/application.ts` imports no
  concrete service or repository, constructs nothing but factories, and parks no
  `undefined as unknown as` placeholder. It is the negative control for all
  three `topology:composition-root-*` rules at once.
- **Factory modules export exactly one value.** The `ControllerFactory`
  interface lives in `src/lib/server/factories/contracts.ts` rather than a
  `controller-factory.ts`: that suffix promises a module exporting one creator,
  and a module of pure interfaces exports no value at all.
- **Raw `<button>` appears once.** In `src/lib/components/ui/button.svelte`, the
  design system's own floor, and nowhere else.
- **Specs obey the rules the tool enforces on itself.** One assertion per test,
  hand-written typed fakes from `src/lib/testing/todos/fakes/in-memory-todos.ts`
  with no `as unknown as`, no `toHaveBeenCalled`, and `describe` naming an
  invariant rather than a class.

## What is deliberately absent

There is no `chisel-exceptions.json`, and there must never be one. A conformant
fixture that needs an exception is not conformant; it is a fixture with a rule
switched off in it.
