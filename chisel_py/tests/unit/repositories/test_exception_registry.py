import tempfile
from pathlib import Path

from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation
from chisel.checker.repositories.exception_registry import ExceptionRegistry


def _registry(config: str) -> ExceptionRegistry:
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "chisel-exceptions.toml").write_text(config)
        reg = ExceptionRegistry()
        reg.load(root)
        return reg


def _violation(file: str, rule_id: str) -> Violation:
    return Violation(
        file=file,
        line=1,
        severity=Severity.ERROR,
        rule_id=rule_id,
        message="test",
    )


class TestParsing:
    def test_loads_from_chisel_exceptions_toml(self):
        config = """
[[exceptions]]
files = ["src/legacy/*.py"]
rules = ["*"]
reason = "Legacy code"
"""
        reg = _registry(config)
        exempted = reg.is_exempted("src/legacy/old.py", "structural:print-banned")
        assert exempted


class TestWildcardRuleMatching:
    def test_star_wildcard_matches_any_rule(self):
        config = """
[[exceptions]]
files = ["src/*.py"]
rules = ["*"]
reason = "Temp"
"""
        reg = _registry(config)
        assert reg.is_exempted("src/foo.py", "structural:print-banned")

    def test_star_wildcard_differs_from_all(self):
        config = """
[[exceptions]]
files = ["src/*.py"]
rules = ["*"]
reason = "Temp"
"""
        reg = _registry(config)
        assert reg.is_exempted("src/foo.py", "any-rule-at-all")


class TestExactRuleMatching:
    def test_matches_exact_rule_id(self):
        config = """
[[exceptions]]
files = ["src/cli.py"]
rules = ["structural:print-banned"]
reason = "CLI"
"""
        reg = _registry(config)
        assert reg.is_exempted("src/cli.py", "structural:print-banned")

    def test_rejects_different_rule_id(self):
        config = """
[[exceptions]]
files = ["src/cli.py"]
rules = ["structural:print-banned"]
reason = "CLI"
"""
        reg = _registry(config)
        assert not reg.is_exempted("src/cli.py", "structural:isinstance-banned")


class TestPrefixRuleMatching:
    def test_matches_rule_prefix(self):
        config = """
[[exceptions]]
files = ["*.py"]
rules = ["structural"]
reason = "Legacy"
"""
        reg = _registry(config)
        assert reg.is_exempted("src/foo.py", "structural:print-banned")

    def test_rejects_partial_prefix(self):
        config = """
[[exceptions]]
files = ["*.py"]
rules = ["struct"]
reason = "Should not match structural"
"""
        reg = _registry(config)
        assert not reg.is_exempted("src/foo.py", "structural:print-banned")


class TestGlobFileMatching:
    def test_matches_file_by_glob(self):
        config = """
[[exceptions]]
files = ["src/services/*.py"]
rules = ["*"]
reason = "all services"
"""
        reg = _registry(config)
        assert reg.is_exempted("src/services/user.py", "any-rule")

    def test_rejects_file_not_matching_glob(self):
        config = """
[[exceptions]]
files = ["src/services/*.py"]
rules = ["*"]
reason = "all services"
"""
        reg = _registry(config)
        assert not reg.is_exempted("src/models/user.py", "any-rule")


class TestFilterMethod:
    def test_removes_exempted_violations(self):
        config = """
[[exceptions]]
files = ["src/cli.py"]
rules = ["structural:print-banned"]
reason = "CLI"
"""
        reg = _registry(config)
        violations = [
            _violation("src/cli.py", "structural:print-banned"),
            _violation("src/other.py", "structural:print-banned"),
        ]
        result = reg.filter(violations)
        assert len(result) == 1

    def test_preserves_non_exempted_violations(self):
        config = """
[[exceptions]]
files = ["src/cli.py"]
rules = ["structural:print-banned"]
reason = "CLI"
"""
        reg = _registry(config)
        violations = [
            _violation("src/other.py", "structural:print-banned"),
        ]
        result = reg.filter(violations)
        assert len(result) == 1


class TestNoExceptionsFile:
    def test_returns_false_when_no_exceptions_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            reg = ExceptionRegistry()
            reg.load(Path(tmp))
            assert not reg.is_exempted("src/foo.py", "any-rule")

    def test_filter_preserves_all_when_no_exceptions_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            reg = ExceptionRegistry()
            reg.load(Path(tmp))
            violations = [_violation("src/foo.py", "any-rule")]
            result = reg.filter(violations)
            assert len(result) == 1
