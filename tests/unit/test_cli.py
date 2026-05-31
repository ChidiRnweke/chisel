import json
import sys

from chisel.cli.main import app
from chisel.checker.services.protocols import RuleInfo


def _invoke(args: list) -> str:
    captured: list[str] = []

    class Capture:
        def write(self, text: str) -> None:
            captured.append(text)

        def flush(self) -> None:
            pass

    old_stdout = sys.stdout
    sys.stdout = Capture()
    try:
        app(args, standalone_mode=False)
    except SystemExit:
        pass
    finally:
        sys.stdout = old_stdout
    return "".join(captured)


class TestRulesCommand:
    def test_rules_outputs_all_categories(self):
        output = _invoke(["rules"])
        assert "structural" in output
        assert "import-boundary" in output
        assert "complexity" in output
        assert "test-structure" in output

    def test_rules_json_outputs_valid_json(self):
        output = _invoke(["rules", "--json"])
        data = json.loads(output)
        assert len(data) > 0
        assert all(isinstance(r.get("id"), str) for r in data)
        assert all(isinstance(r.get("category"), str) for r in data)

    def test_rules_json_contains_fix_guidance(self):
        output = _invoke(["rules", "--json"])
        data = json.loads(output)
        print_banned = [r for r in data if r["id"] == "structural:print-banned"]
        assert len(print_banned) == 1
        assert len(print_banned[0]["fix_guidance"]) > 0


class TestExplainCommand:
    def test_explain_shows_rule_detail(self):
        output = _invoke(["explain", "structural:print-banned"])
        assert "structural:print-banned" in output
        assert "How to fix" in output
        assert "logger" in output.lower()

    def test_explain_category_shows_all_rules_in_category(self):
        output = _invoke(["explain", "concurrency"])
        assert "asyncio-gather-banned" in output
        assert "How to fix" in output

    def test_explain_json_outputs_valid_json(self):
        output = _invoke(["explain", "structural:print-banned", "--json"])
        data = json.loads(output)
        assert len(data) >= 1
        assert data[0]["id"] == "structural:print-banned"
