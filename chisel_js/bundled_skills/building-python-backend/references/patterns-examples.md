# Python Backend Patterns & Examples

## Table of Contents

- [Model](#model)
- [Service — Protocol + dataclass implementation](#service--protocol--dataclass-implementation)
- [Controller — orchestration only, also a dataclass](#controller--orchestration-only-also-a-dataclass)
- [Factory — dataclass, instantiated per-request with user context](#factory--dataclass-instantiated-per-request-with-user-context)
- [AppConfig](#appconfig)
- [Error hierarchy](#error-hierarchy)

## Model

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

## Service — Protocol + dataclass implementation

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

## Controller — orchestration only, also a dataclass

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

## Factory — dataclass, instantiated per-request with user context

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

## AppConfig

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

## Error hierarchy

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
