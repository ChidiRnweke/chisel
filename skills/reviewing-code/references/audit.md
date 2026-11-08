# Auditing code against these standards

Use this to review a diff, a branch, or code written by another agent. Pair it with the project's own checkers and any automated multi-agent review; this pass looks for what checkers cannot see.

## Procedure

1. **Scope.** Get the diff (`git diff <base>...HEAD`) and the list of changed files. Read the project's instructions and the decision records for the touched areas.
2. **Run the gates** the project defines (type check, lint, architecture checkers, unit, integration). Record results. A checker allowance added in the diff is itself a finding to justify.
3. **Read the change by layer**, not by file order: models → services → repositories → controllers → factories → entry points → UI. For each file, apply the checklist below.
4. **Trace one operation end to end** per changed behaviour: where input is parsed, which rule decides, where state is written, how failure surfaces. Look for re-validation, duplicated rules, defaults that mask failure.
5. **Audit the tests** with the checklist; for each new behaviour test, check it would fail if the behaviour broke (mutate mentally or for real).
6. **Verify claims.** Every "fixed", "covered", "no behaviour change" in the description needs evidence in the diff or a run.
7. **Report** in the format below. Rank by severity. Do not pad with style nits the formatter would catch.

## Checklist

**Structure**

- [ ] No new layer, folder or wrapper that only moves code (adapters, managers, helpers with behaviour).
- [ ] Services do not call services (directly, via callbacks, via injected functions).
- [ ] Controllers do not touch repositories or other controllers.
- [ ] Entry points parse and call one controller operation; no business rules there.
- [ ] No server-side state outliving an operation.
- [ ] Dependencies typed as interfaces, never concrete classes or `Pick` of them.
- [ ] Services are cohesive: no one-method class that shares data and consumers with a sibling; no grab-bag class.
- [ ] Duplicated logic (same rule in two places, same method in sibling classes) collapsed into one.
- [ ] UI: stores hold state only; components do not call services or assemble workflows; no controller that only wraps a server call.

**Types and failure**

- [ ] Parsing only at the boundary; no `unknown`, casts onto literals, or re-validation inside.
- [ ] Optional fields pass the "always absent together" test; state-dependent payloads are unions.
- [ ] No `T | undefined` parameters that push a decision down.
- [ ] No silent catch; failures are rethrown or explicit failure values.
- [ ] No default that turns a failure into a quiet success.
- [ ] No new error category or branch for a state the design excludes.
- [ ] No unmeasured cap, limit, page size or truncation.
- [ ] Fakes and fixtures represent only producible states.

**Tests**

- [ ] Each test drives a public interface and asserts an observable behaviour.
- [ ] Expected values come from requirements, not from the code or its constants.
- [ ] No tests of copy, prompts, CSS, constant tables, key lists or type-level totality.
- [ ] No mocks, call-count assertions on internals, or casts to dependency types.
- [ ] No helper exported only for a test; no test keeping dead code alive.
- [ ] New behaviour tests shown to fail without the behaviour.
- [ ] Deleted tests: the behaviour they covered is still covered (or was not a behaviour).

**Change hygiene**

- [ ] Comments explain code, not callers, tests or history.
- [ ] Code size went down for a refactor, or the growth is justified.
- [ ] Commit and PR messages follow the format; validation claims match runs.
- [ ] Behaviour contract stated and verified for refactors of user-facing flows.

## Report format

For each finding:

```
[severity] path:line — one-sentence defect
  Rule: <which standard>
  Evidence: <code quote or trace>
  Failure scenario: <concrete input/state → wrong result>, or "maintenance: <cost>"
  Fix: <the shape of the fix, one or two lines>
```

Severities:

- **blocker** — wrong behaviour, data loss, a failure reported as success, security, a broken layer rule that a checker missed.
- **major** — design violation that will spread (service calling service, impossible-state handling, test that cannot fail, duplicated rule).
- **minor** — local cleanup (stale comment, narrow type could be narrower, redundant test).

End with: gates run and results, a count per severity, and the three findings to fix first. If nothing survives verification, say so plainly.
