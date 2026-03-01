---
name: feature-blueprint
description: Use this skill whenever the user wants to plan a new feature, refactor, or significant change to an existing codebase. Trigger when the user says "plan", "feature", "blueprint", "what needs to change", "how should I implement", or describes a feature they want built. Also trigger when the user wants to break down a large task into agent-executable steps. This skill interviews the user, explores the codebase, and produces a plan file that an executor agent can run from start to finish without supervision.
---

# Blueprint

Plan features so an agent can build them unsupervised.

---

## What this skill produces

A `<feature>-plan.md` file in the project root. This file is the complete instruction set for an
executor agent. It contains everything the agent needs to understand the current state of the
codebase, what needs to change, and how to verify each step is done correctly.

The executor agent runs in a loop: read the blueprint, pick the next unchecked item, do it,
check it off, commit, repeat. This a loop designed for a single agent in a
loop, doing one thing per iteration, with the plan as its fixed reference point. The agent doesn't need to hold the whole project in its head. It reads the blueprint at the start of every loop, does the next thing, and trusts that the plan will guide it to completion.

**The blueprint must be good enough that you can walk away.** If you can't, the plan isn't specific enough or it's missing context the agent will need.

---

## Phase 1: Interview

Before exploring any code, interview the user. The goal is to understand the feature deeply
enough to plan it. Ask about:

- **What** the feature does — user-facing behaviour, not implementation
- **Why** it exists — what problem it solves, what triggered the request
- **Scope boundaries** — what's explicitly out of scope for this round
- **Constraints** — must it integrate with existing patterns? Are there performance requirements?
- **Dependencies** — does it need new libraries, APIs, infrastructure?
- **Acceptance criteria** — how will we know it's done? What should a user be able to do?

Collect all of this before touching the codebase. Don't assume — ask. Ask follow-up questions
until you have enough to plan without further input.

Keep it conversational, not a checklist interrogation. Adapt to what the user is telling you.
If they've already given context in the conversation, don't re-ask.

---

## Phase 2: Reconnaissance using Tree and Subagents

Explore the codebase to understand the as-is state. This is critical — the plan must account
for what already exists, not just what needs to be built.

**Use subagents for exploration.** Do not pollute your primary context window with the full
contents of dozens of files.

Instead, dispatch targeted exploration tasks:

- Read the project's `CLAUDE.md`, `AGENTS.md` and `README.md` if they exist
- Identify which layers will be touched (models, services, repositories, controllers, routes, components)
- Use Tree to get a high-level view of the file structure in relevant areas (e.g., backend/services, frontend/components). Read as little as possible to get the lay of the land - just enough to figure out what subagents to dispatch.
- Find existing patterns the new feature must follow
- Identify adjacent code that the feature interacts with
- Check for existing tests, migration patterns, and conventions
- **IMPORTANT** manually check if the user has any domain-specific skills (e.g., `frontend-design`) that you can use to better inform your plan. If they do, read those skills and incorporate their patterns and constraints into your plan.

Summarise findings concisely. The goal is to build a mental map of:

1. **What exists** that the feature touches
2. **What patterns** are already established (and must be followed)
3. **What's missing** that needs to be created

---

## Phase 3: Interface Design (optional — human decides)

If the feature involves backend logic, propose a TDD-first approach:

1. Draft the Protocol/interface for the new service(s)
2. Draft the domain models (dataclasses/interfaces) the feature introduces
3. Propose test cases that define the expected behaviour

Present these to the user for review. The idea is red-green development: the executor agent
writes tests first (red), then implements until they pass (green).

**This phase is optional.** The user may skip it — especially for UI-heavy features where
TDD is less natural. If the user skips, move directly to Phase 4. Don't push.

When the user engages with this phase:

- Keep interfaces minimal — only the methods the feature actually needs
- Propose 3–5 test cases per service, not exhaustive coverage
- Focus on behaviour, not implementation details
- Include edge cases and error paths, not just happy paths

---

## Phase 4: Write the Blueprint

Produce a `<feature>-plan.md` with the following structure:

```markdown
# Blueprint: [Feature Name]

## Context

[2–3 paragraphs: what this feature does, why it exists, and what the codebase currently
looks like in the areas it touches. Write this for an agent that has never seen the project
— it needs to understand the landscape before making changes.]

## Scope

**In scope:**

- [Concrete deliverables]

**Out of scope:**

- [Things explicitly not included in this round]

## Architecture Decisions

[Key decisions made during planning. Why this approach over alternatives. What patterns
from the existing codebase must be followed. Reference specific files and conventions.]

## Interfaces and Models

[If Phase 3 was done, include the agreed interfaces and models here. If skipped, describe
the expected inputs/outputs of the new components in prose.]

## Plan

Steps are deliberately fine-grained. Each step targets a specific file or tightly related
concern. Exact file paths, class names, method signatures, and patterns are specified —
the executor should not need to make any structural decisions.

- [ ] **Step 1: [Title]**
      **Files:** `path/to/file.py` (create), `path/to/other.py` (modify)
      **What:** [Specific instructions — exact class name, method signatures, what it does,
      which existing file to follow as a model. Name everything.]
      **Verify:** [Exact command to run or specific behaviour to confirm before checking off.]

- [ ] **Step 2: [Title]**
      **Files:** ...
      **What:** ...
      **Verify:** ...

- [ ] **Step N: [Title]**
      ...

## Tests

[If Phase 3 produced test cases, list them here. If not, describe what the executor
should test and how. Include the command to run tests.]

## Verification

[How to verify the feature works end-to-end once all steps are checked off.
Include specific commands, URLs to visit, or behaviours to confirm.]
```

### Step granularity

This is the most important calibration in the entire skill. Steps must be fine-grained
and prescriptive:

- **One file or one coherent concern per step.** "Implement RecipeService" is too broad —
  that's a domain model, a Protocol, an implementation class, and wired dependencies. Split
  it: one step for the model, one for the Protocol, one for the implementation, one for wiring.

- **Specify exact names.** The step must name the files to create or modify, the classes and
  methods to add, and the function signatures where they're non-obvious. The executor should
  not have to decide what to call anything.

- **Reference the pattern explicitly.** Don't say "follow existing patterns." Say "follow the
  same structure as `PantryService` in `backend/src/myapp/services/pantry_service.py` —
  Protocol interface, dataclass implementation, repository injected via constructor,
  module-level structlog logger."

- **Independently verifiable.** Each step has a clear "done" state — an exact test command,
  a UI element to confirm, a specific server response. The executor checks the box when it
  can prove the step works, not when it thinks it's done.

- **Ordered by dependency.** Later steps can depend on earlier ones. Never require the
  executor to jump around.

A good heuristic: if you described this step to a developer, would they know exactly which
file to open and what to type? If they'd still have to decide what to name something, which
layer to put it in, or how to wire it — the step is too vague. Split it or add more detail.

When in doubt, split. A plan with 20 sharp steps is far better than one with 8 ambiguous ones.

### Referencing existing patterns

For every step that creates new code, point to an existing file that demonstrates the pattern:

> Create `RecipeService` following the same structure as `PantryService` in
> `backend/src/myapp/services/pantry_service.py` — Protocol interface + dataclass
> implementation, repository injected via constructor, module-level structlog logger.

This is how you prevent the agent from inventing its own patterns. It copies what works.

---

## Phase 5: Executor Instructions

Add a section at the top of `BLUEPRINT.md` that the executor agent reads every loop:

```markdown
## Executor Instructions

You are executing this blueprint. Follow these rules:

1. **Read this file first.** Every loop, re-read this file before doing anything.
   After context compaction, this file is your ground truth.
2. **Do the next unchecked step.** Find the first `- [ ]` item. Do that. Only that.
3. **Verify before checking off.** Run the verification described in the step.
   If it passes, change `- [ ]` to `- [x]` and commit.
4. **Commit after each step.** `git add -A && git commit -m "blueprint: [step title]"`
5. **Don't skip ahead.** Steps are ordered by dependency.
6. **Follow existing patterns.** When the step references an existing file as an example,
   match its structure. Don't invent new patterns.
7. **If stuck, document and move on.** If a step is blocked, add a note under it explaining
   why, check it off as blocked, and move to the next step. Don't spiral.
8. **Update this file.** If you discover something during execution that future steps need
   to know, add a note in the relevant step. Keep the blueprint as the single source of truth.
```

---

## Calibration Notes

### Prescribe structure, leave implementation details

Steps must specify all structural decisions: exact file paths, class and method names, which
existing file to use as a pattern, how the pieces wire together. What they don't need to
dictate is the internal logic — the executor can work out how to implement a method given
a clear signature and a model to follow.

Vague step (bad): "Implement RecipeService with get_by_id and create methods. Follow the
same pattern as PantryService. Include the Protocol interface. Wire it into the factory."

This leaves too much open: which file? what exact signatures? what does the Protocol look
like? which part of the factory?

Prescriptive step (good): "Create `backend/src/myapp/services/recipe_service.py`. Define
`RecipeServiceProtocol` with `get_by_id(recipe_id: str) -> Recipe | None` and
`create(data: RecipeCreate) -> Recipe`. Implement `RecipeService` as a dataclass following
the same structure as `PantryService` in `pantry_service.py` — repository injected via
constructor, module-level structlog logger. Register it in `factory.py` alongside
`PantryService`. Verify: `pytest tests/services/test_recipe_service.py` passes."

### Don't plan what you can't verify

Every step needs a way to prove it's done. If you can't describe how to verify a step,
the step is too vague or too abstract. Make it concrete.

### UI steps are different

For frontend/UI work, TDD doesn't apply naturally. Instead:

- Reference the design system (`DESIGN_SYSTEM.md`) for visual decisions
- Point to existing components as structural examples
- Describe the user-visible behaviour, not the implementation
- Verification is "the page renders with the correct data and matches the design system"

### The blueprint is a living document

The executor updates it as it works. Steps get checked off. Notes get added. If the executor
discovers that a step needs to be split or reordered, it should update the blueprint.
The blueprint is the single source of truth for the feature — not the conversation that
produced it, not the git history, the blueprint.
