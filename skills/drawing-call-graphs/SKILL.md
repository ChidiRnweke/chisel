---
name: drawing-call-graphs
description: Create, update, check or review an interactive architecture call graph — one self-contained HTML page that maps entry points → controllers (use cases) → services → repositories and providers → backing stores, with typed operations, step diagrams and clickable models. Use when the user asks for a call graph, an architecture map, "who calls whom", or when a change adds, removes or renames a controller operation, service method, repository, provider or model in a project that keeps such a page.
---

# Drawing call graphs

A call graph page is the reference map of a layered codebase. A reader clicks a box and learns:

- why a controller exists;
- which services each operation calls, in order, and which value passes between them;
- the typed signature of every operation and method;
- the shape of every value, as a model they can open on its own.

The page is one HTML file with no build step. Only its JSON data block is written by hand. The
renderer and the rules come from this skill.

## Files

| File                              | Use                                                                     |
| --------------------------------- | ----------------------------------------------------------------------- |
| `assets/call-graph.template.html` | The renderer. Never copy it by hand; `sync-template.mjs` writes pages.  |
| `assets/validate.js`              | The rules. The page shows them on its check line; the script runs them. |
| `assets/example-data.json`        | A small example of every field. Start a new page from it.               |
| `references/schema.md`            | The data schema, field by field. Read it before you edit data.          |
| `scripts/sync-template.mjs`       | Creates a page (`--new`) or refreshes its renderer and keeps the data.  |
| `scripts/check-call-graph.mjs`    | Checks a page with Node only (no browser, no dependencies).             |

Run the scripts with the skill directory as the base, for example
`node <skill>/scripts/check-call-graph.mjs docs/architecture/call-graph.html`.

## The architecture it assumes

Five columns. Arrows run exactly one column to the right:

1. **Entry points**: HTTP routes, RPC or remote functions, agent tools, workers. Each one parses
   input and calls one controller operation.
2. **Controllers** (use cases): one operation per thing a user or system does. A controller
   sequences services, carries each value from one service to the next and owns the transaction.
3. **Services**: one capability each. **A service never calls another service.** It owns its
   repositories and providers.
4. **Repositories and providers**: persistence and external SDK clients, behind interfaces. A
   provider belongs to exactly one service.
5. **Backing stores**: databases, object storage, external APIs.

If a project does not fit this shape, say so before you draw it. Do not bend the page around a
missing layer.

## Workflow

1. **Find the sources.** Read the project's architecture notes, decision records and the code of
   the controllers, services, repositories, providers and models. Prefer a written module map when
   one exists. The page must agree with it.
2. **Create or refresh the page.**
   - New: `node <skill>/scripts/sync-template.mjs <page.html> --new`, then replace the example
     data.
   - Existing: edit only the JSON data block.
3. **Fill the data.** Follow `references/schema.md` and the writing guide below. Every parameter
   and result gets a type. Every type name is a model or a declared external.
4. **Check.** `node <skill>/scripts/check-call-graph.mjs <page.html>` must print `✓`. Fix every
   problem it lists; do not weaken a rule to pass.
5. **Look at it.** Open the page in a browser. Click a controller, an operation's types, a service
   and a model. The check line under the map must be green.
6. **Upgrade the renderer** when this skill changes:
   `node <skill>/scripts/sync-template.mjs <page.html>`. The check reports a page whose renderer is
   older than the skill.

## Rules

- **The graph is the target design.** Change it together with the decision or plan that changes
  the design. Do not edit it only to match code that drifted from a recorded decision; report the
  drift instead.
- **Status:** `planned` (not started), `interface` (the contract exists, nothing implements it),
  `built` (the class and its tests are merged). A single method can carry its own `status` when it
  is planned inside a built service.
- **Proposals:** a controller that is not decided yet gets `"proposal": true` and `"status":
"planned"`, and each step gets `"reuse": "reused"` or `"new"`. The page lists proposals in their
  own section.
- **Types:** use the project's type syntax (`T[]`, `T | null`, `Page<T>`, `{ key: T }`,
  `'literal'`). Field paths (`Node.id`) and object keys are ignored when the check resolves names.
  A type that is not part of the project, such as a language or SDK type, goes in `externals`.
- **One model, one place:** a type name appears in one model or one external only.

## Writing guide

Write plainly: short sentences, active voice, common words, the same term for the same thing.

- **Controller `what`:** one sentence on what it does for its callers.
- **Controller `why`:** two to four sentences. Say what need or risk makes it exist, who reaches it
  and how it fits the rest of the system, and which decisions shape it. Name what it deliberately
  does not do when a reader could expect it.
- **Operation `what`:** one or two sentences on what the operation does for its caller, what it
  guarantees (locks, transactions, what is logged) and how it fails. Every operation needs one; the
  page shows it above the operation's diagram.
- **Method `what`:** one sentence on its effect and the rule a caller must know: what it returns
  when the item is missing or hidden, what it locks, what it refuses.
- **Model `what`:** what the value means and when it exists, not its fields; the `def` shows the
  fields.
- **Step `note`:** a few words on a condition, a lock or a failure path.

## Review checklist

- Every controller operation in the contract has a diagram, and every diagram is in the contract.
- Each step's method exists in that service, with the same name.
- Each arrow label names the model that the controller hands to that step.
- No service owns another service's repository; no provider has two owners.
- The check prints `✓`, and the page's check line is green.
