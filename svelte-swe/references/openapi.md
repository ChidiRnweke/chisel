# OpenAPI Integration

Using `openapi-fetch` and `openapi-typescript` to get fully typed API calls.

---

## Setup

```bash
npm install openapi-fetch
npm install -D openapi-typescript
```

Generate types from your OpenAPI spec (run whenever the spec changes):

```bash
npx openapi-typescript http://localhost:8080/openapi.json -o src/lib/api/schema.d.ts
# or from a local file:
npx openapi-typescript ./openapi.yaml -o src/lib/api/schema.d.ts
```

Add to `package.json` scripts:
```json
{
  "scripts": {
    "generate:api": "openapi-typescript ./openapi.yaml -o src/lib/api/schema.d.ts"
  }
}
```

---

## Client factory

```typescript
// src/lib/api/client.ts
import createClient from 'openapi-fetch';
import type { paths } from './schema.d.ts';
import { env } from '$env/dynamic/private';

export type ApiClient = ReturnType<typeof createClient<paths>>;

export function createApiClient(): ApiClient {
  return createClient<paths>({
    baseUrl: env.API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
```

The `ApiClient` type alias is what you import in services — never instantiate clients outside the factory.

---

## Usage in services

```typescript
import type { ApiClient } from '$lib/api/client';
import type { components } from '$lib/api/schema';

// Raw API type — only used inside this service file
type RawRecipe = components['schemas']['Recipe'];

export class RecipeService implements IRecipeService {
  constructor(private readonly client: ApiClient) {}

  async getByUserId(userId: string): Promise<Recipe[]> {
    const { data, error } = await this.client.GET('/users/{userId}/recipes', {
      params: {
        path: { userId },
        query: { limit: 50 },
      }
    });

    if (error) {
      // Map HTTP error to domain error — see error-handling.md
      throw new ServiceError('Failed to fetch recipes', { cause: error });
    }

    return data.items.map(mapToRecipe);
  }

  async create(input: CreateRecipeInput): Promise<Recipe> {
    const { data, error } = await this.client.POST('/recipes', {
      body: {
        title: input.title,
        cuisine: input.cuisine,
      }
    });

    if (error) throw new ServiceError('Failed to create recipe', { cause: error });
    return mapToRecipe(data);
  }
}

// Mapper — private to this file, never export raw API types
function mapToRecipe(raw: RawRecipe): Recipe {
  return {
    id: raw.id,
    title: raw.title,
    cuisine: raw.cuisine ?? 'unknown',
    servings: raw.servings ?? 1,
    createdAt: new Date(raw.created_at), // rename, transform, normalise here
  };
}
```

---

## Rules

- **Never** import `components['schemas']['X']` outside of a service file
- **Never** use `fetch()` directly — always go through the typed client
- **Always** map raw API types to domain models at the service boundary
- **Always** handle both `data` and `error` from every client call — openapi-fetch returns both, never throws
- Regenerate `schema.d.ts` whenever the backend spec changes — treat it like a lockfile

---

## Auth headers (if needed)

If your API requires a bearer token per-request (not cookie-based), inject it at the client level:

```typescript
export function createApiClient(token?: string): ApiClient {
  return createClient<paths>({
    baseUrl: env.API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
```

Pass the token from `locals` in the factory:

```typescript
// AppFactory.ts
static getRecipeController(token?: string): RecipeController {
  const client = createApiClient(token);
  ...
}

// +page.server.ts
const controller = AppFactory.getRecipeController(locals.user?.token);
```
