---
name: qa
description: Test generation and validation for layered TypeScript/SvelteKit projects. Use this skill whenever the user asks to write tests, review test quality, validate code against invariants, check architecture compliance, or audit test coverage. Also trigger when the user says "test this", "add tests", "is this tested", "does this match the invariants", "check architecture rules", or asks about fakes, test structure, or test strategy. This skill enforces a strict testing philosophy — no mocking libraries, hand-rolled fakes, one assertion per test, behaviour over implementation. It also validates that code respects the architectural dependency graph in AGENTS.md and that all documented invariants have corresponding tests.
---

# QA Skill

Test generation and validation for projects that follow the layered architecture in `AGENTS.md`.
Two jobs: write good tests and verify that code matches its spec.

## Reference files

Read these when working in the relevant area:

- `references/testing-patterns.md` — Fakes, test structure, assertion style, layer-by-layer examples
- `references/validation.md` — Invariant checking, architecture compliance, coverage auditing

---

## Philosophy

These are not guidelines. They are rules. Every test this skill produces or reviews must follow them.

### No mocking libraries

Never use `vi.mock()`, `vi.fn()`, `vi.spyOn()`, `jest.mock()`, `toHaveBeenCalled*`, or any mocking framework. Ever.

If you need a test double, write a fake — a plain class that implements the same interface as the real dependency. Fakes are explicit, readable, and debuggable. They are ten lines of code, not a framework. For a function-typed dependency, use a typed recording closure that stores what it received in an array the test can read.

Why: mocking libraries are a crutch for architectures that can't easily construct their own objects. This architecture is stateless with injected, interface-typed dependencies — you can always instantiate directly. If you can't, the architecture is broken, not the test.

### One assertion per test

Every `it()` asserts exactly one thing. One behaviour. One invariant. One reason to fail.

The test name describes the invariant: `it('rejects a recipe with an empty title')`, not `it('create recipe')`. When a test fails, the name tells you what broke. You never read through a chain of assertions to find the red one.

If you're tempted to add a second `expect`, write a second test.

### Test behaviour, not implementation

A test should answer: "given this input, does this output/state change match what the domain requires?"

Never assert that a method was called with specific arguments. Never assert call counts. Never assert the internal sequence of operations. These test wiring, not business rules. If you refactor the internals and the behaviour is the same, zero tests break.

Expected values come from requirements and decisions, never from the code under test or its constants. A new test must fail when the behaviour it covers is broken — check it against the base revision or by breaking the code on purpose.

### Invariants are the test spec

The invariants — in `docs/invariants.md` when it exists, and the behaviour statements in the ADRs under `docs/decisions/` — define what must be true. Each invariant maps to one or more tests. If an invariant exists without a corresponding test, that's a gap. If a test exists without a corresponding invariant, question why it exists.

### Test the domain, not the glue

Prioritise tests by value:

1. **Model tests** — validate schemas, value constraints, constructors. Zero dependencies, zero fakes needed.
2. **Service tests** — validate business rules. Inject fakes for repositories and providers. This is where most invariants live.
3. **Controller tests** — validate orchestration. Inject fake services. These are thin — controllers shouldn't have much logic.
4. **Remote functions / routes** — rarely need dedicated tests when they only parse and delegate. Integration and e2e tests cover them.
5. **Repository integration tests** — run against a real Postgres (the `compose.yaml` database or a test container), never an in-memory substitute. Fewer of these, but they catch query and mapping bugs.
6. **Component tests** — vitest browser mode for interaction behaviour a user can observe. Not for copy, CSS, or markup shape.

---

## Workflow

### Generating tests for existing code

1. **Find the invariants.** Read `docs/invariants.md` and the relevant ADRs first — they are the spec. If none exist, tell the user and suggest writing them before tests (or offer to derive invariants from the code, with the caveat that this is backwards — tests should verify independent specs, not mirror code).

2. **Identify the layer.** Read the file under test and determine its layer (model, service, repository, controller, remote function, store, component). This determines what fakes you need and what you're testing.

3. **Write fakes first.** Before writing any test, create the fakes for the dependencies. Each fake implements the interface of the real dependency. Fakes live in `src/lib/testing/` (named `InMemory<Thing>`), shared across tests, never duplicated per spec file. Fakes have sensible defaults, allow per-test configuration, and never represent a state production cannot produce.

4. **Write tests.** One test per invariant or behaviour. Group with `describe` by the behaviour they verify, not by the method they call. Name each `it` after the invariant.

5. **Verify coverage against invariants.** After writing tests, cross-reference against the invariants. Report any gaps — invariants without tests, or tests without invariants.

### Reviewing existing tests

When asked to review tests, check for:

- **Mocking library usage** — flag immediately. Suggest fake replacement.
- **Multiple assertions** — flag. Split into separate tests.
- **Implementation testing** — flag assertions on call counts, argument matching, internal method calls. Rewrite to assert on output/behaviour.
- **Missing invariant coverage** — cross-reference with the invariants.
- **Fat tests** — tests that set up complex scenarios testing too many things at once. Split.
- **Redundant tests** — tests that duplicate what another test already covers. Remove.
- **Tests that cannot fail** — the assertion would pass with the behaviour removed. Rewrite or delete.

### Validating code against invariants

When asked to validate, read the invariants and the implementation, then report:

- **Enforced** — invariant is implemented and tested
- **Implemented but untested** — code enforces it but no test verifies
- **Tested but not implemented** — test exists but the code doesn't actually enforce the invariant (dangerous — false confidence)
- **Missing** — neither implemented nor tested

### Checking architecture compliance

Validate the dependency graph described in `AGENTS.md`:

- Models import nothing from other layers
- Services import models and their own repository/provider interfaces, never other services
- Repositories import models and the database client only
- Controllers import service interfaces and models, never repositories or other controllers
- Factories construct and wire, with zero logic
- Remote functions parse input and call one controller operation — no business logic
- Stores hold state only; components never import server code
- No circular dependencies anywhere

---

## File structure

Specs are colocated with the unit under test, one spec file per concern:

```
src/lib/
├── models/recipes/recipe.ts
├── models/recipes/recipe.spec.ts
├── server/services/recipes/recipe-service.ts
├── server/services/recipes/recipe-service.spec.ts
├── server/controllers/recipes/controller.ts
├── server/controllers/recipes/controller.spec.ts
├── server/repositories/recipes/recipe-repository.ts
├── server/repositories/recipes/recipe-repository.integration.spec.ts
├── components/recipes/RecipeCard.svelte
├── components/recipes/RecipeCard.svelte.spec.ts
└── testing/                       # Shared fakes
    ├── in-memory-recipe-repository.ts
    └── in-memory-pantry.ts
src/routes/**/*.e2e.ts             # Playwright
```

---

## For detailed patterns, read:

- **Fakes, test structure, assertion style, examples per layer** → `references/testing-patterns.md`
- **Invariant validation, architecture compliance, coverage auditing** → `references/validation.md`
