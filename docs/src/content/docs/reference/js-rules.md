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

74 rules across 11 categories, enforced by `chisel-js`.

## Api Endpoints

`api-endpoints` · 2 rules

### `api:request-handler-outside-api`

RequestHandler export outside src/routes/api/

**Fix.** Use loaders and form actions instead of raw API endpoints.

### `api:route-count-ratio`

API route count exceeds 20% of page routes

**Fix.** Prefer loaders and form actions over API routes.

## Colour Enforcement

`colour-enforcement` · 3 rules

### `colour:arbitrary-value-banned`

Arbitrary Tailwind value syntax (bg-[...], text-[...], etc.)

**Fix.** Add the colour as a CSS custom property in app.css first, then reference it as a Tailwind token.

### `colour:dynamic-class-banned`

Dynamic class construction (class={`bg-${variable}`})

**Fix.** Use a lookup object of pre-approved token names instead: const colourMap = { primary: 'bg-primary' }.

### `colour:modifier-on-semantic`

Experimental modifier class on semantic HTML

**Fix.** Modifier classes (.glass, .neumorphic) restricted to Hero components and Overlay widgets.

## Complexity

`complexity` · 4 rules

### `complexity:page-loc-limit`

+page.svelte exceeds 100 LoC

**Fix.** Extract logical sections into components/domain/.

### `complexity:page-loc-warning`

+page.svelte exceeds 80 LoC

**Fix.** Consider extracting sections into components/domain/.

### `complexity:controller-loc-limit`

Controller method exceeds 40 LoC

**Fix.** Extract business logic into a service. Controllers orchestrate — services do the work.

### `complexity:loader-loc-limit`

Loader or form action exceeds 20 LoC

**Fix.** Move logic into a controller or service. Loaders parse input, call factory, return output.

## Component Enforcement

`component-enforcement` · 24 rules

### `component-enforcement:html-button-banned`

Raw <button> element

**Fix.** Use <Button, Toggle> from shadcn.

### `component-enforcement:html-textarea-banned`

Raw <textarea> element

**Fix.** Use <Textarea> from shadcn.

### `component-enforcement:html-select-banned`

Raw <select> element

**Fix.** Use <Select, NativeSelect, Combobox> from shadcn.

### `component-enforcement:html-label-banned`

Raw <label> element

**Fix.** Use <Label> from shadcn.

### `component-enforcement:html-progress-banned`

Raw <progress> element

**Fix.** Use <Progress> from shadcn.

### `component-enforcement:html-dialog-banned`

Raw <dialog> element

**Fix.** Use <Dialog, AlertDialog, Drawer, Sheet> from shadcn.

### `component-enforcement:html-nav-banned`

Raw <nav> element

**Fix.** Use <NavigationMenu, Breadcrumb, Menubar, Sidebar, Pagination> from shadcn.

### `component-enforcement:html-kbd-banned`

Raw <kbd> element

**Fix.** Use <Kbd> from shadcn.

### `component-enforcement:html-hr-banned`

Raw <hr> element

**Fix.** Use <Separator> from shadcn.

### `component-enforcement:html-form-banned`

Raw <form> element

**Fix.** Use <Formsnap> from shadcn.

### `component-enforcement:html-fieldset-banned`

Raw <fieldset> element

**Fix.** Use <Field> from shadcn.

### `component-enforcement:html-table-banned`

Raw <table> element

**Fix.** Use <Table, DataTable> from shadcn.

### `component-enforcement:html-thead-banned`

Raw <thead> element

**Fix.** Use <Table, DataTable> from shadcn.

### `component-enforcement:html-tbody-banned`

Raw <tbody> element

**Fix.** Use <Table, DataTable> from shadcn.

### `component-enforcement:html-tr-banned`

Raw <tr> element

**Fix.** Use <Table, DataTable> from shadcn.

### `component-enforcement:html-th-banned`

Raw <th> element

**Fix.** Use <Table, DataTable> from shadcn.

### `component-enforcement:html-td-banned`

Raw <td> element

**Fix.** Use <Table, DataTable> from shadcn.

### `component-enforcement:html-details-banned`

Raw <details> element

**Fix.** Use <Accordion, Collapsible> from shadcn.

### `component-enforcement:html-summary-banned`

Raw <summary> element

**Fix.** Use <Accordion, Collapsible> from shadcn.

### `component-enforcement:html-input-banned`

Raw <input> element

**Fix.** Use <Input>, <InputOTP>, <Checkbox>, <Slider>, or <RadioGroup> from shadcn depending on the type attribute.

### `component-enforcement:html-img-avatar-banned`

Raw <img> used as avatar

**Fix.** Use <Avatar> from shadcn.

### `component-enforcement:html-ol-menu-banned`

Raw <ol> used as menu structure

**Fix.** Use <DropdownMenu>, <ContextMenu>, or <Command> from shadcn.

### `component-enforcement:html-ul-menu-banned`

Raw <ul> used as menu structure

**Fix.** Use <DropdownMenu>, <ContextMenu>, or <Command> from shadcn.

### `component-enforcement:html-li-menu-banned`

Raw <li> used as menu structure

**Fix.** Use <DropdownMenu>, <ContextMenu>, or <Command> from shadcn.

## Concurrency

`concurrency` · 1 rule

### `concurrency:promise-all-warning`

Promise.all used directly in a loader

**Fix.** Move Promise.all into a controller method. Single-service controllers are an anti-pattern — call service directly from loader via factory.

## Error Flow

`error-flow` · 1 rule

### `error-flow:raw-http-status`

Raw HTTP status code outside error handler

**Fix.** Use throw error(status, ...) for unrecoverable errors (renders +error.svelte) or return fail(status, ...) for recoverable form errors.

## Import Boundary

`import-boundary` · 9 rules

### `import-boundary:service-banned-import`

Service importing another service, store, or framework module

**Fix.** Services never import other services or stores. Use a controller to orchestrate multiple services.

### `import-boundary:controller-banned-import`

Controller importing @sveltejs/kit or another controller

**Fix.** Controllers have no framework knowledge. Move @sveltejs/kit imports to the loader.

### `import-boundary:stores-banned-import`

Store importing services, controllers, or @sveltejs/kit

**Fix.** Stores hold reactive state only. Move service/controller calls to the loader.

### `import-boundary:page-banned-import`

+page.svelte importing services or controllers

**Fix.** Data comes from the loader via $props. Don't call services directly from the page.

### `import-boundary:loader-banned-import`

Loader/action importing raw fetch

**Fix.** Use the typed openapi-fetch client via AppFactory.

### `import-boundary:hooks-banned-import`

hooks.server.ts importing unauthorized modules

**Fix.** hooks.server.ts sets only locals.user. Move service calls to the loader.

### `import-boundary:create-api-client-location`

createApiClient() called outside factories/

**Fix.** createApiClient() must only be called in factories/.

### `import-boundary:concrete-service-import`

Concrete service imported outside factories/

**Fix.** Only factories assemble concrete implementations. Import the Protocol interface everywhere else.

### `import-boundary:factory-import-location`

AppFactory imported outside src/routes/

**Fix.** AppFactory must only be imported in src/routes/. Import the service interface everywhere else.

## Project Structure

`project-structure` · 3 rules

### `project-structure:wrong-package-manager`

npm or yarn lockfile found instead of pnpm

**Fix.** Use pnpm exclusively for the frontend.

### `project-structure:backend-env-in-frontend`

Backend infrastructure variables in frontend .env

**Fix.** Keep frontend/.env and backend/.env separate. Never share secrets.

### `project-structure:missing-test-coverage`

Service has no test file

**Fix.** Add a test file under tests/unit/ covering its core invariants.

## Responsiveness

`responsiveness` · 5 rules

### `responsiveness:fixed-width-banned`

Fixed pixel width on page root

**Fix.** Use responsive or fluid widths instead of fixed pixel values.

### `responsiveness:absolute-no-breakpoint`

Absolute positioning without breakpoint

**Fix.** Add a responsive breakpoint variant (md:, lg:) to absolute positioning on layout elements.

### `responsiveness:nowrap-no-breakpoint`

whitespace-nowrap without responsive variant

**Fix.** Add a responsive breakpoint variant to whitespace-nowrap on layout elements.

### `responsiveness:missing-page-wrapper`

+page.svelte missing layout wrapper

**Fix.** Wrap the page content in <PageShell>, <Container>, or <AppLayout> as the direct root child.

### `responsiveness:no-breakpoint-classes`

No responsive breakpoint classes in .svelte file

**Fix.** Add responsive breakpoint variants (sm:, md:, lg:) for layouts.

## Structural

`structural` · 17 rules

### `structural:console-log-banned`

console.log / console.error / console.warn in committed code

**Fix.** Remove before committing. Use structured logging or your observability tooling instead.

### `structural:timers-banned`

setTimeout/setInterval in .svelte or $lib/

**Fix.** Use a reactive pattern, loader with streaming, or debounce with a derived.

### `structural:inline-style-banned`

inline style= attribute in .svelte

**Fix.** Use Tailwind utility classes defined in app.css.

### `structural:style-block-banned`

<style> block in .svelte

**Fix.** Remove the <style> block and express styles as Tailwind utility classes.

### `structural:app-stores-banned`

import from $app/stores

**Fix.** Use $app/state instead (Svelte 5 API).

### `structural:writable-banned`

writable / readable Svelte 4 stores

**Fix.** Use $state runes for reactive state.

### `structural:inline-svg-banned`

Inline <svg> with >2 children

**Fix.** Check Lucide first. Extract to $lib/components/ otherwise.

### `structural:effect-no-cleanup`

$effect without return cleanup

**Fix.** Add return cleanup, or use $derived/onMount instead.

### `structural:onmount-no-browser-api`

onMount without browser API reference

**Fix.** Use $derived for computed state. Only onMount with localStorage/sessionStorage/DOM refs.

### `structural:effect-single-call`

$effect that only calls a single function

**Fix.** Use onMount instead for single-function calls with no reactive dependencies.

### `structural:effect-present`

$effect usage (warrants review)

**Fix.** Confirm $effect has a cleanup function and references a browser-only imperative API.

### `structural:raw-fetch`

Raw fetch in services/

**Fix.** Use the typed openapi-fetch client from AppFactory in production code.

### `structural:missing-service-interface`

Service without I<ServiceName> interface

**Fix.** Define an I<ServiceName> TypeScript interface in the same file.

### `structural:factory-static-only`

AppFactory has non-static method

**Fix.** AppFactory uses static methods only and contains zero business logic.

### `structural:hooks-locals-limited`

hooks.server.ts sets non-user local

**Fix.** hooks.server.ts sets only locals.user — no other locals, no route guards, no data fetching.

### `structural:store-should-use-derived`

$effect writes $state from data/$props

**Fix.** Use $derived(by => data.X) instead of $effect to sync data into $state.

### `structural:derived-calls-fetch`

$derived calls fetch or a service method

**Fix.** $derived must be a pure computation — move async work to a loader.

## Test Structure

`test-structure` · 5 rules

### `test-structure:test-file-location`

Test file outside tests/unit/, tests/integration/, or tests/e2e/

**Fix.** Move into the correct directory.

### `test-structure:test-naming`

Test name does not describe an invariant

**Fix.** Name the test after the invariant it proves: test_cannot_X, test_returns_Y_when_Z.

### `test-structure:one-assert-per-test`

More than one assert/expect in a test

**Fix.** Split into separate test functions, one per assertion. Name each after the invariant it proves.

### `test-structure:mocking-banned`

Mocking library usage (jest.mock, vi.mock, spyOn)

**Fix.** Write a fake that implements the full Protocol/interface. Put it in tests/fakes/.

### `test-structure:skip-without-reason`

test.skip without reason

**Fix.** Add a reason string explaining why this test is skipped and when it should be re-enabled.
