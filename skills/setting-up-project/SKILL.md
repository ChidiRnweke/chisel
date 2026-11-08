---
name: setting-up-project
description: Set up a new project's founding decisions by interviewing the user through the drafting-adrs skill. Use when the user starts a new project, says "set up the project", "project setup", "kick off", or when a repository has no decision records yet.
---

# Setting up a project

This skill does not decide anything itself. It runs the `drafting-adrs` skill in interview mode
and makes sure the result is recorded where future agents will read it.

## Steps

1. Read `AGENTS.md`, `README.md`, `package.json`, and any existing `docs/decisions/`. Note what the
   scaffold already decides (framework, database, test tools) so you do not ask about it again.
   Ask only why, when the reason matters for a later choice.
2. Invoke the `drafting-adrs` skill and follow its **Interview mode**. Work through these topics in
   order. Skip a topic when the user says it does not apply.
   - The problem, the users, and the main things they must be able to do.
   - The core domains (the nouns the system owns) and how they relate.
   - Persistence: what is stored, where, and what must survive a failure.
   - Identity: authentication, accounts, tenancy, and permissions.
   - Offline and sync: whether the browser keeps a local copy and edits without a connection.
   - External services and AI: providers, what they may do, and how failures reach the user.
   - Deployment and operations: where it runs, environments, observability.
   - Any rule the user wants the codebase to keep that `AGENTS.md` does not state yet.
3. Write one ADR per confirmed decision, in the order they are confirmed. Do not batch them at the
   end.
4. For the visual direction and UX patterns, hand off to the `designing-svelte-ui` skill (Phase 0
   and Phase 1). It writes `docs/design/design-system.md`. Do not duplicate that in an ADR unless a
   choice has a real trade-off beyond style.
5. Update `AGENTS.md`:
   - Point to `docs/decisions/` if it does not already.
   - Record any confirmed change to the standard layout or architecture, with a link to its ADR.
   - Keep it short. `AGENTS.md` holds rules and pointers, not rationale.

## Finish

Report the ADRs written, the open questions the user did not answer, and any decision that was
too weak for an ADR and where you recorded it instead. Land the result as one PR that follows
`AGENTS.md` (worktree, Conventional Commit, `drafting-prs`).
