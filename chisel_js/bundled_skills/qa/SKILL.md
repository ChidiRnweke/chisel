---
name: qa
description: Choose, write, and review unit, integration, database, frontend, and end-to-end tests. Gives mandatory reference-reading rules and concrete good/bad Python and TypeScript examples. Uses typed handwritten fakes and recorders, not mocking libraries.
---

# QA

A good test fails when the answer is wrong and keeps passing when helper methods change.
A bad test can pass with wrong results, or fail because internal code was rearranged.

## Required reading

Before writing, changing, or reviewing tests, you **MUST read [Test design](references/test-design.md)**
and every matching reference below. Read them before choosing assertions or changing code.
Read each required reference once per task; read newly matching references if the task expands.

- **Prices, permissions, deadlines, calculations:** [Unit tests](references/unit-testing.md).
  Test different answers and values at cutoffs.
- **Saving, retrieving, SQL, migrations, transactions, ORM:** [Database tests](references/database-testing.md).
  Test real persistence, returned records, and rollback.
- **File exports, messages, external APIs:**
  [Integration tests](references/integration-testing.md). Test contents, required effects, and failures.
- **Typing, clicking, loading, errors, layout:** [Frontend tests](references/frontend-testing.md).
  Test what the user sees and can do.
- **Important tasks through the public UI/API, including routing or authentication:**
  [End-to-end tests](references/end-to-end-testing.md). Check completion through the application.
- **Using, writing, or changing fakes, stubs, recorders, or recording closures:**
  [Test doubles](references/test-doubles.md).
- **Considering test-only flags, private-method overrides, exposing private fields, or refactoring
  production code to make it testable:** [Testability](references/testability.md).
- **Reviewing existing tests, auditing coverage, or deciding which tests to remove:**
  [Reviewing tests](references/validation.md).

Examples show test logic. Adapt their imports and fixtures to the project's existing test harness.

## Write good tests

- Get expected answers from requirements or confirmed examples, not the code being tested.
- Test one action and all its required results together. Several assertions are allowed.
- Keep real helper code. Use typed handwritten substitutes where needed; no mocking libraries
  or casts that hide incomplete objects.
- Start with fresh, valid data. Use fixed time for deadlines.
- Use real database tests for SQL and rollback; fakes cannot prove them.
- Prefer fast, readable tests. Add slower tests for bugs the fast tests cannot catch.

Skip simple getters, library behavior, and redundant cases. Do not chase coverage percentages
or create a test for every method.

Follow project instructions and run relevant checks. Report conflicts and unavailable infrastructure;
do not weaken checks or claim untested results passed.

## What chisel checks

`chisel-js check` enforces the mechanical part of this skill; judgement stays with the reviewer.

- `test-structure:no-assertion` — a test that asserts nothing. One behaviour may assert all of
  its outcomes; there is no ceiling on assertions.
- `test-structure:mocking-banned` and `test-structure:interaction-assertion` — mocking libraries
  and assertions on calls. Use typed fakes and recorders.
- `test-structure:untyped-fake` — a `Fake*`, `Stub*` or `InMemory*` class declared in a spec
  with no interface.
- `test-structure:unsafe-dependency-cast` — an object or array literal cast through `unknown`,
  which builds a state production cannot produce.
- `test-structure:skip-without-reason` and `test-structure:test-file-location`.

When testing a checker's own rules, take each expected diagnostic from the decision the rule
encodes, never from the checker's current output, and pair every prohibited pattern with the
valid neighbour it must leave alone.
