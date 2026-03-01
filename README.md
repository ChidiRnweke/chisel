# chisel

Opinionated architecture skills for AI-assisted fullstack development. SvelteKit + Python FastAPI, monorepo-first. These can be used with Claude Code or anything else that supports skills (e.g., opencode).

## Why "chisel"?

A chisel turns raw material into something deliberate. That's what these skills do — they take an LLM's general coding ability and shape it into disciplined, production-grade output.

This is me distilling what I've learned as a software/ML engineer into reusable skills that anyone can plug into their AI workflow. They're opinionated because opinions are what make codebases consistent.

Feel free to use them. Let me know what worked and what didn't — I'm iterating on these actively.

## Skills

| Skill | What it covers |
|---|---|
| `fullstack-swe` | Monorepo structure, Pattern A (TS monolith) vs Pattern B (BFF), project setup, cross-cutting concerns |
| `python-swe` | FastAPI backend: services, repositories, controllers, factory, config, error hierarchy, SQLAlchemy |
| `svelte-swe` | SvelteKit frontend: loaders, actions, stores, openapi-fetch, error handling, layer separation |
| `svelte-ui` | Design system creation, token system, shadcn theming, component architecture, blandness audit |

## Usage

Reference skills from your project's `CLAUDE.md`:

```markdown
@.claude/skills/fullstack-swe/SKILL.md
@.claude/skills/svelte-ui/SKILL.md
```

Or add them to your agent's skill/context configuration.

## How to use these skills effectively

1. Give the model a concrete task. If you're not manually invoking a skill with `/skill-name`, include the relevant skill paths in context.
2. If execution drifts from the plan, tell it to reread the plan and continue. That usually improves adherence quickly.
3. For greenfield or large projects, use `fullstack-swe` + `feature-blueprint` to generate the high-level plan first.
4. Break big features into subplans with checkboxes. Keep each subplan in its own plan file and track progress with checkmarks.

Recommended planning loop:

- Clear context, then ask a fresh model to review your plan files against `@.claude/skills/` constraints.
- Ask whether the plans are executable and unambiguous, and what is missing.
- Iterate until the reviewer says the plan is complete.
- Handover to an executor model to implement step-by-step.

Suggested review prompt:

```text
Review the plans in this repo against @.claude/skills/.
Tell me whether they respect the skill constraints, whether they are executable,
and whether they are unambiguous. What else would you need?
```

Minimal blueprint pattern (trimmed):

```markdown
# Blueprint: <feature name>

## Executor Instructions
1. Re-read this file each loop.
2. Execute only the next unchecked step.
3. Complete referenced subplans before returning.
4. Verify before checking off.
5. Keep plan files updated with discoveries.

## Plan
- [ ] Step 1: foundations
- [ ] Step 2: backend subplan
- [ ] Step 3: frontend subplan
- [ ] Step 4: UI subplan
- [ ] Step 5: integrated verification
```

## Structure

```
.claude/skills/
├── fullstack-swe/
│   └── SKILL.md
├── python-swe/
│   ├── SKILL.md
│   └── references/
│       ├── layers.md
│       ├── fastapi.md
│       └── sqlalchemy.md
├── svelte-swe/
│   ├── SKILL.md
│   └── references/
│       ├── layers.md
│       ├── openapi.md
│       └── error-handling.md
└── svelte-ui/
    ├── SKILL.md
    └── references/
        └── audit.md
```

