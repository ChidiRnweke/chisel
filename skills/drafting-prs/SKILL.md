---
name: drafting-prs
description: Draft or revise pull request titles and bodies as concise, self-contained records of intent, behavior, and verified evidence. Use when preparing or updating a PR, and before implementing a UI change that needs before/after captures.
---

# Drafting PRs

A PR is durable context for humans and agents who arrive later. Explain why the change
was needed and what it does so a reader can understand it without the diff or conversation.

## Gather the context

Read the task request, final changes, relevant checks, and repository contribution rules.
Preserve the original problem and intended outcome in your own words. Do not describe the
prompting process or invent rationale that the request and evidence do not support.

Read relevant merged PRs when they explain earlier intent or behavior. Check that history
against current code and accepted ADRs. An unmerged proposal is not evidence of current behavior.
Include a related PR or ADR link only when it helps explain this change.

Prepare evidence early. For UI fixes, attempt reproduction before editing. For a PR drafted
after implementation, recover the before state from the base revision in an isolated worktree
when feasible. Never reset another agent's worktree.

## Write in Simplified Technical English

Write in the register of an architecture decision record: dry, precise, and about behavior
and its consequences. A PR is durable context for a human or agent who arrives later, so the
body must state the reason for the change as well as the change itself. Do not write a
marketing summary, a change log, or a work diary.

Apply the practical STE conventions without claiming formal certification: short sentences,
one idea per sentence, active voice, and common words; the same term for the same thing; a
necessary technical term defined at its first use; concrete verbs. Remove filler, praise,
metaphor, and sales language. Adjectives name a quality, not a value; a value statement names
what a user or system can now do.

Make the body semantic, not mechanical. Group changes by behavior and explain why each
behavior exists; a component inventory is not a description. "The app writes an edit to a
queue before it reports success, so closing the browser cannot lose the edit" describes
behavior and its reason. "A queue store was added" lists a part. State the reason for a
consequential choice, and keep a rejected alternative only when it explains a material choice.

Use the repository's Conventional Commit title format. Name the concrete problem or resulting
behavior, not the internal mechanism. Rewrite the title and the body around the final
implementation when scope changes.

Use exactly these four sections, in this order:

### Why

Open with the problem, stated concretely and in behavior terms, and say who or what it
affects. State the intended outcome as an observable consequence, not a quality. Define the
subject before you refer to it by a shorthand: a reader cannot act on a noun the text has not
named. Do not open with a slogan (for example, a feature "needs to work offline"), and do not
open with a list of edits. Preserve the reason the work was requested.

### What changed

Explain previous and resulting behavior, with a concrete trigger or example when useful.
Describe the final solution and the choices behind it. Include API, compatibility, migration,
or rollout details here only when a reader needs them to understand or use the change.

Format for scanning: lead each behavior group with a bold phrase, keep paragraphs to a few
sentences, and keep the section headings stable across the body.

### Evidence

Give a repeatable scenario and the observed result. For visible frontend changes, include
captioned before/after screenshots. For a new UI, show the starting state and resulting flow.
For nonvisual changes, use a concrete input/output example, relevant result, or compact
before/after comparison. Do not force screenshots onto documentation or backend-only work.

### Validation

Name checks actually run and their results. State material limitations and checks not run
when they leave a relevant gap. Distinguish a seeded UI check from full end-to-end verification.
Do not report pending CI as passed. Update this section when the final results arrive.

Keep each section as short as the change allows. Remove file inventories, work diaries, raw
logs, abandoned approaches, repeated summaries, template comments, and empty checklist items.
Keep a rejected approach only when it explains a material choice.

## Reproduce and capture UI behavior

Attempt UI reproduction unless the scenario is too intricate and depends on live external calls,
such as an LLM. First check whether representative stored data can expose the same UI state.
If reproduction remains impractical, explain the specific limitation and what was verified instead.

Use the project's authenticated test setup when the screen needs a session. `AGENTS.md` names it
and explains startup. Inspect the current Playwright configuration rather than assuming that
starting the dev server also creates a session.

You may inject representative data into a local development/test database to reproduce a state.
Confirm the target is local development/test, use valid production-producible records, and keep
the fixture scoped to the scenario. Record the setup or seed command needed to repeat it.
Remove only data created for the scenario after verification. Do not modify production data.

Capture the actual running application. Use matching data, viewport, theme, and interaction
state for before/after comparisons where possible. Include the affected hover, focus, drag,
error, or loading state when that is the issue. Inspect each capture for the claimed result.
Never substitute a generated mockup or label an after capture as before.

When a state needs a live external call or is otherwise impractical to reach in the full app,
render the component instead: a temporary fixture route that supplies seeded props to the real
component, served by the normal dev server. The page must load the app's real global stylesheet so
the capture carries the real tokens and utilities. A component test runner usually does not, so do
not screenshot from it. Drive the page with Playwright, and give the region an id so the capture is
the surface rather than the viewport.

For the before state, stash the source and shoot again against the same running server:
`git stash push -- src docs`, capture, `git stash pop`. This keeps the data, viewport and server
identical across the pair, which a second worktree does not. Remove the temporary fixture and
restore the route file before committing; the images are the only artifact that lands.

Two mechanics that silently spoil a capture: setting the theme the wrong way (check how the app
switches themes, for example a `dark` class on `document.documentElement` or a `data-theme`
attribute); and a click leaves a focus ring, so blur the active element and move the pointer away
before shooting.

Keep temporary captures under ignored `artifacts/`. Commit only useful evidence images under
`docs/pr-evidence/<task>/`, using descriptive names such as `sidebar-before.png`.
Exclude credentials and private content; use synthetic data where needed.

Embed images in the PR with full commit-pinned `github.com` blob URLs and `?raw=true`:
`https://github.com/<owner>/<repo>/blob/<full-commit-sha>/docs/pr-evidence/<task>/<file>.png?raw=true`.
This repository is private (internal), and `raw.githubusercontent.com` does not use the
reader's github.com session, so a raw URL shows a broken image. Use the real pushed commit that
contains the image. After pushing, check that each file exists at that commit, for example with
`gh api repos/<owner>/<repo>/contents/<path>?ref=<sha>`. Local paths and expiring CI artifacts do
not provide durable evidence. If an image changes or a rebase replaces its commit, update the URL
to the new pushed commit.

Give every image descriptive alt text and a visible caption. The caption names the screen,
state, and observable result, such as "Before — at 1024 px, the open panel covers the Save button."
Record shared reproduction details once. If a before image is unavailable, say why and provide
the verified after state; never fabricate the comparison.

## Publish and review

Use the repository PR template when it matches this structure. When using `gh`, write the exact
body to a temporary file and pass `--body-file` to preserve Markdown and avoid shell expansion.

Follow the task's authorization and repository rules for opening or updating a PR. Drafting
alone does not authorize publishing, merging, or unrelated external actions.

Before publishing, read the body without the diff. Can a new reader explain the original
problem, the resulting behavior, and the evidence? Remove anything that does not help them.
Verify image links and captions, and ensure every validation claim matches an observed result.
