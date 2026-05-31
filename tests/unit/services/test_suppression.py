from __future__ import annotations

from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation
from chisel.checker.services.suppression import SuppressionService


def _violation(rule_id: str, line: int = 1, file: str = "src/f.py") -> Violation:
    return Violation(
        file=file,
        line=line,
        severity=Severity.ERROR,
        rule_id=rule_id,
        message="test",
    )


def _service() -> SuppressionService:
    return SuppressionService()


def _check(violations: list, source_lines: dict) -> list:
    return _service().check(violations, {**source_lines})


class TestRemovesSuppressedViolations:
    def test_removes_violation_with_exact_matching_noqa(self):
        v = _violation("structural:print-banned", line=1)
        sources = {"src/f.py": "# noqa: structural:print-banned\nsource"}
        result = _check([v], sources)
        assert len(result) == 0

    def test_removes_violation_with_prefix_matching_noqa(self):
        v = _violation("structural:print-banned", line=1)
        sources = {"src/f.py": "# noqa: structural\nsource"}
        result = _check([v], sources)
        assert len(result) == 0

    def test_preserves_violation_without_matching_noqa(self):
        v = _violation("structural:print-banned", line=1)
        sources = {"src/f.py": "# noqa: concurrency:gather\nsource"}
        result = _check([v], sources)
        assert len(result) == 1

    def test_handles_multiple_rule_ids_in_noqa(self):
        v = _violation("structural:print-banned", line=1)
        sources = {"src/f.py": "# noqa: concurrency, structural:print-banned\nsource"}
        result = _check([v], sources)
        assert len(result) == 0

    def test_preserves_violation_on_different_line_than_noqa(self):
        v = _violation("structural:print-banned", line=3)
        sources = {"src/f.py": "# noqa: structural:print-banned\nx = 1\ny = 2\n"}
        result = _check([v], sources)
        assert len(result) == 1
