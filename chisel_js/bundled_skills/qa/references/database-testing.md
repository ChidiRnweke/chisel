# Database tests

**What:** Writes, rollback, migrations, and queries with filters, joins, or required ordering.
**When:** A defect could lose, corrupt, expose, or omit stored records.
**Type:** Integration against the production database engine. A fake cannot prove SQL or rollback.

## A transfer commits both changes, or neither

A starts with 30 and B with 5. Transferring 10 must commit balances of 20 and 15.
If the recipient is missing, A must still have 30. Read the balances through a new connection
after the operation; a successful return or an exception says nothing about committed data.

### Bad — checks completion without checking stored balances

```python
from db_fixture import database, transfer
import pytest

def test_transfer(database: tuple[str, str]) -> None:
    dsn, table = database
    assert transfer(dsn, table, "A", "B", 10) is None

def test_failure(database: tuple[str, str]) -> None:
    dsn, table = database
    with pytest.raises(ValueError, match="^recipient missing$"):
        transfer(dsn, table, "A", "missing", 10)
```

The first test passes if no money moves. The second passes if A loses 10 before the missing
recipient causes an exception. Neither test reads the result that matters.

### Solution — read committed balances after success and failure

```python
from db_fixture import database, transfer, committed_balances
import pytest

def test_transfer_commits_both_balances(database: tuple[str, str]) -> None:
    dsn, table = database
    transfer(dsn, table, "A", "B", 10)
    assert committed_balances(dsn, table) == [("A", 20), ("B", 15)]

def test_failure_rolls_back_the_debit(database: tuple[str, str]) -> None:
    dsn, table = database
    with pytest.raises(ValueError, match="^recipient missing$"):
        transfer(dsn, table, "A", "missing", 10)
    assert committed_balances(dsn, table) == [("A", 30), ("B", 5)]
```

The success assertion catches missing writes. The failure assertion catches a debit left committed.
For queries, seed matching and nonmatching rows and compare the complete expected records;
see [missing-result examples](validation.md).

These examples cover atomicity, not overdraft or concurrency rules. Preserve required reference
data during cleanup. Protect complex reads with focused tests; avoid duplicating simple repository
checks already exercised by a workflow. Test ORM reconstruction through its actual database contract.

Use the production database engine and migrations. Isolate each test’s data and clean up only
its own records. Keep setup, operation, and assertion connections separate. A test-wide rollback
transaction can hide missing commits. Serialize tests sharing data.
