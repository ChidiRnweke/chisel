# Error Handling

## Table of Contents

- [Layer responsibilities](#layer-responsibilities)
- [Domain errors](#domain-errors)
- [Service layer — map HTTP errors to domain errors](#service-layer--map-http-errors-to-domain-errors)
- [Loader/Action layer — translate to SvelteKit errors](#loaderaction-layer--translate-to-sveltekit-errors)
- [Error boundaries — +error.svelte](#error-boundaries--errorsvelte)
- [Svelte error boundaries (client-side)](#svelte-error-boundaries-client-side)
- [Summary: which error mechanism to use](#summary-which-error-mechanism-to-use)

Errors flow upward through layers. Each layer translates errors into the right shape for the layer above.

---

## Layer responsibilities

| Layer | Throws | Catches |
|---|---|---|
| Service | `ServiceError` (domain error) | Raw `openapi-fetch` error responses |
| Controller | Re-throws `ServiceError` or wraps in context | — |
| Loader/Action | SvelteKit `error()` or `fail()` | `ServiceError` from controller |
| `+error.svelte` | — | SvelteKit HTTP errors from loader |

---

## Domain errors

Define a base `ServiceError` in models:

```typescript
// src/lib/models/errors.ts
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly options?: { cause?: unknown; code?: string }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'ServiceError';
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string) {
    super(`${resource} not found`, { code: 'NOT_FOUND' });
    this.name = 'NotFoundError';
  }
}

export class UnauthorisedError extends ServiceError {
  constructor() {
    super('Unauthorised', { code: 'UNAUTHORISED' });
    this.name = 'UnauthorisedError';
  }
}
```

---

## Service layer — map HTTP errors to domain errors

```typescript
async getById(id: string): Promise<Recipe> {
  const { data, error } = await this.client.GET('/recipes/{id}', {
    params: { path: { id } }
  });

  if (error) {
    if (error.status === 404) throw new NotFoundError('Recipe');
    if (error.status === 401) throw new UnauthorisedError();
    throw new ServiceError('Failed to fetch recipe', { cause: error });
  }

  return mapToRecipe(data);
}
```

Never let raw HTTP status codes leak past the service layer.

---

## Loader/Action layer — translate to SvelteKit errors

```typescript
// +page.server.ts
import { error, fail, redirect } from '@sveltejs/kit';
import { NotFoundError, UnauthorisedError, ServiceError } from '$lib/models/errors';

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.user) throw redirect(302, '/login');

  try {
    const controller = AppFactory.getRecipeController();
    const recipe = await controller.getRecipeById(params.id);
    return { recipe };
  } catch (e) {
    if (e instanceof NotFoundError) throw error(404, 'Recipe not found');
    if (e instanceof UnauthorisedError) throw error(403, 'Forbidden');
    throw error(500, 'Something went wrong');
  }
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    if (!locals.user) throw error(401);

    const data = await request.formData();

    try {
      const controller = AppFactory.getRecipeController();
      const recipe = await controller.createRecipe(locals.user.id, {
        title: String(data.get('title')),
      });
      return { success: true, recipe };
    } catch (e) {
      if (e instanceof ServiceError) {
        // Return as form error, not thrown — stays on the same page
        return fail(400, { error: e.message });
      }
      throw error(500, 'Failed to create recipe');
    }
  }
};
```

**Key distinction:**
- `throw error(...)` — redirects to `+error.svelte`, no form state preserved
- `return fail(...)` — stays on page, form data preserved, use for validation/recoverable errors

---

## Error boundaries — +error.svelte

Create per-route error pages for meaningful messages:

```svelte
<!-- src/routes/recipes/+error.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
</script>

{#if $page.status === 404}
  <EmptyState
    title="Recipe not found"
    description="This recipe may have been deleted or doesn't exist."
    action={{ label: 'Back to recipes', href: '/recipes' }}
  />
{:else}
  <ErrorState
    title="Something went wrong"
    description="We couldn't load this recipe. Try again."
  />
{/if}
```

Place `+error.svelte` at the route level that makes sense — a recipes error page doesn't need to be at the root. Use the global `src/routes/+error.svelte` as a last resort fallback only.

---

## Svelte error boundaries (client-side)

For client-side rendering errors within a component tree, use Svelte's `<svelte:boundary>`:

```svelte
<!-- Wrap risky client-side components -->
<svelte:boundary>
  <ComplexVisualization {data} />

  {#snippet failed(error, reset)}
    <div class="error-fallback">
      <p>Failed to render. <button onclick={reset}>Try again</button></p>
    </div>
  {/snippet}
</svelte:boundary>
```

Use `<svelte:boundary>` for:
- Components that process complex data client-side (risk of runtime errors)
- Third-party component wrappers
- Anything using `$derived` with complex transformations

Do **not** use it as a substitute for proper error handling in loaders/actions.

---

## Summary: which error mechanism to use

| Situation | Mechanism |
|---|---|
| User not authenticated | `throw redirect(302, '/login')` in loader |
| Resource not found | `throw error(404, 'message')` in loader |
| Form validation failed | `return fail(400, { field: 'error' })` in action |
| Unexpected server error | `throw error(500, 'message')` in loader/action |
| Client-side render crash | `<svelte:boundary>` in component |
| Route-level error display | `+error.svelte` co-located with route |
