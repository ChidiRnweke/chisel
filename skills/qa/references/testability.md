# Code that is hard to test

**What:** Real calculations and rules, without shortcuts enabled only during tests.
**When:** Setup tempts you to add an `isTest` switch, override a private method, or expose private data.
**Type:** Unit for the rule; integration for its database/file/network work.

## A test must execute the actual pricing rule

A ten-percent discount makes a subtotal of 100 cost 90. Test the calculation that production
calls. A test-only branch returning 90 can conceal a broken discount calculation.

### Bad — takes a shortcut that bypasses the calculation

```typescript
import { expect, test } from 'vitest';
import { price } from './shortcut_subject';

test('discounted price', () => {
	expect(price(100, true)).toBe(90);
});
```

If the real calculation charges 80, this test still passes: `isTest` returns a canned 90.

### Solution — call the actual calculation

```typescript
import { expect, test } from 'vitest';
import { price } from './shortcut_subject';

test('discounted price', () => {
	expect(price(100)).toBe(90);
});
```

This test fails when the real price becomes 80. Remove test-only branches from production.
Pass facts such as the current time into a rule instead of changing its behavior for tests.

Keep related rules together and perform I/O outside the calculation when that fits the project.
Do not force a new architecture or fetch unnecessary data for purity.
