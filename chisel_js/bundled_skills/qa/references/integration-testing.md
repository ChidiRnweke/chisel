# Integration tests

**What:** Workflows that read/write files, use a database, or send messages.
**When:** Separate tests would miss broken contents, wiring, or translation.
**Type:** Integration. Run the real workflow and file/database code. Record outgoing messages.

## Export addresses, then announce success

The export must write both addresses, each followed by a newline, and announce the number
exported. If writing fails, it must send no success message. Check the file's contents and
recorded messages after running the workflow; file existence and an exception are insufficient.

### Bad — checks only file existence and the error

```typescript
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { Recorder, exportAddresses, scenarioDirectory } from './export_subject';

test('export creates a file', async () => {
	const path = join(await scenarioDirectory(), 'addresses.txt');
	await exportAddresses(['a@example.test', 'b@example.test'], path, new Recorder());
	expect((await stat(path)).isFile()).toBe(true);
});

test('failed write rejects', async () => {
	const path = join(await scenarioDirectory(), 'missing', 'addresses.txt');
	await expect(exportAddresses(['a@example.test'], path, new Recorder())).rejects.toMatchObject({
		code: 'ENOENT'
	});
});
```

An empty or incorrectly formatted file still exists. Sending success before attempting a
failed write still produces the expected exception. These assertions miss both bugs.

### Solution — check contents and success/failure messages

```typescript
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { Recorder, exportAddresses, scenarioDirectory } from './export_subject';

test('export writes addresses and announces success', async () => {
	const path = join(await scenarioDirectory(), 'addresses.txt');
	const recorder = new Recorder();

	await exportAddresses(['a@example.test', 'b@example.test'], path, recorder);

	expect(await readFile(path, 'utf8')).toBe('a@example.test\nb@example.test\n');
	expect(recorder.sent).toEqual(['{"kind":"addresses-exported","count":2}']);
});

test('failed write sends no success message', async () => {
	const path = join(await scenarioDirectory(), 'missing', 'addresses.txt');
	const recorder = new Recorder();

	await expect(exportAddresses(['a@example.test'], path, recorder)).rejects.toMatchObject({
		code: 'ENOENT'
	});

	expect(recorder.sent).toEqual([]);
});
```

The exact text catches a missing newline. The empty message list catches premature success.
Test most rule variations with unit tests; add integration failures for consequences those tests
cannot establish. A recorder proves attempted messages, not provider acceptance or delivery.

Use real temporary files and remove only the test’s own directory. Keep serialization and
translation real. Check provider compatibility separately against its real test environment
when needed.
