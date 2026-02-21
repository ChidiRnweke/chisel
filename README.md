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
@path/to/chisel/fullstack-swe/SKILL.md
@path/to/chisel/svelte-ui/SKILL.md
```

Or add them to your agent's skill/context configuration.

## Structure

```
chisel/
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

