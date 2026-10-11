---
name: building-python-backend
description: Provides architecture and engineering patterns for production async Python backends. Triggered when scaffolding, building, or reviewing Python backend features, FastAPI routes, SQLAlchemy models, or asyncio patterns. Enforces strict layer separation and domain-driven design.
---

# Python SWE Skill

Opinionated architecture for production async Python backends. Every layer has one job.

## Reference files

Read these when working in the relevant area:

- `references/layers.md` — Full layer guide: services, repositories, controllers, factory, models
- `references/fastapi.md` — FastAPI route patterns, dependency injection, error mapping
- `references/sqlalchemy.md` — ORM models, repository pattern, async session handling
- `references/patterns-examples.md` — Full code examples for all layers

---

## Blueprint

IMPORTANT: ask the user if they want you to start coding or explicitly invoke the `planning-features` skill to write a detailed plan.

## Architecture Overview

```
HTTP Layer (FastAPI)
  ├── routes/              # Thin handlers. Validate input, call factory, return response.
  ├── dependencies.py      # FastAPI Depends: session, config, request-scoped deps
  └── error_handlers.py   # AppError → HTTP response mapping. Only place HTTP status lives.

Domain Layer (no FastAPI imports)
  ├── models/              # Dataclasses. Input/output of every service and controller.
  ├── errors.py            # AppError hierarchy. Domain errors only, no HTTP codes.
  ├── services/            # Protocol interface + implementation. One concern each. Never import each other.
  ├── repositories/        # SQLAlchemy ORM types stay here. Deserialise to domain models immediately.
  ├── controllers/         # Orchestrate services via TaskGroup. No business logic.
  └── factory.py           # Assemble everything. Singletons at startup, request-scoped with session.

Config
  └── config.py            # AppConfig dataclass. Reads from env/secrets at startup. Passed everywhere.
```

---

## Layer Rules (quick reference)

| Layer         | Can do                                       | Cannot do                                       |
| ------------- | -------------------------------------------- | ----------------------------------------------- |
| Route handler | Parse request, call factory, return response | Business logic, direct DB access, service calls |
| Controller    | Orchestrate services with TaskGroup          | Business logic, DB access, HTTP concerns        |
| Service       | One domain concern, implement Protocol       | Import other services, HTTP concerns, ORM types |
| Repository    | SQLAlchemy queries, ORM↔model mapping        | Business logic, calling services                |
| Factory       | Assemble singletons + request-scoped objects | Logic of any kind                               |
| Model         | Pure data, dataclass or Pydantic             | Methods with side effects                       |

---

## Key Conventions

### Dataclasses

`slots=True` always. `frozen=True` for immutable value objects, omit for mutable aggregates:

```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)   # value object — immutable
class UserId:
    value: str

@dataclass(frozen=True, slots=True)   # output model — immutable
class Recipe:
    id: str
    title: str
    cuisine: str

@dataclass(slots=True)                # input — may be built incrementally
class CreateRecipeInput:
    title: str
    cuisine: str | None = None
```

### Protocols for interfaces

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class IRecipeService(Protocol):
    async def get_by_user_id(self, user_id: str) -> list[Recipe]: ...
    async def create(self, input: CreateRecipeInput) -> Recipe: ...
```

No ABC, no inheritance. Implementations just match the signature.

### Logging

Bound logger per module, always:

```python
import structlog

logger: structlog.stdlib.BoundLogger = structlog.getLogger(__name__)

# Bind context for a request/operation
log = logger.bind(user_id=user_id, recipe_id=recipe_id)
await log.ainfo("Creating recipe")
```

### Async — TaskGroup always over gather

```python
import asyncio

async def get_dashboard(user_id: str) -> Dashboard:
    async with asyncio.TaskGroup() as tg:
        recipes_task = tg.create_task(self._recipe_service.get_by_user_id(user_id))
        pantry_task  = tg.create_task(self._pantry_service.get_by_user_id(user_id))

    return Dashboard(recipes=recipes_task.result(), pantry=pantry_task.result())
```

Never use `asyncio.gather`. `TaskGroup` propagates exceptions cleanly and cancels siblings on failure.

---

## Code Examples

For full code examples of the architecture layers in practice, please read:
- **`references/patterns-examples.md`** — Examples for Models, Services, Controllers, Factory, AppConfig, and Error hierarchy.

---

## For detailed patterns, read:

- **Repositories, ORM models, session handling** → `references/sqlalchemy.md`
- **FastAPI routes, dependency injection, error mapping** → `references/fastapi.md`
- **Full layer guide with anti-patterns** → `references/layers.md`

## Validation Checklist

Before concluding any implementation task, copy this checklist into your response scratchpad to track your progress:
- [ ] Run the type-checker (e.g., `pyright .` or `mypy .`) and linter (`ruff check .`).
- [ ] Run tests (`pytest`).
- [ ] If errors occur, autonomously fix them and repeat the loop until the checks pass. Do not ask the human to fix your structural or typing errors.
