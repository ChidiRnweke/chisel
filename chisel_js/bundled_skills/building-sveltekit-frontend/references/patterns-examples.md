# SvelteKit Full-Stack Patterns & Examples

One feature, every layer: renaming a recipe and listing the signed-in user's recipes.

## Table of Contents

- [Model](#model)
- [Repository](#repository)
- [Service](#service)
- [Controller](#controller)
- [Factory and composition root](#factory-and-composition-root)
- [hooks.server.ts](#hooksserverts)
- [Remote functions](#remote-functions)
- [Store](#store)
- [Component](#component)

---

## Model

```typescript
// src/lib/models/recipes/recipe.ts
import { z } from 'zod';

export const recipeId = z.string().uuid().brand<'RecipeId'>();
export type RecipeId = z.infer<typeof recipeId>;

export const recipeTitle = z.string().trim().min(1).max(200);
export type RecipeTitle = z.infer<typeof recipeTitle>;

export type Recipe = {
	readonly id: RecipeId;
	readonly owner: string;
	readonly title: RecipeTitle;
	readonly servings: number;
};

export const renameRecipeInput = z.object({ id: recipeId, title: recipeTitle });
```

## Repository

```typescript
// src/lib/server/repositories/recipes/recipe-repository.ts
import { eq } from 'drizzle-orm';
import type { Database } from '#lib/server/db';
import { recipes } from '#lib/server/db/schema';
import { recipeId, type Recipe, type RecipeId } from '#lib/models/recipes/recipe';

export interface RecipeRepository {
	findByOwner(owner: string): Promise<Recipe[]>;
	findById(id: RecipeId): Promise<Recipe | undefined>;
	save(recipe: Recipe): Promise<void>;
}

export class DrizzleRecipeRepository implements RecipeRepository {
	constructor(private readonly db: Database) {}

	async findByOwner(owner: string): Promise<Recipe[]> {
		const rows = await this.db.select().from(recipes).where(eq(recipes.owner, owner));
		return rows.map(toRecipe);
	}

	async findById(id: RecipeId): Promise<Recipe | undefined> {
		const [row] = await this.db.select().from(recipes).where(eq(recipes.id, id));
		return row ? toRecipe(row) : undefined;
	}

	async save(recipe: Recipe): Promise<void> {
		await this.db
			.insert(recipes)
			.values(recipe)
			.onConflictDoUpdate({ target: recipes.id, set: recipe });
	}
}

function toRecipe(row: typeof recipes.$inferSelect): Recipe {
	return { id: recipeId.parse(row.id), owner: row.owner, title: row.title, servings: row.servings };
}
```

## Service

```typescript
// src/lib/server/services/recipes/recipe-service.ts
import type { RecipeRepository } from '#lib/server/repositories/recipes/recipe-repository';
import { ForbiddenError, NotFoundError } from '#lib/models/errors/domain-error';
import type { Recipe, RecipeId, RecipeTitle } from '#lib/models/recipes/recipe';

export interface RecipeReader {
	listMine(): Promise<Recipe[]>;
}

export interface RecipeWriter {
	rename(id: RecipeId, title: RecipeTitle): Promise<Recipe>;
}

export type RecipeServiceDependencies = {
	readonly repository: RecipeRepository;
	readonly actor: string;
};

export class RecipeService implements RecipeReader, RecipeWriter {
	constructor(private readonly deps: RecipeServiceDependencies) {}

	listMine(): Promise<Recipe[]> {
		return this.deps.repository.findByOwner(this.deps.actor);
	}

	async rename(id: RecipeId, title: RecipeTitle): Promise<Recipe> {
		const recipe = await this.deps.repository.findById(id);
		if (!recipe) throw new NotFoundError('Recipe');
		if (recipe.owner !== this.deps.actor) throw new ForbiddenError();
		const renamed = { ...recipe, title };
		await this.deps.repository.save(renamed);
		return renamed;
	}
}
```

## Controller

```typescript
// src/lib/server/controllers/recipes/controller.ts
import type { RecipeReader, RecipeWriter } from '#lib/server/services/recipes/recipe-service';
import type { Recipe, RecipeId, RecipeTitle } from '#lib/models/recipes/recipe';

export interface RecipesController {
	list(): Promise<Recipe[]>;
	rename(id: RecipeId, title: RecipeTitle): Promise<Recipe>;
}

export class DefaultRecipesController implements RecipesController {
	constructor(private readonly recipes: RecipeReader & RecipeWriter) {}

	list(): Promise<Recipe[]> {
		return this.recipes.listMine();
	}

	rename(id: RecipeId, title: RecipeTitle): Promise<Recipe> {
		return this.recipes.rename(id, title);
	}
}
```

A controller earns its keep when an operation spans several services or needs a transaction. When
it only forwards one call, keep it anyway: it is the stable seam the entry points depend on.

## Factory and composition root

```typescript
// src/lib/server/factories/recipes-factory.ts
export function recipesController(db: Database, actor: string): RecipesController {
	const repository = new DrizzleRecipeRepository(db);
	return new DefaultRecipesController(new RecipeService({ repository, actor }));
}
```

```typescript
// src/lib/server/application.ts
import { db } from '#lib/server/db';

export type Application = { readonly recipes: RecipesController };

export function forActor(actor: string): Application {
	return {
		get recipes() {
			return recipesController(db, actor);
		}
	};
}
```

## hooks.server.ts

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { forActor } from '#lib/server/application';

export const handle: Handle = async ({ event, resolve }) => {
	const user = await resolveSession(event.cookies);
	if (user) event.locals.app = forActor(user.id);
	return resolve(event);
};
```

## Remote functions

```typescript
// src/lib/remote/recipes/recipes.remote.ts
import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { renameRecipeInput } from '#lib/models/recipes/recipe';
import { toHttpError } from '#lib/remote/errors';

function app() {
	const { locals } = getRequestEvent();
	if (!locals.app) error(401, 'Sign in required');
	return locals.app;
}

export const myRecipes = query(async () => app().recipes.list());

export const renameRecipe = command(renameRecipeInput, async ({ id, title }) => {
	const renamed = await app().recipes.rename(id, title).catch(toHttpError);
	myRecipes().refresh();
	return renamed;
});
```

## Store

```typescript
// src/lib/stores/recipes/filter.svelte.ts
class RecipeFilter {
	text = $state('');

	clear() {
		this.text = '';
	}
}

export const recipeFilter = new RecipeFilter();
```

The store holds what the user typed. It never fetches recipes.

## Component

```svelte
<!-- src/lib/components/recipes/RecipeList.svelte -->
<script lang="ts">
	import { myRecipes } from '#lib/remote/recipes/recipes.remote';
	import { recipeFilter } from '#lib/stores/recipes/filter.svelte';
	import { Input } from '#lib/components/ui/input';
	import RecipeCard from './RecipeCard.svelte';

	const recipes = $derived(
		(await myRecipes()).filter((recipe) =>
			recipe.title.toLowerCase().includes(recipeFilter.text.toLowerCase())
		)
	);
</script>

<Input bind:value={recipeFilter.text} placeholder="Filter recipes" />
{#each recipes as recipe (recipe.id)}
	<RecipeCard {recipe} />
{/each}
```

Wrap the component in `<svelte:boundary>` with `pending` and `failed` snippets where it is used.
