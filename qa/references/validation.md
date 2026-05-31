# Validation

How to verify that code matches its spec. Three checks: invariant coverage, architecture compliance, and test quality.

---

## Invariant validation

The invariants file is the source of truth. Validation means checking that every invariant is both implemented in code and verified by a test.

### Reading the invariants file

Invariants are documented in domain language. Each invariant describes a rule that must always hold:

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

| Invariant                         | Implemented                                | Tested                                                           | Status                |
| --------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- | --------------------- |
| Recipe title must be non-empty    | `RecipeService.create` raises `InputError` | `test_rejects_empty_title`, `test_rejects_whitespace_only_title` | ✅ Covered            |
| Users can only delete own recipes | `RecipeService.delete` checks `user_id`    | `test_non_owner_cannot_delete`                                   | ✅ Covered            |
| Soft-delete for recipes           | Not found in `RecipeRepository.delete`     | No test                                                          | ❌ Missing            |
| Pantry items belong to one user   | Enforced by DB FK constraint               | `test_find_by_user_id_returns_only_user_recipes`                 | ⚠️ Implicit (DB only) |
```

Status categories:

- **✅ Covered** — implemented in code AND verified by at least one test
- **⚠️ Partial** — implemented but test coverage is incomplete (e.g., happy path tested but not error path)
- **⚠️ Implicit** — enforced only by infrastructure (DB constraint, type system) with no domain-level test. Flag for discussion — sometimes this is fine, sometimes it needs an explicit test
- **❌ Missing implementation** — invariant documented but code doesn't enforce it
- **❌ Missing test** — code enforces it but no test verifies
- **🚨 False confidence** — test exists but code doesn't actually enforce the invariant (test is passing for the wrong reason)

### Cross-agent validation

Because invariants are documented, a separate agent can validate another agent's work:

1. **Implementation agent** writes code
2. **QA agent** reads the invariants file and the code, produces the coverage report
3. Neither agent needs to understand the other's internal reasoning — the invariants file is the shared contract

This is the same decoupling principle as the architecture itself: agents are coupled to the spec, not to each other.

---

## Architecture compliance

The chisel dependency graph is strict and mechanically verifiable. Check these rules:

### Backend (Python)

```
models/        → imports nothing from other layers
services/      → imports models, repository Protocols only
repositories/  → imports models, ORM models (internal), errors
controllers/   → imports service Protocols, models
factory.py     → imports concrete implementations of everything
routes/        → imports factory, models (for response types)
errors.py      → imports nothing from other layers
config.py      → imports nothing from other layers
```

**Violations to flag:**

| Violation                                       | Why it's wrong                              | Fix                                              |
| ----------------------------------------------- | ------------------------------------------- | ------------------------------------------------ |
| Service imports another service                 | Creates hidden coupling, breaks testability | Push composition to controller, or inject via DI |
| Service imports `AsyncSession` or ORM types     | Service leaks into infrastructure           | Repository owns all DB access                    |
| Controller contains `if` logic over domain data | Business logic in orchestration layer       | Move to service                                  |
| Route handler contains business logic           | HTTP layer doing domain work                | Delegate to controller/service                   |
| Factory contains conditional logic              | Factory should only wire, never decide      | Move logic to service                            |
| Model imports from service/repository           | Data layer depends on behaviour layer       | Models are leaf nodes, no upward imports         |
| Route handler assembles services directly       | Bypasses factory, loses consistency         | Use `factory.get_X_controller()`                 |
| ORM type appears outside repository             | Infrastructure leaking into domain          | Map to domain model in repository                |

### Frontend (SvelteKit)

```
models/        → imports nothing
services/      → imports models, API client types only
controllers/   → imports service interfaces, models
factories/     → imports concrete services, controllers
stores/        → imports models only
+page.svelte   → imports stores, components, $props only
+page.server   → imports factory, models, SvelteKit utilities
```

**Violations to flag:**

| Violation                                         | Why it's wrong                     | Fix                             |
| ------------------------------------------------- | ---------------------------------- | ------------------------------- |
| `+page.svelte` imports a service                  | UI directly calling business logic | Use loader data or store        |
| Store calls `fetch()`                             | Store doing server work            | Populate store from loader data |
| Loader contains business logic                    | HTTP layer doing domain work       | Delegate to controller/service  |
| Controller imports `createApiClient`              | Controller touching infrastructure | Service wraps the client        |
| `components['schemas']['X']` used outside service | API types leaking into domain      | Map at service boundary         |

### How to check

For Python, scan imports:

```python
# Pseudocode for automated check
for file in services/:
    imports = extract_imports(file)
    for imp in imports:
        if imp.startswith("myapp.services.") and imp != current_file:
            flag("Service imports another service", file, imp)
        if "AsyncSession" in imp or "sqlalchemy" in imp:
            flag("Service imports ORM/session", file, imp)
```

For TypeScript, same approach with import scanning. The rules are mechanical — they can be checked without understanding the code's purpose.

---

## Test quality audit

Beyond invariant coverage, audit the tests themselves:

### Checklist

- [ ] **No mocking libraries** — search for `mock`, `Mock`, `patch`, `vi.mock`, `jest.mock`, `spyOn`
- [ ] **One assertion per test** — each test function has exactly one `assert` / `expect`
- [ ] **Behaviour-focused** — no assertions on call counts, argument matchers, or internal method invocations
- [ ] **Fakes in shared directory** — `tests/fakes/` not duplicated per file
- [ ] **Fakes implement full Protocol** — not partial mocks that only stub what one test needs
- [ ] **Test names describe invariants** — `test_cannot_X`, `test_returns_Y_when_Z`, not `test_method_name`
- [ ] **Test classes reference invariants** — class docstring links to the invariant being verified
- [ ] **No test interdependence** — tests can run in any order, each sets up its own state
- [ ] **No shared mutable state** — fixtures return fresh instances, no module-level state
- [ ] **Integration tests use real DB** — testcontainers for repository tests, not SQLite

### Producing the audit report

```markdown
## Test Quality Audit

### Summary

- Total test files: 12
- Total test functions: 47
- Mocking library usage: 0 (clean)
- Multi-assertion tests: 3 (flag)
- Implementation-focused tests: 1 (flag)
- Invariant coverage: 14/16 (2 gaps)

### Issues

| File                   | Test                  | Issue                                              | Severity |
| ---------------------- | --------------------- | -------------------------------------------------- | -------- |
| test_recipe_service.py | test_create_recipe    | 3 assertions — split into separate tests           | High     |
| test_recipe_service.py | test_calls_repository | Asserts method was called — test behaviour instead | High     |
| test_pantry_service.py | test_add_item         | Uses `unittest.mock.patch`                         | Critical |

### Gaps

| Invariant                     | Status        |
| ----------------------------- | ------------- |
| Soft-delete for recipes       | No test found |
| Max 100 pantry items per user | No test found |
```

---

## Running validation

Validation can be triggered in three modes:

1. **After test generation** — automatically cross-reference new tests against invariants file
2. **On review request** — user asks "are my tests good?" or "check test quality"
3. **On code review** — user asks "does this code match the spec?" — check both architecture compliance and invariant enforcement

In all modes, produce a concrete report with file paths, line numbers, and specific fixes. Never say "consider adding tests" — say exactly which invariant needs a test and in which file.