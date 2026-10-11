# Unit tests

Use unit tests for rules you can check by calling your code directly: prices, permissions,
and eligibility. Keep real helper code. Test the different answers a rule can produce,
including values just below, at, and above a cutoff.

## Example: delivery is free for orders of €50 or more

Delivery costs €5 for an order below €50. At €50 and above, it costs €0.
Amounts are euros; `Decimal` avoids floating-point rounding.
Check the exact fee for €49.99, €50.00, and €50.01. No database, browser, or server is needed
to check this calculation.

### Bad: checks that the price is valid, but not that it is correct

```python
from decimal import Decimal
from delivery import delivery_fee

def test_delivery_fee() -> None:
    fee = delivery_fee(order_total=Decimal("50.00"))
    assert fee >= Decimal("0.00")
```

This passes if the customer is incorrectly charged €5: €5 is also non-negative.
As the only test for free delivery, it misses the requirement.

### Fix: check the price the customer should pay

```python
from decimal import Decimal
from delivery import delivery_fee

def test_order_below_fifty_euros_pays_five_euros_delivery() -> None:
    fee = delivery_fee(order_total=Decimal("49.99"))
    assert fee == Decimal("5.00")

def test_order_of_exactly_fifty_euros_gets_free_delivery() -> None:
    fee = delivery_fee(order_total=Decimal("50.00"))
    assert fee == Decimal("0.00")

def test_order_above_fifty_euros_gets_free_delivery() -> None:
    fee = delivery_fee(order_total=Decimal("50.01"))
    assert fee == Decimal("0.00")
```

The €50 test catches accidentally requiring an order to be _more than_ €50.
The other tests check both sides of the cutoff. The expected prices come from the delivery
policy above; calculating them with `delivery_fee` would repeat any bug in that function.
