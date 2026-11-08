---
name: reviewing-code
description: Review code against the project's coding standards for structure, types, errors, tests and change hygiene, using a fixed audit procedure and report format. Use when reviewing a diff, branch or PR, auditing code written by another agent or person, or when the user says "review this", "audit this", "check against the standards", or "is this up to snuff". Also read its references when writing or refactoring code, designing a module or layer, or preparing a refactor plan.
---

# Reviewing code

Code is a system of small, typed seams. Every input becomes one typed value at the edge, then passes through one rule and one seam. Nothing downstream re-checks what the edge already decided. The parts fit snugly; there is no procedural glue, no defensive branch for a state that cannot happen, and no layer added to escape a design problem.

Two modes:

- **Writing code.** Read the reference for the area you touch before you write. Follow the project's own instructions and decision records (ADRs) first; they win over this skill where they are more specific.
- **Reviewing code.** This is the main use. Follow [references/audit.md](references/audit.md). Report findings with evidence. Never "fix" an audit finding by silencing a checker.

## The rules that matter most

1. **Layers are closed.** Models (data), services (rules + their own I/O through repositories or providers), repositories (persistence only), controllers (sequence services), factories (construct and wire), entry points (parse, then call a controller). In a UI: stores (reactive state only) and components. Do not invent a layer to satisfy a checker or to hide a coupling. See [references/architecture.md](references/architecture.md).
2. **Services never call services.** If a service needs another service, the capability is cut wrong. Recut it, or sequence both in a controller.
3. **Stateless servers.** State is a value inside one operation or a database row. No server-side caches, stores or registries holding request data.
4. **Parse at the boundary; inside, types are total.** No `unknown`, no `Record<string, unknown>`, no casts onto object literals, no re-validation in the core. See [references/types-and-errors.md](references/types-and-errors.md).
5. **Make illegal states unrepresentable.** Two optional fields that are always absent together are one optional object. State-dependent payloads are a discriminated union. A boolean beside an optional payload is a union.
6. **Fail loudly.** No silent catch. A caught failure is rethrown or returned as an explicit failure value the caller must read. Never default in a way that makes a failure look like success. No cap, window or limit without a cited measurement.
7. **No impossible error categories.** Before adding an error type or branch, check whether the state is producible. If the design excludes it where data enters, do not "support" it later.
8. **Tests prove behaviour through public interfaces.** Expected values come from requirements and decisions, never from the code under test. No mocking libraries. A new test must fail when the behaviour is broken. See [references/testing.md](references/testing.md).
9. **Cohesion over fragmentation.** One class per cohesive capability (same data, same consumers, same reason to change), implementing narrow interfaces. Do not split into many one-method classes; do not merge unrelated responsibilities.
10. **Changes explain themselves.** Comments explain the code they sit on. Commits and PRs state the problem, the resulting behaviour and observed evidence. See [references/changes.md](references/changes.md).

## Reference files

| File                                                  | Read when                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| [architecture.md](references/architecture.md)         | Designing modules, layers, dependencies, composition, UI state, agent/tool code |
| [types-and-errors.md](references/types-and-errors.md) | Defining types, parsing input, handling failures, defaults and limits           |
| [testing.md](references/testing.md)                   | Writing, reviewing, deleting or auditing tests; coverage                        |
| [changes.md](references/changes.md)                   | Comments, commits, PRs, docs, decision records, refactor hygiene                |
| [audit.md](references/audit.md)                       | Auditing code (yours or another agent's) against these standards                |
