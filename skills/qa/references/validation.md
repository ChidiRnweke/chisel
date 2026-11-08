# Validation

How to verify that code matches its spec. Three checks: invariant coverage, architecture compliance, and test quality.

---

## Invariant validation

The invariants are the source of truth: `docs/invariants.md` when it exists, plus the behaviour statements in the accepted ADRs under `docs/decisions/`. Validation means checking that every invariant is both implemented in code and verified by a test.

### Reading the invariants

Invariants are written in domain language. Each describes a rule that must always hold:

```
- An order cannot be placed if inventory is zero
- Users can only delete their own recipes
- A recipe title must be non-empty
- Pantry items belong to exactly one user
- Deleted recipes are soft-deleted, not hard-deleted
```

### Producing a coverage report

For each invariant, determine its status:

```markdown
## Invariant Coverage Report

| Invariant                         | Implemented                              | Tested                                                   | Status                |
| --------------------------------- | ---------------------------------------- | -------------------------------------------------------- | --------------------- |
| Recipe title must be non-empty    | `recipeTitle` schema rejects empty input | `rejects an empty title`, `rejects a whitespace-only...` | ✅ Covered            |
| Users can only delete own recipes | `RecipeService.delete` checks the owner  | `refuses when the actor does not own the recipe`         | ✅ Covered            |
| Soft-delete for recipes           | Not found in `DrizzleRecipeRepository`   | No test                                                  | ❌ Missing            |
| Pantry items belong to one user   | Enforced by a database foreign key       | `returns only the recipes of the requested owner`        | ⚠️ Implicit (DB only) |
```

Status categories:

- **✅ Covered** — implemented in code AND verified by at least one test
- **⚠️ Partial** — implemented but test coverage is incomplete (e.g., happy path tested but not error path)
- **⚠️ Implicit** — enforced only by infrastructure (database constraint, type system) with no domain-level test. Flag for discussion — sometimes this is fine, sometimes it needs an explicit test
- **❌ Missing implementation** — invariant documented but code doesn't enforce it
- **❌ Missing test** — code enforces it but no test verifies
- **🚨 False confidence** — test exists but code doesn't actually enforce the invariant (test is passing for the wrong reason)

### Cross-agent validation

Because invariants are documented, a separate agent can validate another agent's work:

1. **Implementation agent** writes code
2. **QA agent** reads the invariants and the code, produces the coverage report
3. Neither agent needs to understand the other's internal reasoning — the invariants are the shared contract

---

## Architecture compliance

The dependency graph in `AGENTS.md` is strict and mechanically checkable:

```
models/                → other models only
services/              → models only (shared by browser and server, no I/O)
server/services/       → models, its own repository/provider interfaces
server/repositories/   → models, the database client
server/controllers/    → service interfaces, models
server/factories/      → everything they wire, no logic
remote/                → controllers (through the composition root), models
stores/                → models only
components/            → stores, models, remote functions, browser controllers
client/                → models, browser APIs
```

**Violations to flag:**

| Violation                                          | Why it's wrong                               | Fix                                            |
| -------------------------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| Service imports another service                    | Hidden coupling; the capability is cut wrong | Recut the service, or sequence in a controller |
| Service imports the database client                | Service bypasses its repository              | Repository owns all database access            |
| Controller imports a repository                    | Writes skip the rules around them            | Go through the owning service                  |
| Controller imports another controller              | Hidden sequencing                            | Make it a service capability or recut          |
| Controller contains `if` logic over domain data    | Business rule in orchestration               | Move to a service                              |
| Remote function contains business logic            | Entry point doing domain work                | Delegate to one controller operation           |
| Factory contains conditional logic                 | Factories wire, never decide                 | Move the decision to a service                 |
| Model imports from a service or repository         | Data depends on behaviour                    | Models are leaf nodes                          |
| Drizzle row type appears outside a repository      | Persistence leaks into the domain            | Map to a domain model in the repository        |
| Component or store imports `$lib/server/**`        | Server code in the browser                   | Call a remote function                         |
| Store calls `fetch()` or a remote function         | Store doing server work                      | A component or browser controller loads data   |
| Browser controller that only wraps one remote call | A layer with no job                          | Call the remote function directly              |

### How to check

Scan imports per layer. The rules are mechanical — they can be checked without understanding the code's purpose:

```bash
# services importing other services
grep -rn "from '#lib/server/services/" src/lib/server/services
# controllers importing repositories
grep -rn "repositories" src/lib/server/controllers
# browser code importing server code
grep -rln "\$lib/server\|#lib/server" src/lib/components src/lib/stores src/lib/client
```

Then read each hit; a type-only import of an interface beside its own service may be fine.

---

## Test quality audit

Beyond invariant coverage, audit the tests themselves.

### Checklist

- [ ] **No mocking libraries** — search for `vi.mock`, `vi.fn`, `vi.spyOn`, `jest.`, `toHaveBeenCalled`
- [ ] **One assertion per test** — each `it` has exactly one `expect`
- [ ] **Behaviour-focused** — no assertions on call counts, argument matchers, or internal method invocations
- [ ] **Fakes in `src/lib/testing/`** — not duplicated per spec file
- [ ] **Fakes implement the full interface** — no partial objects cast to a dependency type
- [ ] **Fakes represent only producible states**
- [ ] **Test names describe invariants** — `rejects X`, `returns Y when Z`, not method names
- [ ] **No test interdependence** — tests run in any order; each sets up its own state
- [ ] **No shared mutable state** — fresh fakes per test, no module-level state
- [ ] **Repository tests use a real Postgres** — never an in-memory database substitute
- [ ] **New tests fail without the behaviour** — verified against the base revision

### Producing the audit report

```markdown
## Test Quality Audit

### Summary

- Spec files: 12
- Tests: 47
- Mocking library usage: 0 (clean)
- Multi-assertion tests: 3 (flag)
- Implementation-focused tests: 1 (flag)
- Invariant coverage: 14/16 (2 gaps)

### Issues

| File                   | Test             | Issue                                           | Severity |
| ---------------------- | ---------------- | ----------------------------------------------- | -------- |
| recipe-service.spec.ts | creates a recipe | 3 assertions — split into separate tests        | High     |
| recipe-service.spec.ts | saves the recipe | Asserts `save` was called — assert stored state | High     |
| pantry-service.spec.ts | adds an item     | Uses `vi.mock`                                  | Critical |

### Gaps

| Invariant                     | Status        |
| ----------------------------- | ------------- |
| Soft-delete for recipes       | No test found |
| Max 100 pantry items per user | No test found |
```

---

## Running validation

Validation can be triggered in three modes:

1. **After test generation** — cross-reference new tests against the invariants
2. **On review request** — the user asks "are my tests good?" or "check test quality"
3. **On code review** — the user asks "does this code match the spec?" — check both architecture compliance and invariant enforcement

In all modes, produce a concrete report with file paths, line numbers, and specific fixes. Never say "consider adding tests" — say exactly which invariant needs a test and in which file.
