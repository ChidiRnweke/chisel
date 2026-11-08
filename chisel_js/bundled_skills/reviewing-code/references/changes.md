# Changes, comments and documentation

## Comments

- A comment explains the code it sits on: why it exists, what invariant it relies on, what would break. It does not narrate callers, test usage ("replaced in tests"), history ("used to"), or the work diary.
- No comment restating the code. No commented-out code. No TODO without an owner and reason.
- Match the surrounding comment density and idiom.

## Commits and pull requests

- Conventional Commits: `type(scope): lowercase subject`, `!` or a `BREAKING CHANGE:` footer for breaking changes. Body lines wrapped at 72 columns.
- One coherent task per PR. Prefer one larger, coherent PR per capability move over many tiny stacked PRs; stacks rot when the base moves.
- PR body sections: **Why** (the concrete problem and who it affects), **What changed** (previous vs resulting behaviour, grouped by behaviour, with the reason for each consequential choice), **Evidence** (repeatable scenario and observed result; before/after captures for visible changes), **Validation** (checks actually run, with results; say what was not run).
- Write in plain, precise English: short sentences, active voice, consistent terms, no marketing, no file inventories, no work diary.
- Report outcomes faithfully. Never claim a check passed that did not run. Pending CI is not passing.

## Refactor hygiene

- A refactor keeps behaviour identical unless the change says otherwise; state the behaviour contract up front and verify it (tests plus a manual scenario for user-facing flows).
- A refactor should shrink the code. If it does not, re-derive the design before proceeding.
- Do not silence one checker to satisfy another. An allowance comment is for a genuinely unavoidable boundary exception and must give a reason a reviewer can audit; it is never a migration mechanism.
- When porting another branch's fix into restructured code, port the behaviour into the new layer; do not copy the old shape back in.
- Delete dead code, obsolete plans and stale handoff documents once their work lands. Committed plans and audit inventories go stale and mislead future readers once the work is done.

## Documentation and decisions

- Decisions that constrain future work go in decision records (ADRs): context, decision, consequences, with concrete behaviour statements a test can verify.
- Before architecture work, read the decision records for the area. Later decisions supersede earlier ones; unmerged proposals do not establish behaviour.
- Root documents hold entry points and contribution rules; architecture references, design guidance and plans have their own folders. Update links when moving documents.
