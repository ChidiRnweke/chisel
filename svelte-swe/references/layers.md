# Layer Guide

Deep dive on each layer's responsibilities, patterns, and anti-patterns.

---

## hooks.server.ts

**Job:** Attach `locals.user` from session token. Nothing else.

```typescript
import type { Handle } from '@sveltejs/kit';
import { AppFactory } from '$lib/factories/AppFactory';

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get('session');

  if (token) {
    const authService = AppFactory.getAuthService();
    event.locals.user = await authService.getUserFromToken(token) ?? undefined;
  }

  return resolve(event);
};
```

**Anti-patterns:**
- ❌ Route guards (`if (url.pathname.startsWith('/admin'))`) — do this in layouts
- ❌ Fetching any data beyond session validation
- ❌ Setting any locals other than `locals.user`

---

## +layout.server.ts

Use for data needed across the entire route tree — navigation state, user preferences, feature flags.

```typescript
export const load: LayoutServerLoad = async ({ locals }) => {
  // Available to all child routes via $page.data or parent()
  return {
    user: locals.user ?? null,
  };
};
```

Child routes call `await parent()` to access layout data without re-fetching:

```typescript
// +page.server.ts
export const load: PageServerLoad = async ({ locals, parent }) => {
  const { user } = await parent();
  if (!user) throw redirect(302, '/login');
  // ...
};
```

---

## +page.server.ts

**Job:** Auth guard, delegate to controller/service, return plain serialisable data.

### Streaming

Return promises directly for slow data — SvelteKit streams them:

```typescript
export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) throw redirect(302, '/login');
  const controller = AppFactory.getRecipeController();

  return {
    user: locals.user,                                    // resolved immediately
    recipes: controller.getRecipesForUser(locals.user.id), // streamed
  };
};
```

In the component:

```svelte
{#await data.recipes}
  <RecipeSkeleton />
{:then recipes}
  <RecipeList {recipes} />
{:catch}
  <ErrorState message="Failed to load recipes" />
{/await}
```

### Form actions

```typescript
export const actions: Actions = {
  // Named action — called via action="?/create"
  create: async ({ request, locals }) => {
    if (!locals.user) throw error(401);

    const formData = await request.formData();

    // Shape validation only — no domain logic
    const title = formData.get('title');
    if (!title || typeof title !== 'string') {
      return fail(400, { title: 'Title is required' });
    }

    try {
      const controller = AppFactory.getRecipeController();
      const recipe = await controller.createRecipe(locals.user.id, { title });
      return { success: true, id: recipe.id };
    } catch (e) {
      if (e instanceof ServiceError) return fail(400, { error: e.message });
      throw error(500);
    }
  }
};
```

---

## Services

**Job:** One concern. Wraps the API client. Returns domain models.

### Interface first

```typescript
// IRecipeService.ts — always define the interface
export interface IRecipeService {
  getByUserId(userId: string): Promise<Recipe[]>;
  getById(id: string): Promise<Recipe>;
  create(input: CreateRecipeInput): Promise<Recipe>;
  delete(id: string): Promise<void>;
}
```

Every service has a corresponding interface. This makes the controller testable — inject a mock `IRecipeService` in tests.

### Implementation

```typescript
// RecipeService.ts
export class RecipeService implements IRecipeService {
  constructor(private readonly client: ApiClient) {}

  async getByUserId(userId: string): Promise<Recipe[]> {
    const { data, error } = await this.client.GET('/users/{userId}/recipes', {
      params: { path: { userId } }
    });
    if (error) throw new ServiceError('Failed to fetch', { cause: error });
    return data.items.map(mapToRecipe);
  }

  // etc.
}

// Private mapper — never exported
function mapToRecipe(raw: components['schemas']['Recipe']): Recipe {
  return {
    id: raw.id,
    title: raw.title,
    createdAt: new Date(raw.created_at),
  };
}
```

**Anti-patterns:**
- ❌ Calling multiple unrelated API endpoints in one service method
- ❌ Exporting raw `components['schemas']` types
- ❌ Catching errors and returning `null` silently — throw domain errors
- ❌ Putting conditional business logic in the service (`if (user.isPremium)`) — that's controller territory

---

## Controllers

**Job:** Orchestrate multiple services. Return a shape ready for the loader.

```typescript
export class RecipeController {
  constructor(
    private readonly recipeService: IRecipeService,   // interface
    private readonly pantryService: IPantryService,   // interface
    private readonly tasteService: ITasteProfileService, // interface
  ) {}

  async getRecipesForUser(userId: string): Promise<Recipe[]> {
    const [recipes, pantry, profile] = await Promise.all([
      this.recipeService.getByUserId(userId),
      this.pantryService.getByUserId(userId),
      this.tasteService.getProfileForUser(userId),
    ]);

    return recipes
      .filter(r => isCompatibleWithPantry(r, pantry))
      .sort((a, b) => scoreByTasteProfile(a, profile) - scoreByTasteProfile(b, profile));
  }
}
```

**Only the controller** should call `Promise.all` across multiple services. If you're doing it in a loader, extract it to a controller.

**Anti-patterns:**
- ❌ Direct API calls or `fetch()` in a controller
- ❌ Importing `createApiClient()` in a controller
- ❌ Single-service controllers with no orchestration — just use the service directly in the loader

---

## Factory

**Job:** Wire concrete types. No logic.

```typescript
// AppFactory.ts
import { createApiClient } from '$lib/api/client';
import { RecipeService } from '$lib/services/RecipeService';
import { PantryService } from '$lib/services/PantryService';
import { TasteProfileService } from '$lib/services/TasteProfileService';
import { RecipeController } from '$lib/controllers/RecipeController';
import { AuthService } from '$lib/services/AuthService';

export class AppFactory {
  static getRecipeController(): RecipeController {
    const client = createApiClient();
    return new RecipeController(
      new RecipeService(client),
      new PantryService(client),
      new TasteProfileService(client),
    );
  }

  static getAuthService(): AuthService {
    return new AuthService(createApiClient());
  }
}
```

One factory file. Static methods. Concrete types only. If a controller doesn't exist yet, call the service directly from the factory and the loader — don't create a controller just to wrap a single service call.

---

## Stores

**Job:** Client-side reactive state. Populated from loader data. Never fetches.

```typescript
// src/lib/stores/recipeStore.ts
import type { Recipe } from '$lib/models';

function createRecipeStore() {
  let items = $state<Recipe[]>([]);
  let activeId = $state<string | null>(null);

  // Derived
  let active = $derived(items.find(r => r.id === activeId) ?? null);

  return {
    // Getters
    get items() { return items; },
    get active() { return active; },

    // Mutations
    setItems(data: Recipe[]) { items = data; },
    setActive(id: string | null) { activeId = id; },
    remove(id: string) { items = items.filter(r => r.id !== id); },

    // Optimistic updates
    add(recipe: Recipe) { items = [...items, recipe]; },
  };
}

export const recipeStore = createRecipeStore();
```

### Populating from loader

```svelte
<script lang="ts">
  import { recipeStore } from '$lib/stores/recipeStore';
  let { data } = $props();

  // Sync server data into store on load
  $effect(() => {
    if (data.recipes) recipeStore.setItems(data.recipes);
  });
</script>
```

### Optimistic updates with actions

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { recipeStore } from '$lib/stores/recipeStore';

  function handleSubmit({ formData, cancel }) {
    const title = String(formData.get('title'));

    // Optimistic add
    const temp = { id: crypto.randomUUID(), title, createdAt: new Date() };
    recipeStore.add(temp);

    return async ({ result, update }) => {
      if (result.type === 'failure') {
        // Roll back
        recipeStore.remove(temp.id);
      }
      await update();
    };
  }
</script>

<form method="POST" action="?/create" use:enhance={handleSubmit}>
  ...
</form>
```

**Anti-patterns:**
- ❌ `fetch()` inside a store
- ❌ Importing services into a store
- ❌ Complex derived logic that belongs in the controller
- ❌ Using `writable()` from old Svelte 4 stores — use `$state` runes

---

## +page.svelte

**Job:** Render. Read `$props`. Write to stores. Use `enhance` for forms. That's it.

```svelte
<script lang="ts">
  import { recipeStore } from '$lib/stores/recipeStore';
  import { enhance } from '$app/forms';
  import RecipeCard from '$lib/components/domain/RecipeCard.svelte';
  import { Button } from '$lib/components/primitives/Button.svelte';

  let { data } = $props();

  // Populate store
  $effect(() => { recipeStore.setItems(data.recipes ?? []); });
</script>

<!-- Stream pending state -->
{#await data.recipes}
  <RecipeSkeleton count={3} />
{:then}
  {#each recipeStore.items as recipe (recipe.id)}
    <RecipeCard {recipe} />
  {/each}
{/await}

<!-- Form stays simple -->
<form method="POST" action="?/create" use:enhance>
  <Input name="title" placeholder="Recipe name" />
  <Button type="submit">Add Recipe</Button>
</form>
```

**Anti-patterns:**
- ❌ `import { RecipeService }` in a page component
- ❌ `onMount(() => fetch('/api/...'))`
- ❌ Complex conditional logic — move to a component or derived store field
- ❌ Prop drilling more than 2 levels — use a store instead
