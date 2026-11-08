# Error Handling

Errors flow upward. Services raise domain errors. The entry point translates them once. The UI
shows what the entry point returned. No layer in between catches to hide a failure.

---

## Layer responsibilities

| Layer               | Throws                             | Catches                                           |
| ------------------- | ---------------------------------- | ------------------------------------------------- |
| Repository          | Domain error for an unreadable row | Nothing it cannot turn into a domain error        |
| Service             | Domain errors (`NotFoundError`, …) | Provider failures → `ExternalServiceError`        |
| Controller          | Lets domain errors pass            | — (except to roll back a transaction and rethrow) |
| Remote function     | SvelteKit `error()` / form issues  | Domain errors, translated once                    |
| `+error.svelte`     | —                                  | SvelteKit HTTP errors                             |
| `<svelte:boundary>` | —                                  | Rendering and remote-query failures in a subtree  |

---

## Domain errors

Define one small hierarchy in models. Each error is a fact the caller can act on.

```typescript
// src/lib/models/errors/domain-error.ts
export abstract class DomainError extends Error {}

export class NotFoundError extends DomainError {
	constructor(readonly resource: string) {
		super(`${resource} not found`);
	}
}

export class ForbiddenError extends DomainError {
	constructor() {
		super('Forbidden');
	}
}

export class ConflictError extends DomainError {}

export class ExternalServiceError extends DomainError {
	constructor(message: string, options: { cause: unknown }) {
		super(message, options);
	}
}
```

Before adding an error type, check that the state is producible. If the design excludes the state
where data enters, do not add an error for it.

---

## Services — raise domain errors

```typescript
async rename(id: RecipeId, title: RecipeTitle): Promise<Recipe> {
	const recipe = await this.repository.findById(id);
	if (!recipe) throw new NotFoundError('Recipe');
	if (recipe.owner !== this.actor) throw new ForbiddenError();
	const renamed = { ...recipe, title };
	await this.repository.save(renamed);
	return renamed;
}
```

A service that calls an external provider wraps its failure:

```typescript
try {
	return await this.provider.embed(text);
} catch (cause) {
	throw new ExternalServiceError('Embedding provider failed', { cause });
}
```

---

## Remote functions — translate once

Put the translation in one shared function, so every remote function maps errors the same way.

```typescript
// src/lib/remote/errors.ts
import { error } from '@sveltejs/kit';
import { ConflictError, ForbiddenError, NotFoundError } from '#lib/models/errors/domain-error';

export function toHttpError(failure: unknown): never {
	if (failure instanceof NotFoundError) error(404, failure.message);
	if (failure instanceof ForbiddenError) error(403, failure.message);
	if (failure instanceof ConflictError) error(409, failure.message);
	throw failure;
}
```

```typescript
export const renameRecipe = command(renameRecipeInput, async (input) => {
	const { locals } = getRequestEvent();
	return locals.app.recipes.rename(input.id, input.title).catch(toHttpError);
});
```

Unknown failures rethrow, so SvelteKit's `handleError` logs them and the user sees a 500. A schema
failure is a 400 from SvelteKit itself; 422-style field issues are for forms the user filled in.

---

## Route error boundaries — `+error.svelte`

Use `+error.svelte` for loader and navigation failures. Show the status and a way back. Keep it
inside the layout so navigation still works.

## Component error boundaries — `<svelte:boundary>`

Wrap a subtree that awaits a remote query in `<svelte:boundary>` with a `pending` and a `failed`
snippet. The `failed` snippet offers `reset` to retry. A failure in one panel must not blank the
whole page.

---

## Summary: which mechanism to use

| Situation                               | Mechanism                                 |
| --------------------------------------- | ----------------------------------------- |
| Rule violated inside a service          | Throw a `DomainError` subclass            |
| Provider call failed                    | `ExternalServiceError` with `cause`       |
| Remote function receives a domain error | `toHttpError` → SvelteKit `error()`       |
| Form input invalid                      | Schema issues returned by `form`          |
| Page cannot load                        | `+error.svelte`                           |
| One panel's query failed                | `<svelte:boundary>` with `failed` + reset |
| Anything else                           | Rethrow. Never swallow.                   |
