import io
import json

from rich.console import Console

from chisel.checker.models.result import CheckResult
from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation
from chisel.checker.reporter import Reporter


def _result() -> CheckResult:
    return CheckResult(
        violations=[
            Violation(
                file="src/a.py",
                line=1,
                severity=Severity.ERROR,
                rule_id="structural:print-banned",
                message="print() is banned.",
            ),
            Violation(
                file="src/b.py",
                line=2,
                severity=Severity.ERROR,
                rule_id="structural:print-banned",
                message="print() is banned.",
            ),
            Violation(
                file="tests/test_a.py",
                line=3,
                severity=Severity.WARNING,
                rule_id="test-structure:one-assert-per-test",
                message="Tests must have one assert.",
            ),
        ],
        errors=2,
        warnings=1,
        files_checked=3,
    )


class TestReporter:
    def test_report_json_uses_message_refs(self):
        data = json.loads(Reporter().report_json(_result()))

        assert data["violations"][0]["message_ref"] == "[1]"
        assert data["violations"][1]["message_ref"] == "[1]"
        assert data["violations"][2]["message_ref"] == "[2]"
        assert "message" not in data["violations"][0]
        assert data["messages"] == [
            {
                "ref": "[1]",
                "skill_name": "building-python-backend",
                "message": "print() is banned.",
            },
            {
                "ref": "[2]",
                "skill_name": "qa",
                "message": "Tests must have one assert.",
            },
        ]

    def test_report_prints_message_once_per_ref(self):
        stream = io.StringIO()
        console = Console(file=stream, force_terminal=False, width=120)

        Reporter(_console=console).report(_result())

        output = stream.getvalue()
        assert output.count("print() is banned.") == 1
        assert "skill: building-python-backend" in output
        assert "skill: qa" in output
