# FastAPI — Routes, Dependencies & Error Mapping

## Table of Contents

- [Application Setup](#application-setup)
- [Dependencies](#dependencies)
- [Route Handlers](#route-handlers)
- [Input Validation](#input-validation)
- [Error Handlers](#error-handlers)
- [Streaming Responses](#streaming-responses)
- [Running Without HTTP (scheduled scripts)](#running-without-http-scheduled-scripts)

The HTTP layer is a thin shell. It speaks HTTP so the domain doesn't have to.

---

## Application Setup

```python
# app.py
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator, TypedDict
import structlog
from fastapi import FastAPI
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from myapp.config import AppConfig
from myapp.routes import recipes, health
from myapp.error_handlers import register_error_handlers

logger: structlog.stdlib.BoundLogger = structlog.getLogger(__name__)

class AppState(TypedDict):
    app_config: AppConfig

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[AppState]:
    config = AppConfig.from_env()
    logger.info("App configured")
    yield {"app_config": config}

def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan, root_path="/api/v1")
    app.include_router(recipes.router)
    app.include_router(health.router)
    register_error_handlers(app)

    if os.getenv("TELEMETRY_ENDPOINT"):
        FastAPIInstrumentor.instrument_app(app)
    else:
        logger.warning("Running without telemetry")

    return app

app = create_app()
```

---

## Dependencies

```python
# dependencies.py
from typing import AsyncGenerator, cast
from fastapi import Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from myapp.config import AppConfig
from myapp.factory import AppFactory
from myapp.models.user import User

async def get_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    config = cast(AppConfig, request.state.app_config)
    async with config.async_session() as session:
        yield session

def get_config(request: Request) -> AppConfig:
    return cast(AppConfig, request.state.app_config)

def get_current_user(request: Request) -> User:
    # Validate session token, return User — implementation depends on auth strategy
    ...

def get_factory(
    session: AsyncSession = Depends(get_session),
    config: AppConfig = Depends(get_config),
    user: User = Depends(get_current_user),
) -> AppFactory:
    return AppFactory(session=session, config=config, user_id=user.id)
```

---

## Route Handlers

Thin. Parse input, call factory, return output. Nothing else.

```python
# routes/recipes.py
from fastapi import APIRouter, Depends
from myapp.dependencies import get_factory
from myapp.factory import AppFactory
from myapp.models.recipe import Recipe, CreateRecipeInput

router = APIRouter(prefix="/recipes", tags=["recipes"])

@router.get("/")
async def get_recipes(factory: AppFactory = Depends(get_factory)) -> list[Recipe]:
    controller = factory.get_recipe_controller()
    return await controller.get_dashboard(factory.user_id)

@router.post("/", status_code=201)
async def create_recipe(
    input: CreateRecipeInput,          # Pydantic validation of untrusted HTTP input
    factory: AppFactory = Depends(get_factory),
) -> Recipe:
    controller = factory.get_recipe_controller()
    return await controller.create_recipe(input)
```

**Anti-patterns:**
- ❌ Assembling services or repositories inside the route handler
- ❌ Business logic inside the route handler
- ❌ `try/except` inside route handlers — let error handlers deal with it
- ❌ Importing domain services directly into routes

---

## Input Validation

Use Pydantic only at the HTTP boundary — for validating untrusted incoming data:

```python
# models/recipe.py — Pydantic only at the HTTP edge
from pydantic import BaseModel, field_validator

class CreateRecipeInput(BaseModel):
    title: str
    cuisine: str | None = None

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Title cannot be empty")
        return v.strip()
```

Internal models passed between services are plain dataclasses. Only the input to a route handler uses Pydantic.

---

## Error Handlers

All HTTP status code decisions live here — nowhere else in the codebase:

```python
# error_handlers.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import structlog

from myapp.errors import AppError, InputError, NotFoundError, InfraError, UnauthorisedError

logger: structlog.stdlib.BoundLogger = structlog.getLogger(__name__)

def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, handle_app_error)       # type: ignore
    app.add_exception_handler(Exception, handle_unexpected_error) # type: ignore

async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    match exc:
        case InputError(message=message):
            return JSONResponse({"detail": message}, status_code=400)
        case NotFoundError():
            return JSONResponse({"detail": str(exc)}, status_code=404)
        case UnauthorisedError():
            return JSONResponse({"detail": "Unauthorised"}, status_code=401)
        case InfraError():
            await logger.aerror("Infrastructure error", error=str(exc))
            return JSONResponse({"detail": "Internal server error"}, status_code=500)
        case _:
            await logger.aerror("Unhandled app error", error=str(exc))
            return JSONResponse({"detail": "Internal server error"}, status_code=500)

async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    await logger.aerror("Unexpected error", error=str(exc))
    return JSONResponse({"detail": "Internal server error"}, status_code=500)
```

`match/case` is used here because `AppError` is a discriminated union. Use `if/elif` everywhere else.

---

## Streaming Responses

For SSE or streamed generation:

```python
from fastapi.responses import StreamingResponse

@router.post("/chat")
async def chat(
    question: QuestionInput,
    session: AsyncSession = Depends(get_session),
    config: AppConfig = Depends(get_config),
) -> StreamingResponse:
    controller = AppFactory.get_chat_controller(session, config)

    async def generate():
        async for chunk in controller.stream_answer(question):
            yield chunk

    return StreamingResponse(generate(), media_type="text/event-stream")
```

The controller owns the streaming logic — the route only wraps it in a `StreamingResponse`.

---

## Running Without HTTP (scheduled scripts)

Because the domain layer has zero FastAPI imports, the factory can be used directly:

```python
# scripts/nightly_cleanup.py
import asyncio
from myapp.config import AppConfig
from myapp.factory import AppFactory

async def main():
    config = AppConfig.from_env()
    async with config.async_session() as session:
        factory = AppFactory(session=session, config=config, user_id="system")
        controller = factory.get_cleanup_controller()
        await controller.run_cleanup()

if __name__ == "__main__":
    asyncio.run(main())
```

`user_id="system"` or a dedicated service account ID — the factory always needs user context, even for background jobs. This is why HTTP status codes and FastAPI types must never leak into the domain.
