# Types and errors

## Parse at the boundary

- Parse external data exactly once, where it enters: entry points, repositories (rows), the service owning a provider (responses), client storage/event readers. Schemas live next to the types they produce.
- Inside the boundary, types are total. Services and controllers never parse, never re-validate, never `typeof`-probe.
- Banned in the core: `unknown`/`any` in type positions, `Record<string, unknown>`, `isRecord`-style guards, cast probes (`x as { a?: unknown }`), `JSON.parse(...) as T`, schema `unknown()` fields.
- No type assertion onto an object literal (`{ ... } as T`, `as never`, `as unknown as T`). It turns off field checking. A single branded id cast is acceptable where visible.

## Honest types

- **Optionality must be honest.** A type describing something already decided has no optional fields for decided things. Request shapes and resolved shapes are different types even when similar.
- **Two optionals always absent together are one fact.** Mechanical test for every pair of optional fields: can one be present without the other? If not:
  1. they vary together → make the containing object optional, fields required;
  2. presence depends on a state → discriminated union, payload on the arm that has it.
- A boolean beside an optional payload (`{ ready: boolean; value?: T }`) is three states; write three arms.
- **Push the disjunction up.** The caller that knows whether a value exists decides. A function does not accept `T | undefined` so its caller can skip an `if`; that hands every function below it a case it cannot handle, and each invents a passive default.
- Brand identifiers so different ids cannot be swapped.
- Prefer exhaustive `switch` over discriminants; let the compiler prove totality instead of runtime tests.

## Errors

- **No silent catch.** A `catch` must rethrow or return an explicit failure value (`{ kind: 'failure', ... }`) the caller has to read. Logging or a toast is added on top, never instead.
- **Never supply a default that makes a failure look like success.** If code cannot tell "no data" from "the lookup failed", it must not default.
- **No impossible error categories.** Before adding an error class, branch or retry for a state, check the design: if the state is excluded where data enters, do not handle it downstream. Read the relevant decision records first.
- One error vocabulary for domain failures (validation, not found, conflict, ownership, external service, internal), each with a stable code and user-facing advice. External failures keep the original as `cause`.
- Already-classified errors pass through unchanged; do not rewrap and lose the code.
- Plumbing that every case needs (feedback conversion, tracing, logging at a boundary) goes in one higher-level, unskippable wrapper, not in each handler.
- Messages name the cause and what to do ("Could not reach file storage... check your connection"), not a generic "something went wrong".

## Defaults, limits, blast radius

- No cap, window, page size or truncation on a read without citing the measurement that motivated it. A guessed limit is silent data loss.
- A limit that discards accepted content is a defect, not tuning.
- **A missing value is usually a data bug.** Before adding a field or channel to carry it, find where it is produced and why it is not recorded there.
- **Blast radius is a signal.** If fixing one call site needs a new required field on a shared type, stop and re-derive the design.
- A fake or fixture must never represent a state production cannot produce.
