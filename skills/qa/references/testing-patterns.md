# Testing Patterns

Layer-by-layer testing examples for chisel-architecture projects. Every example follows the rules: no mocking libraries, one assertion per test, test behaviour not implementation.

---

## Fakes

Fakes are hand-rolled classes that implement the same Protocol/interface as the real dependency. They are simple, explicit, and configurable per-test.

### Python fakes (backend)

```python
# tests/fakes/fake_recipe_repository.py
from dataclasses import dataclass, field
from myapp.models.recipe import Recipe, CreateRecipeInput
from myapp.errors import NotFoundError


@dataclass(slots=True)
class FakeRecipeRepository:
    """Implements IRecipeRepository with in-memory storage."""

    recipes: list[Recipe] = field(default_factory=list)
    _next_id: int = 1

    async def find_by_user_id(self, user_id: str) -> list[Recipe]:
        return [r for r in self.recipes if r.user_id == user_id]

    async def find_by_id(self, recipe_id: str) -> Recipe:
        for r in self.recipes:
            if r.id == recipe_id:
                return r
        raise NotFoundError("Recipe")

    async def insert(self, input: CreateRecipeInput, user_id: str) -> Recipe:
        recipe = Recipe(
            id=str(self._next_id),
            user_id=user_id,
            title=input.title,
            cuisine=input.cuisine,
        )
        self._next_id += 1
        self.recipes.append(recipe)
        return recipe

    async def delete(self, recipe_id: str) -> None:
        original_len = len(self.recipes)
        self.recipes = [r for r in self.recipes if r.id != recipe_id]
        if len(self.recipes) == original_len:
            raise NotFoundError("Recipe")
```

Key properties of a good fake:

- It's a dataclass with `field(default_factory=...)` so each test gets a fresh instance
- It implements the full Protocol — not just the methods one test needs
- It stores state in plain lists/dicts — no framework magic
- It raises the same domain errors the real implementation would (`NotFoundError`, not `KeyError`)
- It's reusable across all tests that need this dependency

### Fakes that need per-test configuration

Sometimes a fake needs to simulate failure or specific state. Use factory functions or constructor params, not monkeypatching:

```python
@dataclass(slots=True)
class FakeRecipeRepository:
    recipes: list[Recipe] = field(default_factory=list)
    should_fail: bool = False          # toggle for error path tests
    fail_error: Exception | None = None

    async def find_by_user_id(self, user_id: str) -> list[Recipe]:
        if self.should_fail:
            raise self.fail_error or InfraError("DB down")
        return [r for r in self.recipes if r.user_id == user_id]
```

```python
# In the test:
repo = FakeRecipeRepository(should_fail=True, fail_error=InfraError("timeout"))
service = RecipeService(repository=repo)
```

This is explicit. You read the test and see exactly what the fake is configured to do. No `mock.side_effect = ...` buried three lines into a test.

### TypeScript fakes (frontend)

```typescript
// src/lib/__tests__/fakes/FakeRecipeService.ts
import type { IRecipeService } from '$lib/services/IRecipeService';
import type { Recipe, CreateRecipeInput } from '$lib/models';

export class FakeRecipeService implements IRecipeService {
	recipes: Recipe[] = [];
	private nextId = 1;

	async getByUserId(userId: string): Promise<Recipe[]> {
		return this.recipes.filter((r) => r.userId === userId);
	}

	async getById(id: string): Promise<Recipe> {
		const recipe = this.recipes.find((r) => r.id === id);
		if (!recipe) throw new NotFoundError('Recipe');
		return recipe;
	}

	async create(input: CreateRecipeInput): Promise<Recipe> {
		const recipe: Recipe = {
			id: String(this.nextId++),
			title: input.title,
			cuisine: input.cuisine ?? 'unknown',
			servings: input.servings ?? 1,
			createdAt: new Date()
		};
		this.recipes.push(recipe);
		return recipe;
	}
}
```

Same principles: implements the full interface, stores state in plain arrays, raises domain errors, configurable per-test by setting `.recipes` before the test runs.

---

## Model tests

Models are pure data. Tests validate constraints, computed properties, and value rules. No fakes needed — you just instantiate the model.

```python
# tests/unit/models/test_recipe.py
import pytest
from myapp.models.recipe import Recipe, CreateRecipeInput


class TestRecipe:
    def test_recipe_stores_all_fields(self):
        recipe = Recipe(id="1", user_id="u1", title="Pasta", cuisine="italian")
        assert recipe.title == "Pasta"

    def test_recipe_is_immutable(self):
        recipe = Recipe(id="1", user_id="u1", title="Pasta", cuisine="italian")
        with pytest.raises(AttributeError):
            recipe.title = "Changed"


class TestCreateRecipeInput:
    def test_cuisine_defaults_to_none(self):
        input = CreateRecipeInput(title="Pasta", user_id="u1")
        assert input.cuisine is None
```

Model tests are simple and fast. They verify the shape of your data, not behaviour. Don't overthink them — but do write them for any model that has constraints or defaults.

---

## Service tests

This is where most of your invariants live. Services contain business logic. Test them by injecting fakes for their dependencies.

```python
# tests/unit/services/test_recipe_service.py
import pytest
from myapp.services.recipe_service import RecipeService
from myapp.models.recipe import CreateRecipeInput, Recipe
from myapp.errors import InputError, UnauthorisedError, NotFoundError
from tests.fakes.fake_recipe_repository import FakeRecipeRepository


@pytest.fixture
def repository() -> FakeRecipeRepository:
    return FakeRecipeRepository()


@pytest.fixture
def service(repository: FakeRecipeRepository) -> RecipeService:
    return RecipeService(repository=repository)


class TestCreateRecipe:
    """Invariant: recipes require a non-empty title."""

    async def test_rejects_empty_title(self, service: RecipeService):
        input = CreateRecipeInput(title="", user_id="u1")
        with pytest.raises(InputError):
            await service.create(input)

    async def test_rejects_whitespace_only_title(self, service: RecipeService):
        input = CreateRecipeInput(title="   ", user_id="u1")
        with pytest.raises(InputError):
            await service.create(input)

    async def test_creates_recipe_with_valid_title(self, service: RecipeService):
        input = CreateRecipeInput(title="Pasta Carbonara", user_id="u1")
        result = await service.create(input)
        assert result.title == "Pasta Carbonara"


class TestDeleteRecipe:
    """Invariant: users can only delete their own recipes."""

    async def test_owner_can_delete(
        self, service: RecipeService, repository: FakeRecipeRepository
    ):
        repository.recipes = [
            Recipe(id="1", user_id="u1", title="Pasta", cuisine=None)
        ]
        await service.delete(recipe_id="1", user_id="u1")
        assert len(repository.recipes) == 0

    async def test_non_owner_cannot_delete(
        self, service: RecipeService, repository: FakeRecipeRepository
    ):
        repository.recipes = [
            Recipe(id="1", user_id="u1", title="Pasta", cuisine=None)
        ]
        with pytest.raises(UnauthorisedError):
            await service.delete(recipe_id="1", user_id="u2")

    async def test_delete_nonexistent_recipe_raises_not_found(
        self, service: RecipeService
    ):
        with pytest.raises(NotFoundError):
            await service.delete(recipe_id="999", user_id="u1")
```

Notice:

- **Test classes are grouped by invariant**, not by method. `TestDeleteRecipe` tests the invariant "users can only delete their own recipes" — it doesn't test every branch of the `delete` method.
- **Each test has one assertion.** `test_non_owner_cannot_delete` doesn't also check that the recipe still exists — that would be a second assertion and a second test.
- **The fixture creates the service with a fake.** No mocking library. You read the fixture and immediately see what's real and what's fake.
- **The test name is the invariant.** If `test_non_owner_cannot_delete` fails, you know exactly what broke without reading the test body.

---

## Controller tests

Controllers orchestrate services. They have minimal logic — mostly delegation and composition. Tests verify that the orchestration produces the right result.

```python
# tests/unit/controllers/test_recipe_controller.py
import pytest
from myapp.controllers.recipe_controller import RecipeController
from myapp.models.recipe import Recipe
from myapp.models.pantry import PantryItem
from tests.fakes.fake_recipe_service import FakeRecipeService
from tests.fakes.fake_pantry_service import FakePantryService


@pytest.fixture
def recipe_service() -> FakeRecipeService:
    return FakeRecipeService()


@pytest.fixture
def pantry_service() -> FakePantryService:
    return FakePantryService()


@pytest.fixture
def controller(
    recipe_service: FakeRecipeService, pantry_service: FakePantryService
) -> RecipeController:
    return RecipeController(
        recipe_service=recipe_service,
        pantry_service=pantry_service,
    )


class TestGetCompatibleRecipes:
    """Invariant: only recipes compatible with pantry contents are returned."""

    async def test_returns_only_recipes_matching_pantry(
        self,
        controller: RecipeController,
        recipe_service: FakeRecipeService,
        pantry_service: FakePantryService,
    ):
        recipe_service.recipes = [
            Recipe(id="1", user_id="u1", title="Pasta", cuisine="italian"),
            Recipe(id="2", user_id="u1", title="Sushi", cuisine="japanese"),
        ]
        pantry_service.items = [
            PantryItem(id="p1", user_id="u1", name="pasta"),
        ]
        # Assume isCompatibleWithPantry matches on ingredient availability
        result = await controller.get_compatible_recipes("u1")
        assert all(r.cuisine == "italian" for r in result)

    async def test_returns_empty_when_pantry_is_empty(
        self,
        controller: RecipeController,
        recipe_service: FakeRecipeService,
        pantry_service: FakePantryService,
    ):
        recipe_service.recipes = [
            Recipe(id="1", user_id="u1", title="Pasta", cuisine="italian"),
        ]
        pantry_service.items = []
        result = await controller.get_compatible_recipes("u1")
        assert result == []
```

Controller tests are thin. If you find yourself writing complex controller tests, the logic probably belongs in a service.

---

## Integration tests (repositories)

Repository tests use a real database via testcontainers. They verify that ORM queries work correctly and that domain model mapping is right.

```python
# tests/integration/repositories/test_recipe_repository.py
import pytest
from myapp.repositories.recipe_repository import RecipeRepository
from myapp.models.recipe import CreateRecipeInput
from myapp.errors import NotFoundError


class TestRecipeRepository:
    async def test_insert_and_retrieve(self, session):
        repo = RecipeRepository(session)
        input = CreateRecipeInput(title="Pasta", user_id="u1")
        created = await repo.insert(input, user_id="u1")
        fetched = await repo.find_by_id(created.id)
        assert fetched.title == "Pasta"

    async def test_find_by_user_id_returns_only_user_recipes(self, session):
        repo = RecipeRepository(session)
        await repo.insert(CreateRecipeInput(title="A", user_id="u1"), user_id="u1")
        await repo.insert(CreateRecipeInput(title="B", user_id="u2"), user_id="u2")
        results = await repo.find_by_user_id("u1")
        assert len(results) == 1

    async def test_find_nonexistent_raises_not_found(self, session):
        repo = RecipeRepository(session)
        with pytest.raises(NotFoundError):
            await repo.find_by_id("nonexistent")
```

The `session` fixture comes from `conftest.py` using testcontainers (see `references/sqlalchemy.md` in the python-swe skill for the fixture setup).

Integration tests are slower. Write them for repositories to verify real SQL. Don't write integration tests for services or controllers — those are tested with fakes at the unit level.

---

## Frontend tests

Same principles. Use vitest. No `vi.mock()`.

```typescript
// src/lib/__tests__/controllers/RecipeController.test.ts
import { describe, it, expect } from 'vitest';
import { RecipeController } from '$lib/controllers/RecipeController';
import { FakeRecipeService } from '../fakes/FakeRecipeService';
import { FakePantryService } from '../fakes/FakePantryService';

describe('RecipeController.getRecipesForUser', () => {
	it('returns empty when pantry has no items', async () => {
		const recipeService = new FakeRecipeService();
		const pantryService = new FakePantryService();
		recipeService.recipes = [
			{ id: '1', title: 'Pasta', cuisine: 'italian', servings: 2, createdAt: new Date() }
		];
		pantryService.items = [];

		const controller = new RecipeController(recipeService, pantryService);
		const result = await controller.getRecipesForUser('u1');

		expect(result).toEqual([]);
	});
});
```

For frontend services that wrap `openapi-fetch`, the fake replaces the service — not the HTTP client. You never mock `fetch`. If `RecipeService` calls `this.client.GET(...)`, your test uses `FakeRecipeService` which doesn't call any client at all. The HTTP layer is tested separately via integration/e2e tests against a running backend.

---

## Anti-patterns to flag during review

| What you see                                                     | Why it's wrong                        | What to do instead                         |
| ---------------------------------------------------------------- | ------------------------------------- | ------------------------------------------ |
| `from unittest.mock import Mock, patch`                          | Mocking library                       | Write a fake implementing the Protocol     |
| `mock.assert_called_once_with(...)`                              | Testing implementation, not behaviour | Assert on the return value or state change |
| `@patch('myapp.services.recipe_service.repository')`             | Patching internals                    | Inject a fake via constructor              |
| `assert result.title == "Pasta" and result.cuisine == "italian"` | Two assertions in one                 | Split into two tests                       |
| `vi.mock('$lib/services/RecipeService')`                         | Mocking library (frontend)            | Write a `FakeRecipeService` class          |
| `jest.spyOn(service, 'getByUserId')`                             | Spying on implementation              | Use a fake, assert on output               |
| `test('create recipe', ...)` with 5 assertions                   | Testing too many things               | One test per behaviour/invariant           |
| Test that constructs a complex mock chain                        | Architecture smell                    | Simplify dependencies or add a controller  |

---

## Naming conventions

Tests are named after the behaviour or invariant they verify:

```
# Good — describes the invariant
test_cannot_create_recipe_with_empty_title
test_non_owner_cannot_delete_recipe
test_returns_only_recipes_matching_pantry
test_raises_not_found_for_nonexistent_recipe

# Bad — describes the method
test_create_recipe
test_delete
test_get_recipes
test_find_by_id
```

Group related tests in classes named after the invariant domain:

```python
class TestRecipeTitleValidation:
    """Invariant: recipes require a non-empty, non-whitespace title."""
    ...

class TestRecipeOwnership:
    """Invariant: users can only modify their own recipes."""
    ...
```

The class docstring references the invariant. This is the link between your invariants file and your test suite.