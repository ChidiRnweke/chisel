---
name: python-swe
description: Architecture and engineering patterns for production Python backend projects. Use this skill whenever the user asks to scaffold, build, or review any Python backend feature — including services, controllers, repositories, factories, models, FastAPI routes, or config. Also trigger when the user asks about SQLAlchemy, asyncio patterns, Protocol interfaces, structlog, AppConfig, error hierarchies, or where to put business logic. Enforces strict layer separation; domain never touches HTTP, repositories own ORM types, services never import each other, controllers orchestrate via TaskGroup, factory assembles everything.
---

# Python SWE Skill

Opinionated architecture for production async Python backends. Every layer has one job.

## Reference files

Read these when working in the relevant area:

- `references/layers.md` — Full layer guide: services, repositories, controllers, factory, models
- `references/fastapi.md` — FastAPI route patterns, dependency injection, error mapping
- `references/sqlalchemy.md` — ORM models, repository pattern, async session handling

---

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

## Quick Patterns

### Model

```python
# models/recipe.py
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class Recipe:
    id: str
    title: str
    cuisine: str

@dataclass(frozen=True, slots=True)
class CreateRecipeInput:
    title: str
    cuisine: str | None = None
```

### Service — Protocol + dataclass implementation

```python
# services/recipe_service.py
import structlog
from dataclasses import dataclass
from typing import Protocol
from myapp.models.recipe import Recipe, CreateRecipeInput
from myapp.repositories.recipe_repository import IRecipeRepository

logger: structlog.stdlib.BoundLogger = structlog.getLogger(__name__)

class IRecipeService(Protocol):
    async def get_by_user_id(self, user_id: str) -> list[Recipe]: ...
    async def create(self, input: CreateRecipeInput) -> Recipe: ...


@dataclass(slots=True)
class RecipeService:
    repository: IRecipeRepository

    async def get_by_user_id(self, user_id: str) -> list[Recipe]:
        log = logger.bind(user_id=user_id)
        await log.ainfo("Fetching recipes")
        return await self.repository.find_by_user_id(user_id)

    async def create(self, input: CreateRecipeInput) -> Recipe:
        if not input.title.strip():
            raise InputError("Title cannot be empty")
        return await self.repository.insert(input)
```

Note: logger is a module-level constant, not an instance field. Dataclass fields are dependencies only.

### Controller — orchestration only, also a dataclass

```python
# controllers/recipe_controller.py
import asyncio
from dataclasses import dataclass
from myapp.services.recipe_service import IRecipeService
from myapp.services.pantry_service import IPantryService

@dataclass(slots=True)
class RecipeController:
    recipe_service: IRecipeService
    pantry_service: IPantryService

    async def get_compatible_recipes(self, user_id: str) -> list[Recipe]:
        async with asyncio.TaskGroup() as tg:
            recipes_task = tg.create_task(self.recipe_service.get_by_user_id(user_id))
            pantry_task  = tg.create_task(self.pantry_service.get_by_user_id(user_id))

        return filter_by_pantry(recipes_task.result(), pantry_task.result())
```

Controller fields are Protocol-typed. No business logic — `if` statements over domain data belong in a service.

### Factory — dataclass, instantiated per-request with user context

```python
# factory.py
from dataclasses import dataclass
from sqlalchemy.ext.asyncio import AsyncSession
from myapp.config import AppConfig
from myapp.repositories.recipe_repository import RecipeRepository
from myapp.repositories.pantry_repository import PantryRepository
from myapp.services.recipe_service import RecipeService
from myapp.services.pantry_service import PantryService
from myapp.controllers.recipe_controller import RecipeController

@dataclass(slots=True)
class AppFactory:
    session: AsyncSession
    config: AppConfig
    user_id: str   # user context available to all factory methods

    def get_recipe_controller(self) -> RecipeController:
        return RecipeController(
            recipe_service=RecipeService(RecipeRepository(self.session)),
            pantry_service=PantryService(PantryRepository(self.session)),
        )
```

Factory is instantiated once per request in the FastAPI dependency, carrying the session and user context. Never use static methods — the factory _is_ the request context.

```python
# dependencies.py
async def get_factory(
    session: AsyncSession = Depends(get_session),
    config: AppConfig = Depends(get_config),
    user: User = Depends(get_current_user),
) -> AppFactory:
    return AppFactory(session=session, config=config, user_id=user.id)
```

```python
# routes/recipes.py
@router.get("/")
async def get_recipes(factory: AppFactory = Depends(get_factory)) -> list[Recipe]:
    controller = factory.get_recipe_controller()
    return await controller.get_compatible_recipes(factory.user_id)
```

### AppConfig

```python
# config.py
from dataclasses import dataclass
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession, create_async_engine

@dataclass
class AppConfig:
    db_url: str
    openai_api_key: str
    async_session: async_sessionmaker[AsyncSession]
    # ... other config

    @classmethod
    def from_env(cls) -> "AppConfig":
        db_url = get_env_or_raise("DATABASE_URL")
        openai_api_key = get_env_or_raise("OPENAI_API_KEY")
        engine = create_async_engine(db_url)
        session_maker = async_sessionmaker(engine, expire_on_commit=False)
        return cls(
            db_url=db_url,
            openai_api_key=openai_api_key,
            async_session=session_maker,
        )
```

### Error hierarchy

```python
# errors.py
class AppError(Exception):
    """Base for all domain errors. Never use directly."""

class InputError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message

class NotFoundError(AppError):
    def __init__(self, resource: str) -> None:
        super().__init__(f"{resource} not found")

class InfraError(AppError):
    """Wraps infrastructure failures (DB down, external API timeout, etc.)"""

class UnauthorisedError(AppError):
    pass
```

HTTP status codes **never** appear in domain errors. They are mapped at the edge in `error_handlers.py` only.

---

## For detailed patterns, read:

- **Repositories, ORM models, session handling** → `references/sqlalchemy.md`
- **FastAPI routes, dependency injection, error mapping** → `references/fastapi.md`
- **Full layer guide with anti-patterns** → `references/layers.md`
