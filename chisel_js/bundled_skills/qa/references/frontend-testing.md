# Frontend tests

**What:** Results of typing/clicking, loading indicators, errors, and usable controls.
**When:** A screen interaction or displayed result changes.
**Type:** Component for individual screens/controls; end-to-end for routing, auth, or saved data.

## Saving must use the edited title and report its progress

While a save is pending, show “Saving…” and disable Save. After acceptance, show “Saved”
and submit the edited title. After failure, show “Could not save” and allow another attempt.
Click the real control and check those results, not just whether an element exists.

### Bad — checks presence after clicking

```typescript
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import TitleEditor from './TitleEditor.svelte';

test('saving the edited title works', async () => {
	const save = async (_title: string): Promise<void> => {};
	render(TitleEditor, { save });
	await page.getByRole('textbox', { name: 'Title' }).fill('Quarterly review');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect.element(page.getByRole('status')).toBeInTheDocument();
});

test('failed save works', async () => {
	const save = async (_title: string): Promise<void> => {
		throw new Error('Offline');
	};
	render(TitleEditor, { save });
	await page.getByRole('textbox', { name: 'Title' }).fill('Quarterly review');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect.element(page.getByRole('button', { name: 'Save' })).toBeInTheDocument();
});
```

The status element still exists if the component submits the wrong title or shows no progress.
The button still exists if a failed save is incorrectly shown as successful or stays disabled.

### Solution — check submitted data, visible status, and button availability

```typescript
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import TitleEditor from './TitleEditor.svelte';

test('saving stays pending until the edited title is accepted', async () => {
	const submitted: string[] = [];
	let finish!: () => void;
	const completion = new Promise<void>((resolve) => {
		finish = resolve;
	});
	const save = async (title: string): Promise<void> => {
		submitted.push(title);
		await completion;
	};
	render(TitleEditor, { save });

	await page.getByRole('textbox', { name: 'Title' }).fill('Quarterly review');
	await page.getByRole('button', { name: 'Save' }).click();

	await expect.element(page.getByRole('status')).toHaveTextContent(/^Saving…$/);
	await expect.element(page.getByRole('button', { name: 'Save' })).toBeDisabled();
	finish();
	await expect.element(page.getByRole('status')).toHaveTextContent(/^Saved$/);
	expect(submitted).toEqual(['Quarterly review']);
});

test('a failed save displays an error and allows another attempt', async () => {
	const save = async (_title: string): Promise<void> => {
		throw new Error('Offline');
	};
	render(TitleEditor, { save });

	await page.getByRole('textbox', { name: 'Title' }).fill('Quarterly review');
	await page.getByRole('button', { name: 'Save' }).click();

	await expect.element(page.getByRole('status')).toHaveTextContent(/^Could not save$/);
	await expect.element(page.getByRole('button', { name: 'Save' })).toBeEnabled();
});
```

The pending promise keeps saving unfinished until the test accepts it. The assertions catch
wrong titles, missing progress, and hidden failures. A fake save does not prove server persistence.

## A Save control must be reachable at a narrow viewport

The `editor` fixture opens the actual page at 320 pixels wide. Its Save button must fit fully inside the viewport and work when
clicked. Check its geometry and the result of clicking. Presence alone cannot detect an offscreen button.

### Bad — checks attachment to the page

```python
from playwright.sync_api import Page, expect
from editor_fixture import editor

def test_save_is_reachable(editor: Page) -> None:
    expect(editor.get_by_role("button", name="Save")).to_be_attached()
```

Moving the button to a fixed position 500 pixels from the left leaves it attached, so this passes.

### Solution — check viewport reachability and click the control

```python
from playwright.sync_api import Page, expect
from editor_fixture import editor

def test_save_is_reachable(editor: Page) -> None:
    save = editor.get_by_role("button", name="Save")
    expect(save).to_be_in_viewport(ratio=1)
    save.click()
    expect(editor.get_by_role("status")).to_have_text("Saved: ")
```

The viewport assertion fails for that misplaced button. Require full viewport visibility only
when the design requires it; scrollable controls have a different expectation.

Use retrying assertions, not sleeps. Keep requests pending to test loading; return explicit empty
results or errors to test those screens. Test layout in a real browser.
