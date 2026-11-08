# Testing

## What a test is for

A test proves a **behaviour** a user, caller or decision record requires, through the **public interface** that delivers it. It keeps passing under any refactor that preserves the behaviour, and it fails when the behaviour breaks.

Before writing a test, name two things: the public surface it drives, and the requirement its expected value comes from.

Public surfaces: a controller operation, a service's interface method, an entry point (RPC, route, tool `invoke`), a rendered component, a store's public API, a worker run. Not: internal event arms, reader result shapes, private helpers, constants, label objects.

## Keep, rewrite, delete

- **Keep** a test that drives a public operation and asserts an observable outcome whose expected value is independent of the code.
- **Rewrite** a test that guards a real behaviour through internals. Example: a decision says large documents are searchable in full. The bad test asserts an internal chunk index is `>= 50`. The good test saves a long document through the public operation, indexes it, and asserts a unique marker near its end is returned by the public search.
- **Delete:**
  - tests of copy, prompt or description wording, CSS strings, constant tables, key lists, uniqueness of constant arrays, or totality the type system already proves;
  - tests whose expected value is recomputed with the production constant or formula (`expect(x).toBe(MAX - RAIL - CHROME)`);
  - lower-layer duplicates of a behaviour already proven through the public operation;
  - tests of exports nothing in production calls; delete the dead export with them.
- Do not export a helper only so a test can reach it. Test it through its caller, or it is not a unit worth its own test.

## Expected values

- Take them from requirements, decision records, confirmed regressions or literal domain examples. Never compute them with the code under test or its constants.
- Check values on both sides of a boundary (just under, at, just over), with literals.
- Cover the failure paths the design promises (conflict returns the remote version, a failure is reported not degraded).

## Doubles

- No mocking libraries (`vi.fn`, `jest.mock`, `spyOn`), no `toHaveBeenCalled*` on internal collaborators, no partial objects cast to a dependency type.
- Use typed hand-written in-memory fakes that implement the real interface, shared from one testing folder; keep useful in-memory collaborators real.
- A typed recorder may verify an **external** effect (what was sent to a provider, a required payload, the absence of a duplicate). Do not assert how often an input stub was queried or the order of internal calls.
- A fake must not represent a state production cannot produce.
- Persistence claims need real database evidence (integration tests against the real engine) and independent result reads. A fake-backed test does not prove SQL or transaction behaviour.

## Shape

- One behaviour per test. Several assertions may describe that one behaviour; do not split its outcomes to count assertions, and do not combine unrelated scenarios.
- One spec file per concern, next to the unit under test. Integration and end-to-end suites live where the project puts them.
- Fresh data per test, fixed time, no order dependence. No unexplained skips.
- Prefer one comparison of a whole result (`toEqual({ status, body, rows })`) over many fragment checks.

## Proving a test works

- A new behaviour test must fail on the base revision, or under a deliberate mutation of the behaviour (cap the loop, drop the refresh, remove the guard). Record that once in the change description.
- For UI changes, reproduce in the running app with seeded data and capture before/after evidence; a passing component test is not proof the screen is right.

## Coverage

- Coverage locates untested public behaviour; it does not justify trivial tests or a universal percentage.
- Compare coverage before and after a test cleanup. A drop must be explained: dead code removed, or behaviour now covered elsewhere. Unexplained drops mean behaviour lost its test.
- Do not test getters, framework behaviour, or the same behaviour at every layer.
