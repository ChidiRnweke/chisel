---
name: fullstack-swe
description: Architecture and patterns for full-stack projects. Use this skill when the user is building or reviewing a full-stack application — frontend + backend together — or when they ask where to put something and the answer spans both layers. Also trigger when the user mentions "full-stack", "monorepo", "BFF", "which skill should I use", or starts a new project and hasn't decided on a stack yet. This skill is a lightweight orchestrator — it decides the architecture pattern and hands off to the specialised skills for implementation details.
---

# Fullstack SWE Skill

This skill decides the architecture and then hands off to the right specialised skills. It does
not repeat what those skills already cover — read them directly for implementation details.

---

## Blueprint

Read this skill to decide the architecture pattern and project structure. Then read the specialised skills (`python-swe`, `svelte-swe`, `svelte-ui`) for implementation details on each layer.

Finally, ask the user if they want you to start coding or explicitly invoke the `feature-blueprint` skill to write a detailed plan.

## Monorepo — Always

Every project is a monorepo. Even if there's only a frontend today, the structure accommodates a
backend tomorrow without reorganising. One repo, one agent context, full 360° visibility.

```
project-root/
├── CLAUDE.md                # Project-level context — read first every session
├── AGENTS.md                # Design system decisions (populated by svelte-ui skill)
├── .github/                 # CI/CD workflows
├── docker-compose.yml       # Local dev: frontend + backend + postgres
├── frontend/                # SvelteKit app
│   ├── package.json         # pnpm as package manager
│   ├── pnpm-lock.yaml
│   ├── svelte.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── .env                 # Frontend env vars only — never shares secrets with backend
│   └── src/
│       ├── app.css
│       ├── app.html
│       ├── hooks.server.ts
│       ├── routes/
│       └── lib/
│           ├── api/         # openapi-fetch client + generated schema.d.ts
│           ├── models/
│           ├── services/
│           ├── controllers/
│           ├── factories/
│           ├── stores/
│           └── components/
│               ├── ui/          # shadcn auto-generated
│               ├── primitives/  # Themed wrappers
│               ├── layout/      # Page-level structure
│               └── domain/      # Feature-specific
└── backend/                 # Python FastAPI app — src layout
    ├── pyproject.toml       # Project metadata, dependencies, tool config
    ├── alembic.ini
    ├── .env                 # Backend env vars only
    ├── alembic/
    │   ├── env.py
    │   └── versions/
    ├── tests/
    │   ├── conftest.py
    │   ├── unit/
    │   └── integration/
    └── src/
        └── myapp/           # Replace "myapp" with actual project name
            ├── __init__.py
            ├── app.py       # FastAPI create_app()
            ├── config.py    # AppConfig.from_env()
            ├── factory.py
            ├── errors.py
            ├── dependencies.py
            ├── models/
            │   └── __init__.py
            ├── services/
            │   └── __init__.py
            ├── repositories/
            │   ├── __init__.py
            │   └── orm/
            │       ├── __init__.py  # Imports all ORM models for Alembic
            │       └── base.py      # DeclarativeBase
            ├── controllers/
            │   └── __init__.py
            └── routes/
                └── __init__.py
```

### Why monorepo, always

- An agent (Claude Code, Cursor, etc.) can see the full stack in one context window
- Cross-stack changes (backend endpoint + frontend service + UI) happen in one commit
- Shared `.github/` CI, shared `docker-compose.yml`, shared `CLAUDE.md`
- No version drift between frontend expectations and backend reality

### Package management

- **Frontend**: pnpm. Use `pnpm` for all commands. `pnpm-lock.yaml` committed.
- **Backend**: `pyproject.toml` with pip or uv. No `setup.py`, no `requirements.txt`.
  Use the src layout (`backend/src/myapp/`) so imports are always `from myapp.x import y`.

### Running locally

```yaml
# docker-compose.yml
services:
  db:
    image: postgres
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: myapp
      POSTGRES_PASSWORD: myapp
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    env_file: ./backend/.env
    ports:
      - "8000:8000"
    depends_on:
      - db
    volumes:
      - ./backend/src:/app/src # hot reload

  frontend:
    build: ./frontend
    env_file: ./frontend/.env
    ports:
      - "5173:5173"
    depends_on:
      - backend
    volumes:
      - ./frontend/src:/app/src # hot reload

volumes:
  pgdata:
```

For local dev without Docker, run backend and frontend in separate terminals:

```bash
# Terminal 1 — backend
cd backend && uv run uvicorn src.myapp.app:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && pnpm dev
```

---

## Step 1: Decide the Architecture

Before writing any code, determine which pattern fits. Both use the monorepo structure above.

### Pattern A — TypeScript Monolith

**Use when:**

- Team is TypeScript-only, no dedicated backend engineers
- Backend is relatively simple (CRUD, light business logic)
- Rapid prototyping or early-stage product
- No existing backend / microservices to integrate with

**Stack:** SvelteKit as the full-stack framework. Server routes / API routes handle
backend logic. Database accessed directly from the server layer (Drizzle or Prisma).
The `backend/` folder is omitted or used only for shared scripts/migrations.

**Structure:** Same monorepo, but `backend/` is either absent or minimal:

```
project-root/
├── CLAUDE.md
├── AGENTS.md
├── frontend/               # SvelteKit handles everything
│   ├── package.json
│   └── src/
│       ├── lib/
│       │   ├── db/         # Drizzle schema + migrations
│       │   ├── services/   # Business logic (same layering discipline)
│       │   └── models/
│       └── routes/
└── docker-compose.yml      # Just postgres for local dev
```

### Pattern B — BFF (Backend-for-Frontend)

**Use when:**

- Separate Python backend already exists or is planned
- Backend has its own OpenAPI spec
- Teams split across frontend and backend
- Business logic is complex enough to warrant a dedicated backend
- Backend needs to run independently (scheduled jobs, other consumers)

**Stack:** SvelteKit frontend + Python FastAPI backend. Full monorepo structure as shown above.

---

## Step 2: Hand off to Specialised Skills

Once the pattern is decided, the relevant skills take over. Read them fully before writing code.

### Pattern A — TypeScript Monolith

| What you're building              | Read                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| Pages, components, UI             | `svelte-ui` skill — design system first, always                                              |
| Loaders, actions, stores, routing | `svelte-swe` skill — BFF patterns apply here too, minus the openapi layer                    |
| Database schema + queries         | Use Drizzle. Follow the repository pattern from `svelte-swe` — keep DB access out of loaders |

**Key adaptation for Pattern A:** The `svelte-swe` skill is written for BFF with a separate
backend, but the layering discipline is identical. The difference is your "service" calls Drizzle
directly instead of an openapi-fetch client. Everything else — no business logic in loaders,
controllers for multi-service orchestration, stores for client state — applies unchanged.

### Pattern B — BFF

| What you're building                        | Read                                   |
| ------------------------------------------- | -------------------------------------- |
| Frontend pages, components, UI              | `svelte-ui` skill                      |
| Frontend loaders, actions, stores           | `svelte-swe` skill                     |
| Backend services, controllers, repositories | `python-swe` skill                     |
| Typed API client (frontend ↔ backend)       | `svelte-swe` → `references/openapi.md` |

The contract between frontend and backend is the OpenAPI spec. The backend owns it. The
frontend generates types from it and never hand-writes API types.

---

## Step 3: Project Setup Checklist

Regardless of pattern, do these before writing features:

### Both patterns

- [ ] Monorepo structure created as shown above
- [ ] `CLAUDE.md` at project root (see below)
- [ ] `AGENTS.md` at project root with design system decisions (populated by `svelte-ui` skill)
- [ ] `docker-compose.yml` for local dev (at minimum: postgres)
- [ ] ESLint + Prettier configured in `frontend/`
- [ ] TypeScript strict mode on
- [ ] Environment variable validation at startup (fail fast)
- [ ] `.gitignore` covers both `frontend/node_modules` and `backend/__pycache__`, `.venv`, etc.

### Pattern A additions

- [ ] Drizzle configured with Postgres in `frontend/src/lib/db/`
- [ ] Migration workflow established (`drizzle-kit push` for dev, `migrate` for prod)
- [ ] Database URL in `frontend/.env`, never hardcoded

### Pattern B additions

- [ ] Backend uses src layout: `backend/src/myapp/`
- [ ] `pyproject.toml` configured with dependencies and tool settings
- [ ] OpenAPI spec location agreed and documented in `CLAUDE.md`
- [ ] `generate:api` script in `frontend/package.json`
- [ ] Backend `AppConfig.from_env()` validated at startup
- [ ] Separate `.env` files: `frontend/.env` and `backend/.env`
- [ ] Alembic configured and `alembic/env.py` imports all ORM models

---

## CLAUDE.md

Every project gets a `CLAUDE.md` at the root. It is the first thing Claude reads at the start
of any session. Populate it during project setup and keep it current.

```markdown
# Project: [Name]

## Architecture

Monorepo — [Pattern A (TypeScript Monolith) / Pattern B (BFF)]

## Stack

- Frontend: SvelteKit [version], pnpm
- Backend: [Python FastAPI / N/A]
- Database: [Postgres via Drizzle / SQLAlchemy + Alembic]
- Auth: [describe approach]

## Monorepo layout

- `frontend/` — SvelteKit app (pnpm)
- `backend/` — Python FastAPI app, src layout (`backend/src/myapp/`)
- `docker-compose.yml` — local dev stack

## Key conventions

- [Any project-specific deviations from the standard skills]
- [Anything Claude should know that isn't covered by the skills]

## Skills active on this project

- svelte-ui — UI and design system
- svelte-swe — Frontend architecture
- python-swe — Backend architecture (Pattern B only)

@AGENTS.md
```

The `@AGENTS.md` reference pulls in the design system decisions from the UI skill.
`CLAUDE.md` covers architecture; `AGENTS.md` covers visual identity.
If these do not exist, help the user create them by hand or via the relevant skills.

---

## Cross-cutting Concerns

These span both layers and neither skill covers them fully:

### Auth

- **Pattern A:** Session token in `hooks.server.ts`, `locals.user` set there, guards in loaders
- **Pattern B:** Frontend hooks set `locals.user` from session. Backend validates its own JWT/token
  on every request independently — never trust the frontend to enforce auth on the backend.

### Error handling across the stack

- Backend raises domain errors (`AppError` subclasses), maps to HTTP at the FastAPI edge
- Frontend loader catches HTTP errors, maps to SvelteKit `error()` or `fail()`
- Never let backend error internals leak to the frontend response body in production

### Shared types (Pattern B)

- The OpenAPI spec is the source of truth — not hand-written TS interfaces
- Run `cd frontend && pnpm generate:api` after every backend schema change
- Treat the generated `schema.d.ts` like a lockfile — commit it, don't hand-edit it

### Environment config

- `frontend/.env` and `backend/.env` are always separate, even in Pattern A (future-proofing)
- They should never share secrets
- Validate all env vars at startup — `AppConfig.from_env()` on backend, startup check on frontend
