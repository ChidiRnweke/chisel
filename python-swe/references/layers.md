# Layer Guide

Deep dive on each layer's responsibilities, patterns, and anti-patterns.

---

## Models (`models/`)

Pure data. No methods with side effects. No imports from other layers.

```python
from dataclasses import dataclass

# Value object — frozen always
@dataclass(frozen=True, slots=True)
class UserId:
    value: str

# Domain model — frozen, returned from services
@dataclass(frozen=True, slots=True)
class Recipe:
    id: str
    user_id: str
    title: str
    cuisine: str | None

# Input model — may not be frozen if built incrementally
@dataclass(slots=True)
class CreateRecipeInput:
    title: str
    user_id: str
    cuisine: str | None = None
```

**Pydantic** is used only for HTTP input validation — never as an internal model. Once validated at the route boundary, convert to a dataclass:

```python
# In the route handler, after Pydantic validation:
domain_input = CreateRecipeInput(title=body.title, user_id=user_id)
```

**Anti-patterns:**
- ❌ `from myapp.services import X` inside a model file
- ❌ Methods that do computation or I/O on a model
- ❌ ORM columns or SQLAlchemy types on domain models

---

## Services (`services/`)

One concern per service. Never import another service. Contain all business logic.

### Protocol definition

```python
# services/recipe_service.py
from typing import Protocol
from myapp.models.recipe import Recipe, CreateRecipeInput
from myapp.repositories.recipe_repository import IRecipeRepository

class IRecipeService(Protocol):
    async def get_by_user_id(self, user_id: str) -> list[Recipe]: ...
    async def create(self, input: CreateRecipeInput) -> Recipe: ...
    async def delete(self, recipe_id: str, user_id: str) -> None: ...
```

### Implementation

```python
import structlog
from dataclasses import dataclass

logger: structlog.stdlib.BoundLogger = structlog.getLogger(__name__)

@dataclass(slots=True)
class RecipeService:
    repository: IRecipeRepository  # Protocol-typed, not concrete

    async def get_by_user_id(self, user_id: str) -> list[Recipe]:
        log = logger.bind(user_id=user_id)
        await log.ainfo("Fetching recipes for user")
        return await self.repository.find_by_user_id(user_id)

    async def create(self, input: CreateRecipeInput) -> Recipe:
        if not input.title.strip():
            raise InputError("Title cannot be empty")
        log = logger.bind(user_id=input.user_id, title=input.title)
        await log.ainfo("Creating recipe")
        return await self.repository.insert(input)

    async def delete(self, recipe_id: str, user_id: str) -> None:
        recipe = await self.repository.find_by_id(recipe_id)
        if recipe.user_id != user_id:
            raise UnauthorisedError()
        await self.repository.delete(recipe_id)
```

Logger is always module-level — never an instance field on the dataclass.

**Anti-patterns:**
- ❌ `from myapp.services.pantry_service import PantryService` inside a service
- ❌ `AsyncSession` or SQLAlchemy imports inside a service
- ❌ HTTP concerns (`status_code`, `HTTPException`) inside a service
- ❌ Delegating business logic to the controller or repository

---

## Repositories (`repositories/`)

Own the ORM. Deserialise to domain models immediately. No business logic.

See `references/sqlalchemy.md` for full patterns.

**Key rules:**
- Repository interface defined as a Protocol alongside the implementation
- ORM types (`RecipeORM`) are private — `_to_domain()` is always called before returning
- Wrap infrastructure failures in `InfraError`
- Raise `NotFoundError` when an expected record is absent

---

## Controllers (`controllers/`)

Orchestrate multiple services. Return domain models. No business logic.

```python
# controllers/recipe_controller.py
import asyncio
import structlog
from dataclasses import dataclass
from myapp.services.recipe_service import IRecipeService
from myapp.services.pantry_service import IPantryService
from myapp.models.recipe import Recipe, CreateRecipeInput
from myapp.models.dashboard import Dashboard

logger: structlog.stdlib.BoundLogger = structlog.getLogger(__name__)

@dataclass(slots=True)
class RecipeController:
    recipe_service: IRecipeService
    pantry_service: IPantryService

    async def get_dashboard(self, user_id: str) -> Dashboard:
        async with asyncio.TaskGroup() as tg:
            recipes_task = tg.create_task(self.recipe_service.get_by_user_id(user_id))
            pantry_task  = tg.create_task(self.pantry_service.get_by_user_id(user_id))

        return Dashboard(
            recipes=recipes_task.result(),
            pantry=pantry_task.result(),
        )

    async def create_recipe(self, input: CreateRecipeInput) -> Recipe:
        return await self.recipe_service.create(input)
```

**When to use a controller vs calling a service directly:**
- Single service call from a route → call the service via factory directly (no controller needed)
- Multiple services needed → always introduce a controller
- Sequential dependency between services → controller

**Anti-patterns:**
- ❌ `if recipe.cuisine == "italian":` — that's business logic, move to service
- ❌ Direct DB access or repository imports
- ❌ `asyncio.gather()` — always `TaskGroup`

---

## Factory (`factory.py`)

Dataclass, instantiated per-request with session and user context. No static methods, no logic.

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
    user_id: str

    def get_recipe_controller(self) -> RecipeController:
        return RecipeController(
            recipe_service=RecipeService(RecipeRepository(self.session)),
            pantry_service=PantryService(PantryRepository(self.session)),
        )

    def get_recipe_service(self) -> RecipeService:
        return RecipeService(RecipeRepository(self.session))
```

The factory carries `user_id` so every method has user context without it being threaded through every call. Instantiated once per request via FastAPI dependency — never as a singleton.

**Anti-patterns:**
- ❌ `@staticmethod` on any factory method
- ❌ Assembling services inside route handlers
- ❌ Any conditional logic in the factory

---

## Config (`config.py`)

Read everything at startup. Fail fast with a clear message if anything is missing.

```python
from dataclasses import dataclass
import os
import structlog
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

logger: structlog.stdlib.BoundLogger = structlog.getLogger(__name__)

class AppStartupError(Exception):
    pass

def get_env_or_raise(key: str) -> str:
    value = os.getenv(key)
    if value is None:
        raise AppStartupError(f"Environment variable {key} is not set")
    return value

@dataclass
class AppConfig:
    db_url: str
    async_session: async_sessionmaker[AsyncSession]
    openai_client: AsyncOpenAI
    chat_model: str
    embedding_model: str
    max_spend: float

    @classmethod
    def from_env(cls) -> "AppConfig":
        try:
            db_url = get_env_or_raise("DATABASE_URL")
            openai_api_key = get_env_or_raise("OPENAI_API_KEY")
            chat_model = get_env_or_raise("CHAT_MODEL")
            embedding_model = get_env_or_raise("EMBEDDING_MODEL")
            max_spend = float(get_env_or_raise("MAX_SPEND"))

            engine = create_async_engine(db_url)
            session_maker = async_sessionmaker(engine, expire_on_commit=False)

            return cls(
                db_url=db_url,
                async_session=session_maker,
                openai_client=AsyncOpenAI(api_key=openai_api_key),
                chat_model=chat_model,
                embedding_model=embedding_model,
                max_spend=max_spend,
            )
        except AppStartupError:
            raise
        except Exception as e:
            raise AppStartupError(f"Failed to configure app: {e}") from e
```

---

## Project Structure

```
src/myapp/
├── config.py
├── factory.py
├── errors.py
├── models/
│   ├── recipe.py
│   ├── pantry.py
│   └── __init__.py
├── services/
│   ├── recipe_service.py     # IRecipeService Protocol + RecipeService class
│   ├── pantry_service.py
│   └── __init__.py
├── repositories/
│   ├── recipe_repository.py  # IRecipeRepository Protocol + RecipeRepository class
│   ├── pantry_repository.py
│   └── orm/
│       ├── base.py           # DeclarativeBase
│       ├── recipe_orm.py
│       └── __init__.py       # imports all ORM models for Alembic
├── controllers/
│   ├── recipe_controller.py
│   └── __init__.py
└── routes/
    ├── recipes.py
    ├── health.py
    └── __init__.py
```
