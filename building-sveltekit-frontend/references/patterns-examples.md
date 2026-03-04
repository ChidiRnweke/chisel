# SvelteKit Frontend Patterns & Examples

## Table of Contents

- [hooks.server.ts — auth only](#hooksserverts--auth-only)
- [+page.server.ts — load and actions](#pageserverts--load-and-actions)
- [Service — interface + implementation](#service--interface--implementation)
- [Controller — orchestration with DI](#controller--orchestration-with-di)
- [Factory — concrete assembly](#factory--concrete-assembly)
- [Store — client-side reactive singleton](#store--client-side-reactive-singleton)
- [Models — shared interfaces](#models--shared-interfaces)

## hooks.server.ts — auth only

```typescript
// src/hooks.server.ts
import type { Handle } from "@sveltejs/kit";
import { AppFactory } from "$lib/factories/AppFactory";

export const handle: Handle = async ({ event, resolve }) => {
  const sessionToken = event.cookies.get("session");

  if (sessionToken) {
    const authService = AppFactory.getAuthService();
    const user = await authService.getUserFromToken(sessionToken);
    event.locals.user = user ?? undefined;
  }

  return resolve(event);
};
```

**Never:** redirect, fetch business data, or apply route guards here. Guards belong in the loader.

---

## +page.server.ts — load and actions

```typescript
// src/routes/recipes/+page.server.ts
import type { PageServerLoad, Actions } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { AppFactory } from "$lib/factories/AppFactory";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, "/login");

  const controller = AppFactory.getRecipeController();

  return {
    recipes: controller.getRecipesForUser(locals.user.id), // streamable promise
  };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) throw error(401, "Unauthorised");

    const data = await request.formData();
    const controller = AppFactory.getRecipeController();

    // Validate input — use a zod schema or lib/validation.ts
    const result = await controller.createRecipe(locals.user.id, {
      title: String(data.get("title")),
    });

    return { success: true, recipe: result };
  },
};
```

**Never:** put `if (name.length < 3)` or any domain logic here. Validate shape, delegate everything else.

---

## Service — interface + implementation

```typescript
// src/lib/services/IRecipeService.ts
import type { Recipe, CreateRecipeInput } from "$lib/models";

export interface IRecipeService {
  getByUserId(userId: string): Promise<Recipe[]>;
  create(input: CreateRecipeInput): Promise<Recipe>;
}
```

```typescript
// src/lib/services/RecipeService.ts
import type { IRecipeService } from './IRecipeService';
import type { Recipe, CreateRecipeInput } from '$lib/models';
import type { ApiClient } from '$lib/api/client';
import { ServiceError } from '$lib/models/errors';

export class RecipeService implements IRecipeService {
  constructor(private readonly client: ApiClient) {}

  async getByUserId(userId: string): Promise<Recipe[]> {
    const { data, error } = await this.client.GET('/recipes', {
      params: { query: { userId } }
    });

    if (error) throw new ServiceError('Failed to fetch recipes', error);
    return data.recipes.map(mapToRecipe); // always map to domain model
  }

  async create(input: CreateRecipeInput): Promise<Recipe> {
    const { data, error } = await this.client.POST('/recipes', {
      body: input
    });

    if (error) throw new ServiceError('Failed to create recipe', error);
    return mapToRecipe(data);
  }
}

// Keep mappers private to the service file
function mapToRecipe(raw: components['schemas']['Recipe']): Recipe { ... }
```

---

## Controller — orchestration with DI

```typescript
// src/lib/controllers/RecipeController.ts
import type { IRecipeService } from "$lib/services/IRecipeService";
import type { IPantryService } from "$lib/services/IPantryService";
import type { Recipe } from "$lib/models";

export class RecipeController {
  constructor(
    private readonly recipeService: IRecipeService,
    private readonly pantryService: IPantryService,
  ) {}

  async getRecipesForUser(userId: string): Promise<Recipe[]> {
    // Orchestrate: get recipes + filter by what's in the pantry
    const [recipes, pantryItems] = await Promise.all([
      this.recipeService.getByUserId(userId),
      this.pantryService.getByUserId(userId),
    ]);

    return recipes.filter((r) => isCompatible(r, pantryItems));
  }
}
```

Controller takes **interfaces**, not concrete classes. This is the only layer with DI.

---

## Factory — concrete assembly

```typescript
// src/lib/factories/AppFactory.ts
import { createApiClient } from "$lib/api/client";
import { RecipeService } from "$lib/services/RecipeService";
import { PantryService } from "$lib/services/PantryService";
import { RecipeController } from "$lib/controllers/RecipeController";

export class AppFactory {
  static getRecipeController(): RecipeController {
    const client = createApiClient();
    return new RecipeController(
      new RecipeService(client),
      new PantryService(client),
    );
  }

  static getAuthService() {
    return new AuthService(createApiClient());
  }
}
```

No interfaces here — concrete types only. No logic. Just assembly.

---

## Store — client-side reactive singleton

```typescript
// src/lib/stores/recipeStore.ts
import type { Recipe } from "$lib/models";

function createRecipeStore() {
  let recipes = $state<Recipe[]>([]);
  let selected = $state<Recipe | null>(null);

  return {
    get recipes() {
      return recipes;
    },
    get selected() {
      return selected;
    },

    setRecipes(data: Recipe[]) {
      recipes = data;
    },
    select(recipe: Recipe) {
      selected = recipe;
    },
    clear() {
      recipes = [];
      selected = null;
    },
  };
}

export const recipeStore = createRecipeStore();
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
	import { recipeStore } from '$lib/stores/recipeStore';
	let { data } = $props();

	// Populate store from loader data
	$effect(() => {
		recipeStore.setRecipes(data.recipes);
	});
</script>

{#each recipeStore.recipes as recipe}
	<RecipeCard {recipe} />
{/each}
```

Stores are populated from loader data via `$effect`, never fetched directly.

---

## Models — shared interfaces

```typescript
// src/lib/models/Recipe.ts
export interface Recipe {
  id: string;
  title: string;
  cuisine: string;
  servings: number;
  createdAt: Date;
}

export interface CreateRecipeInput {
  title: string;
  cuisine?: string;
  servings?: number;
}
```

Models are plain interfaces — no classes, no methods, no ORM decorators. If an OpenAPI type and a domain model differ, map at the service layer. Never leak `components['schemas']['X']` types past the service.
