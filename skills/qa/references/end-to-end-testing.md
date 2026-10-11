# End-to-end tests

**What:** An important task completed through the application's public UI or API.
**When:** Routing, authentication, startup, or connections between features could break that task.
**Type:** End-to-end. Keep detailed rule variations in unit tests.

## Save a note, then retrieve it through the public API

Saving “Quarterly review” must make that title available when the note is reopened.
Save through the public API, then read through its normal read path. A 201 response alone
cannot establish that the application saved the requested title.

### Bad — claims retrieval works but never retrieves

```typescript
import { expect } from 'vitest';
import { test } from './http_fixture';

test('saved title can be retrieved', async ({ baseUrl }) => {
	const saved = await fetch(`${baseUrl}/notes/note-1`, {
		method: 'POST',
		body: 'Quarterly review'
	});
	await saved.text();
	expect(saved.status).toBe(201);
});
```

This passes if the endpoint returns 201 but stores “old title”, or saves nothing.

### Solution — reopen and check the saved title

```typescript
import { expect } from 'vitest';
import { test } from './http_fixture';

test('saved title can be retrieved', async ({ baseUrl }) => {
	const saved = await fetch(`${baseUrl}/notes/note-1`, {
		method: 'POST',
		body: 'Quarterly review'
	});
	await saved.text();

	const read = await fetch(`${baseUrl}/notes/note-1`);

	expect(saved.status).toBe(201);
	expect(read.status).toBe(200);
	expect(await read.json()).toEqual({ id: 'note-1', title: 'Quarterly review' });
});
```

The read catches incorrect or missing data. For browser journeys, create/save through the UI
and reopen through the application's normal read path.

Keep a small set of distinct important journeys, not every unit-test case repeated through a
browser. CRUD applications can need more integration tests than unit tests; no fixed suite ratio
is required. Several steps can check one journey. Disclose substituted providers and missing
infrastructure.

Use the actual application’s public entry point. `baseUrl` must target that application,
with fresh test data and its normal authentication.
