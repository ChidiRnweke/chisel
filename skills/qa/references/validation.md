# Reviewing tests

**What:** Whether a test detects the bug it claims to protect against.
**When:** Reviewing tests, investigating coverage gaps, or removing duplicate checks.
**Type:** Review the existing test's unit/integration/component/end-to-end claims.

## The lookup must return Alice's two records

Alice owns “one” and “two”; Bob owns “three”. Alice's lookup must return exactly her two IDs.
Compare those known IDs. Checking only the owner of returned records never checks whether
any required record was returned.

### Bad — checks only that returned records have the right owner

```python
from lookup_subject import Item, owned_items

def test_alice_receives_her_records() -> None:
    items = [Item("one", "alice"), Item("two", "alice"), Item("three", "bob")]
    result = owned_items(items, "alice")
    assert all(item.owner == "alice" for item in result)
```

`all(...)` is true for an empty list. A lookup returning nothing passes despite omitting both
of Alice's records. Returning just one of her records also passes.

### Solution — check the complete expected IDs

```python
from lookup_subject import Item, owned_items

def test_alice_receives_her_records() -> None:
    items = [Item("one", "alice"), Item("two", "alice"), Item("three", "bob")]
    result = owned_items(items, "alice")
    assert sorted(item.id for item in result) == ["one", "two"]
```

This rejects missing, extra, and wrong IDs while allowing order to change. If order is required,
compare the original sequence instead.

For each finding, name the missed bug or harmless rewrite the test rejects, then show a correction.
Check fresh data, fixed time, and independent expected values. Coverage finds unexamined code;
it does not prove assertions work. Report requirements with missing tests separately from missing
implementation. Respect type/schema guarantees. Use project architecture audits and report conflicts.

Use real database integration tests when the filtering is implemented in SQL.
