---
name: svelte-swe
description: Architecture and engineering patterns for production SvelteKit frontend projects using a BFF (Backend-for-Frontend) pattern. Use this skill whenever the user asks to scaffold, build, or review any SvelteKit feature — including loaders, actions, services, controllers, factories, stores, auth, or API integration. Also trigger when the user asks about openapi-fetch, typed API clients, layer separation, or where to put business logic in a SvelteKit project. This skill enforces strict layer separation: no business logic i  loaders/actions, controllers for multi-service orchestration, services behind interfaces, and a factory that assembles concrete implementations.
---

# SvelteKit SWE Skill

Opinionated architecture for production SvelteKit BFF projects. Every layer has a job — stay in your lane.

## Reference files

Read these when working in the relevant area:

- `references/layers.md` — Full layer-by-layer guide with patterns and anti-patterns
- `references/openapi.md` — openapi-fetch + openapi-typescript setup and typed client patterns
- `references/error-handling.md` — Service errors, loader/action errors, error boundaries

---

## Blueprint

IMPORTANT: ask the user if they want you to start coding or explicitly invoke the `feature-blueprint` skill to write a detailed plan.

## Architecture Overview

```
Browser
  └── +page.svelte          # UI only. No service calls. Reads $props, writes to stores.
        └── stores/          # Client-side singletons. $state fields. Populated from loader data.

SvelteKit Server
  ├── hooks.server.ts        # Auth only — attach locals.user. No business logic.
  ├── +layout.server.ts      # Session-level data available to all routes
  ├── +page.server.ts        # load() and actions. No business logic — delegates to controller/service.
  │     └── AppFactory       # Assembles concrete implementations
  │           └── Controller # Orchestrates multiple services. Has DI (interface-typed deps).
  │                 └── Service(s)   # One concern each. Wraps API client. Returns domain models.
  │                       └── openapi-fetch client  # Typed HTTP calls via generated schema
  │
  └── lib/
        ├── models/          # Shared TS interfaces used across all layers
        ├── services/        # IServiceName interface + ServiceName implementation
        ├── controllers/     # Controller classes with injected service interfaces
        ├── factories/       # AppFactory — concrete assembly, no DI
        └── stores/          # Client-side $state singletons
```

---

## Layer Rules (quick reference)

| Layer             | Can do                                                                             | Cannot do                                   |
| ----------------- | ---------------------------------------------------------------------------------- | ------------------------------------------- |
| `+page.svelte`    | Render, read `$props`, write to stores, call `enhance`                             | Import services, call fetch, business logic |
| `+page.server.ts` | Load data, handle form actions, call controllers/services, `error()`, `redirect()` | Business logic, direct API calls            |
| `hooks.server.ts` | Set `locals.user`, validate session token                                          | Business logic, data fetching               |
| Controller        | Orchestrate multiple services, map to loader-friendly shape                        | Direct API calls, HTTP concerns             |
| Service           | Wrap API client, map responses to models, throw domain errors                      | Orchestration, SvelteKit concerns           |
| Factory           | Instantiate concrete classes, wire dependencies                                    | Logic of any kind                           |
| Store             | Hold reactive client state, expose methods to mutate                               | Server calls, business logic                |

---

## File Naming & Location

```
src/lib/
├── models/
│   ├── User.ts
│   ├── Recipe.ts
│   └── index.ts            # barrel export
├── services/
│   ├── IRecipeService.ts   # interface
│   ├── RecipeService.ts    # implementation
│   └── index.ts
├── controllers/
│   ├── RecipeController.ts
│   └── index.ts
├── factories/
│   └── AppFactory.ts       # one file, static methods
└── stores/
    ├── recipeStore.ts
    └── uiStore.ts

src/routes/
├── hooks.server.ts
├── +layout.server.ts
├── +layout.svelte
└── recipes/
    ├── +page.server.ts
    ├── +page.svelte
    └── +error.svelte
```

---

## Quick Patterns

### hooks.server.ts — auth only

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

### +page.server.ts — load and actions

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

### Service — interface + implementation

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

### Controller — orchestration with DI

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

### Factory — concrete assembly

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

### Store — client-side reactive singleton

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

### Models — shared interfaces

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

---

## For detailed patterns, read:

- **Setting up openapi-fetch + typed client** → `references/openapi.md`
- **Error handling across all layers** → `references/error-handling.md`
- **Full layer guide with more examples** → `references/layers.md`
