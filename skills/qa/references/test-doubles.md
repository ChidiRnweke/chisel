# Fakes and recorders

**What:** Controlled database/API input, or messages the application attempts to send.
**When:** A dependency needs substitution for a fast, repeatable test.
**Type:** Fixtures for unit/integration tests. Use typed handwritten classes or functions.

## Send one confirmation to the buyer

When confirming order “order-42”, send one confirmation to its buyer, alice@example.test.
The recipient, payload, and absence of duplicate sends are requirements. Record the outgoing
transport requests and compare the whole list. `Recorder.sent` stores each
`(recipient, payload)` send attempt. Keep serialization real.

### Bad — checks only that the expected message is somewhere in the list

```python
from confirmation_subject import Recorder, confirm_order

def test_order_sends_one_confirmation() -> None:
    recorder = Recorder()
    confirm_order("order-42", "alice@example.test", recorder)
    assert (
        "alice@example.test", b'{"kind":"order-confirmed","orderId":"order-42"}'
    ) in recorder.sent
```

Sending the same confirmation twice still satisfies membership. An extra send to the wrong
recipient also goes unnoticed.

### Solution — compare every outgoing request

```python
from confirmation_subject import Recorder, confirm_order

def test_order_sends_one_confirmation() -> None:
    recorder = Recorder()
    confirm_order("order-42", "alice@example.test", recorder)
    assert recorder.sent == [
        ("alice@example.test", b'{"kind":"order-confirmed","orderId":"order-42"}')
    ]
```

This fails for duplicates, extra recipients, and incorrect payloads. Exact counts/order are
appropriate only when required. For several unordered messages, compare sorted copies while
preserving duplicates. This establishes send attempts, not provider acceptance or delivery.

Supplying input with a fake does not justify checking how often it was queried. Record external
sends, not internal dispatcher calls. Fakes cannot prove SQL or provider compatibility.
Required support logs can be checked; developer debug text usually should not be.
Do not cast partial objects, patch private methods, or use mocking libraries.
