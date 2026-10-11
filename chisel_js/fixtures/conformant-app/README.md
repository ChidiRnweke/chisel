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
- **The service implements its role interfaces explicitly.**
  `src/lib/server/services/todos/catalog.ts` declares `TodoReader`,
  `TodoLister` and `TodoCreator` beside the class and names them in its
  `implements` clause. A sibling contracts file would be a services-to-services
  edge. The controller and the factory import the roles from the service file.
- **Config imports nothing internal.** `src/lib/server/config.ts` reads the
  environment and stops. The database handle it used to build now comes from
  `src/lib/server/db/index.ts`, because config sits at the bottom of the graph
  and a dependency there is a cycle.
- **The wiring file is only wiring.** `src/lib/server/application.ts` imports no
  concrete service or repository, constructs nothing but factories, and parks no
  `undefined as unknown as` placeholder. It is the negative control for all
  three `topology:composition-root-*` rules at once.
- **Raw `<button>` appears once.** In `src/lib/components/ui/button.svelte`, the
  design system's own floor, and nowhere else.
- **Specs obey the rules the tool enforces on itself.** Every test asserts,
  hand-written typed fakes from `src/lib/testing/todos/fakes/in-memory-todos.ts`
  with no literal cast through `unknown`, no `toHaveBeenCalled`, and `describe` naming an
  invariant rather than a class.

## What is deliberately absent

There is no `chisel-exceptions.json`, and there must never be one. A conformant
fixture that needs an exception is not conformant; it is a fixture with a rule
switched off in it.
