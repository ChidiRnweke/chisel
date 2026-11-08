# Testing Patterns

Layer-by-layer testing examples for the layered architecture in `AGENTS.md`. Every example follows the rules: no mocking libraries, one assertion per test, test behaviour not implementation.

---

## Fakes

Fakes are hand-rolled classes that implement the same interface as the real dependency. They are simple, explicit, and configurable per test. They live in `src/lib/testing/`.

### An in-memory repository

```typescript
// src/lib/testing/in-memory-recipe-repository.ts
import type { RecipeRepository } from '#lib/server/repositories/recipes/recipe-repository';
import type { Recipe, RecipeId, UserId } from '#lib/models/recipes/recipe';

export class InMemoryRecipeRepository implements RecipeRepository {
	constructor(private readonly recipes: Recipe[] = []) {}

	async findByOwner(owner: UserId): Promise<Recipe[]> {
		return this.recipes.filter((recipe) => recipe.owner === owner);
	}

	async findById(id: RecipeId): Promise<Recipe | undefined> {
		return this.recipes.find((recipe) => recipe.id === id);
	}

	async save(recipe: Recipe): Promise<void> {
		const index = this.recipes.findIndex((existing) => existing.id === recipe.id);
		if (index === -1) this.recipes.push(recipe);
		else this.recipes[index] = recipe;
	}

	snapshot(): readonly Recipe[] {
		return [...this.recipes];
	}
}
```

Why this is better than a mock:

- It implements the full interface, so the type checker catches a drifted fake
- It holds real state, so tests assert on outcomes (`snapshot()`), not calls
- It is reusable across every test that needs this dependency

### Fakes that need per-test configuration

Sometimes a fake needs to simulate failure. Use a separate fake or constructor parameters, not monkeypatching, and fail with the same domain error production raises:

```typescript
// src/lib/testing/unreachable-recipe-repository.ts
export class UnreachableRecipeRepository implements RecipeRepository {
	async findByOwner(): Promise<Recipe[]> {
		throw new ExternalServiceError('database unreachable');
	}
	// ...every other method throws the same way
}
```

The test reads exactly what the fake does. No `mockRejectedValueOnce` buried three lines into a test.

### Function-typed dependencies

For a dependency that is a function, use a typed recording closure:

```typescript
const sent: Notification[] = [];
const notify: Notify = async (notification) => {
	sent.push(notification);
};
```

The test then asserts on `sent` — the observable outcome — never on how often `notify` ran.

---

## Model tests

Models are values and schemas. Tests validate constraints and constructors. No fakes needed.

```typescript
// src/lib/models/recipes/recipe.spec.ts
import { describe, it, expect } from 'vitest';
import { recipeTitle } from './recipe';

describe('recipe title', () => {
	it('rejects an empty title', () => {
		expect(recipeTitle.safeParse('').success).toBe(false);
	});

	it('rejects a whitespace-only title', () => {
		expect(recipeTitle.safeParse('   ').success).toBe(false);
	});

	it('trims surrounding whitespace', () => {
		expect(recipeTitle.parse('  Pasta  ')).toBe('Pasta');
	});
});
```

---

## Service tests

Services hold business rules. Inject fakes for their repositories and providers.

```typescript
// src/lib/server/services/recipes/recipe-service.spec.ts
import { describe, it, expect } from 'vitest';
import { RecipeService } from './recipe-service';
import { InMemoryRecipeRepository } from '#lib/testing/in-memory-recipe-repository';
import { aRecipe } from '#lib/testing/recipes';

describe('deleting a recipe', () => {
	it('refuses when the actor does not own the recipe', async () => {
		const repository = new InMemoryRecipeRepository([aRecipe({ id: 'r1', owner: 'alice' })]);
		const service = new RecipeService({ repository, actor: 'bob' });

		await expect(service.delete('r1')).rejects.toBeInstanceOf(ForbiddenError);
	});

	it('removes the recipe for its owner', async () => {
		const repository = new InMemoryRecipeRepository([aRecipe({ id: 'r1', owner: 'alice' })]);
		const service = new RecipeService({ repository, actor: 'alice' });

		await service.delete('r1');

		expect(repository.snapshot()).toEqual([]);
	});
});
```

The actor is bound when the service is built, not passed to every method.

---

## Controller tests

Controllers sequence services. Inject fake services that implement the service interfaces.

```typescript
// src/lib/server/controllers/recipes/controller.spec.ts
describe('suggesting recipes', () => {
	it('returns nothing when the pantry is empty', async () => {
		const controller = new RecipesController({
			recipes: new InMemoryRecipeCatalog([aRecipe({ ingredients: ['pasta'] })]),
			pantry: new InMemoryPantry([])
		});

		expect(await controller.suggest()).toEqual([]);
	});
});
```

---

## Repository integration tests

Repositories are tested against a real Postgres. Each test starts from a clean schema it owns.

```typescript
// src/lib/server/repositories/recipes/recipe-repository.integration.spec.ts
describe('DrizzleRecipeRepository', () => {
	it('returns only the recipes of the requested owner', async () => {
		const repository = new DrizzleRecipeRepository(testDatabase());
		await repository.save(aRecipe({ id: 'r1', owner: 'alice' }));
		await repository.save(aRecipe({ id: 'r2', owner: 'bob' }));

		const ids = (await repository.findByOwner('alice')).map((recipe) => recipe.id);

		expect(ids).toEqual(['r1']);
	});
});
```

Integration tests are slower. Write them for repositories to verify real SQL and row mapping. Don't write integration tests for services or controllers — those are tested with fakes.

---

## Component tests

Use vitest browser mode (`*.svelte.spec.ts`). Render the component with props, act like a user, assert what the user sees. Components receive props or call remote functions; e2e tests cover the remote side.

```typescript
// src/lib/components/recipes/RecipeCard.svelte.spec.ts
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

it('shows the serving count after increasing it', async () => {
	render(RecipeCard, { recipe: aRecipe({ servings: 2 }) });

	await page.getByRole('button', { name: 'More servings' }).click();

	await expect.element(page.getByText('3 servings')).toBeVisible();
});
```

`toBeInTheDocument()` passes for an element clipped by `overflow-hidden`. When layout is the point, assert the element sits inside the visible container.

---

## Anti-patterns to flag during review

| What you see                                          | Why it's wrong                        | What to do instead                         |
| ----------------------------------------------------- | ------------------------------------- | ------------------------------------------ |
| `vi.mock('#lib/server/services/recipe-service')`      | Mocking library                       | Write an `InMemory*` fake                  |
| `const save = vi.fn()`                                | Mocking library                       | Typed recording closure                    |
| `expect(save).toHaveBeenCalledWith(...)`              | Testing implementation, not behaviour | Assert on the resulting state              |
| `vi.spyOn(service, 'findByOwner')`                    | Spying on implementation              | Use a fake, assert on output               |
| `{ findByOwner: async () => [] } as RecipeRepository` | Partial object cast to a dependency   | Full fake implementing the interface       |
| Two `expect` calls in one `it`                        | Two reasons to fail                   | Split into two tests                       |
| `it('create recipe', ...)` with five assertions       | Testing too many things               | One test per behaviour/invariant           |
| Expected value copied from a constant in the source   | Test mirrors the code                 | Take the value from the requirement        |
| Test that builds a deep chain of doubles              | Architecture smell                    | Simplify dependencies or recut the service |

---

## Naming conventions

Tests are named after the behaviour or invariant they verify:

```
// Good — describes the invariant
it('rejects a recipe with an empty title')
it('refuses deletion by a user who does not own the recipe')
it('returns only recipes matching the pantry')

// Bad — describes the method
it('create recipe')
it('delete')
it('findById')
```

Group related tests in a `describe` named after the invariant domain: `describe('recipe ownership', ...)`.
