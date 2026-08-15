---
title: TypeScript rules
description: Every rule enforced by `chisel-js`, grouped by category, with fix guidance.
sidebar:
  # Pin order so the reference sidebar stays stable across releases.
  order: 4
tableOfContents:
  minHeadingLevel: 2
  maxHeadingLevel: 3
---

:::note[Snapshot]
This page mirrors `scripts/data/js-rules.json` captured at release time. Run `chisel-js rules --json` to see the live list for your installed version.
:::

70 rules across 16 categories, enforced by `chisel-js`.

## Bundle

`bundle` · 1 rule

### `bundle:oversized-app-chunk`

A client chunk containing application code exceeds the size budget

**Fix.** Split the route or import the heavy part dynamically. Vendor-only chunks are tolerated as a known cost; a chunk mixing application code is a regression. Requires a production build — run `chisel-js bundle` after building.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

## Coherence

`coherence` · 2 rules

### `coherence:empty-test-glob`

A test-runner include pattern matches no files

**Fix.** Fix the pattern or delete it. A glob matching nothing means part of the suite stopped running and CI stayed green — the one failure mode the test suite cannot report itself.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `coherence:broken-doc-path`

Maintained documentation cites a path that does not exist

**Fix.** Update the reference or remove it. Checked in root and docs/ markdown; generated API references and build output are excluded.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

## Colour Enforcement

`colour-enforcement` · 4 rules

### `colour:arbitrary-value-banned`

Arbitrary Tailwind colour value syntax (bg-[...], text-[#...], border-[...], etc.)

**Fix.** Add the colour as a CSS custom property in app.css first, then reference it as a Tailwind token (e.g. bg-primary).

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `colour:palette-class-banned`

Hardcoded Tailwind palette colour (text-red-500, bg-slate-800, from-blue-500)

**Fix.** Use a semantic token from app.css (bg-background, text-muted-foreground, text-destructive). A palette class pins one appearance and cannot follow the theme, so it looks wrong in whichever mode it was not written for.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `colour:dynamic-class-banned`

Dynamic class construction (class={`bg-${variable}`})

**Fix.** Use a lookup object of pre-approved token names instead: const colourMap = { primary: 'bg-primary' }.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `colour:modifier-on-semantic`

Experimental modifier class on semantic HTML

**Fix.** Modifier classes (.glass, .neumorphic) restricted to Hero components and Overlay widgets.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

## Component Enforcement

`component-enforcement` · 24 rules

### `component-enforcement:html-button-banned`

Raw <button> element

**Fix.** Use <Button, Toggle> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-textarea-banned`

Raw <textarea> element

**Fix.** Use <Textarea> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-select-banned`

Raw <select> element

**Fix.** Use <Select, NativeSelect, Combobox> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-label-banned`

Raw <label> element

**Fix.** Use <Label> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-progress-banned`

Raw <progress> element

**Fix.** Use <Progress> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-dialog-banned`

Raw <dialog> element

**Fix.** Use <Dialog, AlertDialog, Drawer, Sheet> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-nav-banned`

Raw <nav> element

**Fix.** Use <NavigationMenu, Breadcrumb, Menubar, Sidebar, Pagination> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-kbd-banned`

Raw <kbd> element

**Fix.** Use <Kbd> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-hr-banned`

Raw <hr> element

**Fix.** Use <Separator> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-form-banned`

Raw <form> element

**Fix.** Use <Formsnap> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-fieldset-banned`

Raw <fieldset> element

**Fix.** Use <Field> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-table-banned`

Raw <table> element

**Fix.** Use <Table, DataTable> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-thead-banned`

Raw <thead> element

**Fix.** Use <Table, DataTable> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-tbody-banned`

Raw <tbody> element

**Fix.** Use <Table, DataTable> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-tr-banned`

Raw <tr> element

**Fix.** Use <Table, DataTable> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-th-banned`

Raw <th> element

**Fix.** Use <Table, DataTable> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-td-banned`

Raw <td> element

**Fix.** Use <Table, DataTable> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-details-banned`

Raw <details> element

**Fix.** Use <Accordion, Collapsible> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-summary-banned`

Raw <summary> element

**Fix.** Use <Accordion, Collapsible> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-input-banned`

Raw <input> element

**Fix.** Use <Input>, <InputOTP>, <Checkbox>, <Slider>, or <RadioGroup> from shadcn depending on the type attribute.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-img-avatar-banned`

Raw <img> used as avatar

**Fix.** Use <Avatar> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-ol-menu-banned`

Raw <ol> used as menu structure

**Fix.** Use <DropdownMenu>, <ContextMenu>, or <Command> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-ul-menu-banned`

Raw <ul> used as menu structure

**Fix.** Use <DropdownMenu>, <ContextMenu>, or <Command> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

### `component-enforcement:html-li-menu-banned`

Raw <li> used as menu structure

**Fix.** Use <DropdownMenu>, <ContextMenu>, or <Command> from shadcn.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

## Error Flow

`error-flow` · 1 rule

### `error-flow:raw-http-status`

Raw HTTP status code outside error handler / api route

**Fix.** Pages/actions: throw error(status, ...) or return fail(status, ...). API routes under src/routes/api/**/+server.ts: return json(payload, { status }). Services: throw a typed domain error; HTTP status is decided only in error_handlers.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

## Import Boundary

`import-boundary` · 7 rules

### `import-boundary:layer-no-internal-imports`

A pure layer (models, errors, config) imported another internal layer — including another file of its own layer.

**Fix.** models, errors and config sit at the bottom of the dependency graph. Importing upward: move the shared type down into models. Importing sideways: one model file per domain, self-contained — the ID type lives with the model that owns it. A shared.ts kernel of branded IDs is the anti-pattern, not the fix; distribute those types to their domains. An index.ts barrel is the layer's surface for consumers, and cannot resolve a file-to-file dependency inside the layer.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `import-boundary:banned-layer-import`

An import crossed a layer boundary in a banned direction.

**Fix.** Dependencies point one way: components/stores/client -> routes/remote -> factory -> controllers -> services -> repositories. Import the interface, or get the value from the layer above.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `import-boundary:orm-leak`

Drizzle was imported outside the repository layer.

**Fix.** ORM types never leave the repository layer. Query inside a repository and return a domain model.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `import-boundary:framework-leak`

@sveltejs/kit was imported by a layer that must stay framework-agnostic.

**Fix.** Services, repositories, controllers and stores know nothing about SvelteKit. Handle framework concerns in the route or remote function.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `import-boundary:server-only-specifier`

$app/server or a private $env entry point was imported from a client-reachable module.

**Fix.** Move the import into a *.server.ts, a *.remote.ts, or a module under $lib/server.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `import-boundary:api-client-location`

The generated API client was constructed outside the factory (BFF mode).

**Fix.** Construct the client once in the factory and inject it. Import only its type elsewhere.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `import-boundary:unresolved-import`

An import specifier resolved to no file in the project.

**Fix.** Fix the path. A dangling import is invisible to every layer rule, so it hides architectural violations as well as being broken.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

## Project Structure

`project-structure` · 3 rules

### `project-structure:wrong-package-manager`

npm or yarn lockfile found instead of pnpm

**Fix.** Use pnpm exclusively for the frontend.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `project-structure:backend-env-in-frontend`

Backend infrastructure variables in frontend .env

**Fix.** Keep frontend/.env and backend/.env separate. Never share secrets.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `project-structure:missing-test-coverage`

Service has no test file

**Fix.** Add a test file under tests/unit/ covering its core invariants.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

## Route Style

`route-style` · 1 rule

### `route-style:prefer-remote-function`

An API route serves the app's own UI instead of a remote function.

**Fix.** Move it to a remote function in $lib/remote/*.remote.ts, or to a loader / form action if the data belongs to a page. Routes that are genuinely HTTP — OAuth callbacks, webhooks, SSE streams, file downloads, protocol endpoints — are detected and exempt.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

## Server Layer Leak

`server-layer-leak` · 1 rule

### `server-layer-leak:client-reachable-import`

A client-reachable module imported a server-only module.

**Fix.** Server-only code lives under $lib/server or in a *.server.ts / *.remote.ts file, and may only be imported from other server-only modules. A universal +page.ts is not server-only, even next to a +page.server.ts. Import types with `import type`.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

## Spacing

`spacing` · 1 rule

### `spacing:arbitrary-value-banned`

Arbitrary Tailwind spacing/sizing value syntax (w-[400px], min-h-[80vh], gap-[14px])

**Fix.** Define the size as a CSS custom property in app.css (e.g. --space-4) and reference it as a Tailwind token.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::

## Structural

`structural` · 5 rules

### `structural:inline-style-banned`

inline style= attribute in .svelte

**Fix.** Use Tailwind utility classes defined in app.css. Styling comes from the design system, not from the element.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `structural:style-block-banned`

<style> block in .svelte

**Fix.** Remove the <style> block and express the styles as Tailwind utility classes.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `structural:missing-service-interface`

Concrete service without a matching I<ServiceName> interface

**Fix.** Declare an I<ServiceName> interface in the same file. Controllers depend on the interface and the factory supplies the implementation. It has to be the same file — a sibling contracts.ts is a same-layer import, which the boundary rules ban.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `structural:factory-contains-logic`

A factory contains branching or looping

**Fix.** A factory wires concrete implementations together and decides nothing — no if, for, while, switch, try or ternary. Instance methods are fine: holding injected collaborators is what a factory is for.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `structural:hooks-locals-limited`

hooks.server.ts sets a local other than locals.user

**Fix.** hooks.server.ts attaches the authenticated user and nothing else. Route guards and data fetching belong in a loader.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

## Structure

`structure` · 3 rules

### `structure:layer-outside-server`

A server-side layer sits at a universal path instead of under $lib/server/.

**Fix.** Move services, controllers, repositories and the factory under $lib/server/. SvelteKit then makes a client import of them a build error, which is stronger than anything a linter can offer. Reported once per directory.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `structure:unknown-server-folder`

A folder under $lib/server/ does not name a layer.

**Fix.** $lib/server/ holds db/, repositories/, services/, controllers/, factories/, config.ts and the factory. An adapter for an external capability is a service, not a repository — repositories are persistence. Wiring modules may stay at the root or be grouped under factories/. Reported once per folder.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `structure:unclassified-module`

A src/lib/ module matches no canonical layer location.

**Fix.** Give it a home. An ad-hoc folder gets no boundary rules of its own, so it silently opts out of the architecture it lives in.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

## Suppression

`suppression` · 1 rule

### `suppression:missing-reason`

A chisel-ignore comment gave no reason, so it suppressed nothing.

**Fix.** Write `chisel-ignore <rule-id> -- <why this case is different>`. A suppression nobody has to justify is one nobody will revisit.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

## Test Structure

`test-structure` · 8 rules

### `test-structure:test-file-location`

Test file neither colocated with its subject nor under a tests/ root

**Fix.** Put foo.spec.ts beside foo.ts, or move it under tests/unit/, tests/integration/ or tests/e2e/ so its kind is visible from its path.

:::tip[Skill]
Taught by `qa`. Run `chisel-js setup --target <target>` to install it.
:::

### `test-structure:test-naming`

Test name does not describe an invariant

**Fix.** Name the test after the invariant it proves: test_cannot_X, test_returns_Y_when_Z. When it fails, the name alone should say what broke.

:::tip[Skill]
Taught by `qa`. Run `chisel-js setup --target <target>` to install it.
:::

### `test-structure:one-assert-per-test`

More than one assertion in a test

**Fix.** Split into separate tests, one per assertion, each named after its invariant. End-to-end specs are exempt.

:::tip[Skill]
Taught by `qa`. Run `chisel-js setup --target <target>` to install it.
:::

### `test-structure:mocking-banned`

Mocking library usage (vi.mock, jest.fn, spyOn, sinon)

**Fix.** Write a fake that implements the full interface. In a layered architecture with injected dependencies you can always construct the real object; needing a mock is a signal the wiring is wrong.

:::tip[Skill]
Taught by `qa`. Run `chisel-js setup --target <target>` to install it.
:::

### `test-structure:skip-without-reason`

test.skip without an explanation

**Fix.** Pass a reason string, or put one in a comment above the skip: what blocks it and when it comes back. A bare skip is debt nobody can see.

:::tip[Skill]
Taught by `qa`. Run `chisel-js setup --target <target>` to install it.
:::

### `test-structure:untyped-fake`

A Fake*/Stub*/InMemory* class declares no interface

**Fix.** Add `implements <Interface>`. Without it the fake drifts from the real contract silently, and the first thing to notice is a production path.

:::tip[Skill]
Taught by `qa`. Run `chisel-js setup --target <target>` to install it.
:::

### `test-structure:unsafe-dependency-cast`

`as unknown as T` in a test

**Fix.** The cast is silencing the error that says the fake does not match the interface. Complete the fake, or narrow the interface the code under test depends on.

:::tip[Skill]
Taught by `qa`. Run `chisel-js setup --target <target>` to install it.
:::

### `test-structure:interaction-assertion`

Assertion on calls (toHaveBeenCalled and friends)

**Fix.** Assert on output or resulting state. Interaction assertions pin the internals, so a behaviour-preserving refactor breaks the test for no reason.

:::tip[Skill]
Taught by `qa`. Run `chisel-js setup --target <target>` to install it.
:::

## Topology

`topology` · 7 rules

### `topology:layer-barrel-import`

Import from a layer-wide barrel rather than a domain

**Fix.** Import the domain: $lib/models/notes, not $lib/models. A layer barrel makes every consumer depend on everything and collapses the graph into one hub. A domain's own index.ts remains the sanctioned entry point.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `topology:deep-feature-import`

Cross-feature import reaching past a feature's entry point

**Fix.** Import $lib/components/<feature> and export what callers need from its index.ts. Deep imports turn every internal rename into a breaking change. Within a feature, relative imports are fine.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `topology:generic-bucket-directory`

A directory named misc/, common/, helpers/, pages/ or panels/

**Fix.** Name the directory after what the code does, or move each file to the feature that owns it. A directory that describes nothing collects anything. Reported once per directory.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `topology:composition-root-concrete-import`

The composition root imports a concrete service or repository

**Fix.** Depend on the interface and let a factory supply the implementation. `import type` is fine — it is erased. Once the wiring can reach for concretes, every layering rule gets an exception here.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `topology:composition-root-construction`

The composition root constructs something other than a factory

**Fix.** Call a factory and let it decide what to build. Assembling objects in the wiring is how it becomes the one file that knows every concrete type.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `topology:composition-root-placeholder`

Placeholder wiring (undefined as unknown as T, LateValue)

**Fix.** A placeholder means two objects need each other. Restructure so one does not — extract the shared part, or pass a typed lazy accessor. The placeholder turns a build error into a runtime one.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

### `topology:factory-shape`

A *-factory.ts does not export exactly one value

**Fix.** One factory module builds one thing. Split it, or rename the file after what it actually holds. Exported types do not count — a factory may declare its own dependency shape.

:::tip[Skill]
Taught by `building-sveltekit-frontend`. Run `chisel-js setup --target <target>` to install it.
:::

## Typography

`typography` · 1 rule

### `typography:arbitrary-value-banned`

Arbitrary Tailwind typography value syntax (text-[10px], tracking-[0.4em], leading-[1.6])

**Fix.** Define the size/leading/tracking as a CSS custom property in app.css (e.g. --text-sm) and reference it as a Tailwind token.

:::tip[Skill]
Taught by `designing-svelte-ui`. Run `chisel-js setup --target <target>` to install it.
:::
