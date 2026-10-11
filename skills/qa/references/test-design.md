# Test design

**What:** All required results of one action, including unchanged data on rejection.
**When:** A test checks only success, truthiness, or part of the returned result.
**Type:** Apply to every test type. Keep setup, action, and assertions visibly separate.

## A reservation must change the available capacity correctly

Reserving two places from five must return “accepted” and leave three available.
Rejecting a request for two when only one remains must leave that one available.
Check both the decision and remaining capacity after the same reservation.

### Bad — checks the decision but misses the capacity requirement

```typescript
import { expect, test } from 'vitest';
import { Capacity } from './capacity_subject';

test('reservation consumes the requested places', () => {
	const capacity = new Capacity(5);
	expect(capacity.reserve(2)).toBe('accepted');
});

test('rejection leaves available places unchanged', () => {
	const capacity = new Capacity(1);
	expect(capacity.reserve(2)).toBe('insufficient');
});
```

The first test passes if the function returns “accepted” without subtracting any places.
The second passes if it returns “insufficient” after incorrectly reducing availability to zero.
As the sole checks for these scenarios, they do not establish what their names claim.

### Solution — check the decision and its required consequence

```typescript
import { expect, test } from 'vitest';
import { Capacity } from './capacity_subject';

test('reservation consumes the requested places', () => {
	const capacity = new Capacity(5);
	const result = capacity.reserve(2);
	expect(result).toBe('accepted');
	expect(capacity.available).toBe(3);
});

test('rejection leaves available places unchanged', () => {
	const capacity = new Capacity(1);
	const result = capacity.reserve(2);
	expect(result).toBe('insufficient');
	expect(capacity.available).toBe(1);
});
```

The assertions expecting three and one catch those bugs. Several assertions can describe one
action. `available` is a value callers use; do not expose private fields solely for tests.

## A result must contain every required record

Checking that every returned row belongs to Alice passes for an empty result. Compare the
expected records instead; see the complete [review example](validation.md).

Keep important fixture values visible. Factories may default irrelevant valid fields, not hide
missing setup or create impossible data. Give tests fresh objects. Name the fact being checked.
Avoid conditional assertions and unrelated actions in one test. Characterization of legacy
behavior is useful for refactoring; label it instead of calling it a confirmed requirement.
