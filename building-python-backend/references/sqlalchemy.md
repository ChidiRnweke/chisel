# SQLAlchemy — ORM & Repository Pattern

## Table of Contents

- [ORM Models](#orm-models)
- [Repository Pattern](#repository-pattern)
- [Async Session](#async-session)
- [Migrations](#migrations)
- [Testcontainers](#testcontainers)

ORM types are an implementation detail of the repository. Nothing outside the repository ever sees them.

---

## ORM Models

Use `mapped_column` with full type annotations. Keep ORM models in `repositories/orm/`:

```python
# repositories/orm/recipe_orm.py
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class RecipeORM(Base):
    __tablename__ = "recipes"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    cuisine: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
```

**Rules:**
- ORM models live only in `repositories/orm/` — never imported outside the repository layer
- Use `Mapped[T]` for all column types — no untyped `Column()`
- Never pass ORM instances to services or controllers

---

## Repository Pattern

Interface defined via Protocol, implementation owns the ORM:

```python
# repositories/recipe_repository.py
import uuid
from typing import Protocol
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from myapp.models.recipe import Recipe, CreateRecipeInput
from myapp.repositories.orm.recipe_orm import RecipeORM
from myapp.errors import NotFoundError, InfraError
import structlog

logger: structlog.stdlib.BoundLogger = structlog.getLogger(__name__)


class IRecipeRepository(Protocol):
    async def find_by_user_id(self, user_id: str) -> list[Recipe]: ...
    async def find_by_id(self, recipe_id: str) -> Recipe: ...
    async def insert(self, input: CreateRecipeInput, user_id: str) -> Recipe: ...
    async def delete(self, recipe_id: str) -> None: ...


class RecipeRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_user_id(self, user_id: str) -> list[Recipe]:
        try:
            result = await self._session.execute(
                select(RecipeORM).where(RecipeORM.user_id == user_id)
            )
            rows = result.scalars().all()
            return [self._to_domain(row) for row in rows]
        except Exception as e:
            raise InfraError("Failed to fetch recipes") from e

    async def find_by_id(self, recipe_id: str) -> Recipe:
        result = await self._session.execute(
            select(RecipeORM).where(RecipeORM.id == recipe_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            raise NotFoundError("Recipe")
        return self._to_domain(row)

    async def insert(self, input: CreateRecipeInput, user_id: str) -> Recipe:
        row = RecipeORM(
            id=str(uuid.uuid4()),
            user_id=user_id,
            title=input.title,
            cuisine=input.cuisine,
        )
        self._session.add(row)
        await self._session.commit()
        await self._session.refresh(row)
        return self._to_domain(row)

    async def delete(self, recipe_id: str) -> None:
        row = await self._session.get(RecipeORM, recipe_id)
        if row is None:
            raise NotFoundError("Recipe")
        await self._session.delete(row)
        await self._session.commit()

    # Private — ORM type never leaves this class
    def _to_domain(self, row: RecipeORM) -> Recipe:
        return Recipe(
            id=row.id,
            title=row.title,
            cuisine=row.cuisine,
        )
```

**Anti-patterns:**
- ❌ Returning `RecipeORM` from a repository method
- ❌ Accepting `RecipeORM` as a parameter from outside the repository
- ❌ Running queries in services or controllers
- ❌ `session.execute()` anywhere outside a repository

---

## Async Session

Session is created per-request via FastAPI dependency and passed through the factory:

```python
# dependencies.py
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Request

async def get_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    config = request.state.app_config
    async with config.async_session() as session:
        yield session
```

Session flows: `Depends(get_session)` → route handler → `AppFactory.get_X_controller(session, config)` → repository constructor.

**Never** store the session on a singleton or class variable — it is always request-scoped.

---

## Migrations

Use Alembic with async support:

```python
# alembic/env.py
from sqlalchemy.ext.asyncio import create_async_engine
from myapp.repositories.orm import Base  # import all ORM models via __init__

target_metadata = Base.metadata
```

```bash
alembic revision --autogenerate -m "add recipes table"
alembic upgrade head
```

Always review autogenerated migrations before committing — Alembic doesn't always detect renames correctly.

---

## Testcontainers

For integration tests, spin up a real Postgres:

```python
# tests/conftest.py
import pytest
import pytest_asyncio
from testcontainers.postgres import PostgresContainer
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

@pytest.fixture(scope="session")
def postgres():
    with PostgresContainer("postgres:16") as pg:
        yield pg

@pytest_asyncio.fixture
async def session(postgres):
    url = postgres.get_connection_url().replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with session_maker() as s:
        yield s
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
```

Use real Postgres for repository tests. Use Protocol mocks (simple classes matching the interface) for service/controller tests.
