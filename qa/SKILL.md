---
name: qa
description: Test generation and validation for chisel-architecture projects. Use this skill whenever the user asks to write tests, review test quality, validate code against invariants, check architecture compliance, or audit test coverage. Also trigger when the user says "test this", "add tests", "is this tested", "does this match the invariants", "check architecture rules", or asks about fakes, test structure, or test strategy. This skill enforces a strict testing philosophy — no mocking libraries, hand-rolled fakes, one assertion per test, behaviour over implementation. It also validates that code respects the architectural dependency graph and that all documented invariants have corresponding tests.
---

# QA Skill

Test generation and validation for chisel-architecture projects. Two jobs: write good tests and verify that code matches its spec.

## Reference files

Read these when working in the relevant area:

- `references/testing-patterns.md` — Fakes, test structure, assertion style, layer-by-layer examples
- `references/validation.md` — Invariant checking, architecture compliance, coverage auditing

---

## Philosophy

These are not guidelines. They are rules. Every test this skill produces or reviews must follow them.

### No mocking libraries

Never use `unittest.mock`, `pytest-mock`, `jest.mock()`, `vi.mock()`, Mockito, or any mocking framework. Ever.

If you need a test double, write a fake — a plain class that implements the same Protocol or interface as the real dependency. Fakes are explicit, readable, and debuggable. They are ten lines of code, not a framework.

Why: mocking libraries are a crutch for architectures that can't easily construct their own objects. Chisel's architecture is stateless with injected dependencies — you can always instantiate directly. If you can't, the architecture is broken, not the test.

### One assertion per test

Every test function asserts exactly one thing. One behaviour. One invariant. One reason to fail.

The test name describes the invariant: `test_cannot_create_recipe_with_empty_title`, not `test_create_recipe`. When a test fails, the name tells you what broke. You never read through a chain of assertions to find the red one.

If you're tempted to add a second assertion, write a second test.

### Test behaviour, not implementation

A test should answer: "given this input, does this output/state change match what the domain requires?"

Never assert that a method was called with specific arguments. Never assert call counts. Never assert the internal sequence of operations. These test wiring, not business rules. If you refactor the internals and the behaviour is the same, zero tests break.

### Invariants are the test spec

The invariants file defines what must be true. Each invariant maps to one or more tests. If an invariant exists without a corresponding test, that's a gap. If a test exists without a corresponding invariant, question why it exists.

### Test the domain, not the glue

Prioritise tests by value:

1. **Model tests** — validate data rules, value constraints, computed properties. Zero dependencies, zero fakes needed.
2. **Service tests** — validate business logic. Inject fakes for repositories/API clients. This is where most invariants live.
3. **Controller tests** — validate orchestration. Inject fake services. These are thin — controllers shouldn't have much logic.
4. **Route/loader tests** — rarely needed. If loaders are truly thin (just delegate to controller), they don't need dedicated tests. Integration tests cover them.
5. **Integration tests** — validate the full stack with a real database (testcontainers). Fewer of these, but they catch wiring bugs.

---

## Workflow

### Generating tests for existing code

1. **Find the invariants file.** If it exists, read it first — it's the spec. If it doesn't exist, tell the user and suggest creating one before writing tests (or offer to derive invariants from the code, with the caveat that this is backwards — tests should verify independent specs, not mirror code).

2. **Identify the layer.** Read the file under test and determine which layer it belongs to (model, service, controller, repository, route/loader). This determines what fakes you need and what you're testing.

3. **Write fakes first.** Before writing any test, create the fakes for the dependencies. Each fake implements the Protocol/interface of the real dependency. Fakes go in a shared test fixtures directory, not duplicated per test file. Fakes should have sensible defaults and allow per-test configuration.

4. **Write tests.** One test per invariant or behaviour. Group tests by the behaviour they verify, not by the method they call. Name tests after the invariant: `test_<what_must_be_true>`.

5. **Verify coverage against invariants.** After writing tests, cross-reference against the invariants file. Report any gaps — invariants without tests, or tests without invariants.

### Reviewing existing tests

When asked to review tests, check for:

- **Mocking library usage** — flag immediately. Suggest fake replacement.
- **Multiple assertions** — flag. Split into separate tests.
- **Implementation testing** — flag assertions on call counts, argument matching, internal method calls. Rewrite to assert on output/behaviour.
- **Missing invariant coverage** — cross-reference with invariants file.
- **Fat tests** — tests that set up complex scenarios testing too many things at once. Split.
- **Redundant tests** — tests that duplicate what another test already covers. Remove.

### Validating code against invariants

When asked to validate, this skill reads the invariants file and the implementation, then reports:

- **Enforced** — invariant is implemented and tested
- **Implemented but untested** — code enforces it but no test verifies
- **Tested but not implemented** — test exists but the code doesn't actually enforce the invariant (dangerous — false confidence)
- **Missing** — neither implemented nor tested

### Checking architecture compliance

This skill also validates the dependency graph:

- Models import nothing from other layers
- Services import models and repository Protocols only, never other services
- Controllers import service Protocols and models only
- Factory imports everything concrete but contains zero logic
- Routes/loaders contain no business logic — only delegation
- No circular dependencies anywhere

---

## File structure

```
tests/
├── conftest.py              # Shared fixtures: session, config, factory
├── fakes/                   # All fakes live here, shared across tests
│   ├── __init__.py
│   ├── fake_recipe_repository.py
│   ├── fake_recipe_service.py
│   └── fake_pantry_service.py
├── unit/
│   ├── models/
│   │   └── test_recipe.py
│   ├── services/
│   │   └── test_recipe_service.py
│   └── controllers/
│       └── test_recipe_controller.py
└── integration/
    └── repositories/
        └── test_recipe_repository.py
```

Frontend tests follow the same structure under `frontend/src/lib/__tests__/` or colocated as `*.test.ts`.

---

## For detailed patterns, read:

- **Fakes, test structure, assertion style, examples per layer** → `references/testing-patterns.md`
- **Invariant validation, architecture compliance, coverage auditing** → `references/validation.md`
