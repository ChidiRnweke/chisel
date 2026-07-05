import json
import sys
import tempfile
from pathlib import Path

from chisel.cli.main import app


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


def _invoke_with_stderr(args: list) -> tuple[str, str]:
    captured_stdout: list[str] = []
    captured_stderr: list[str] = []

    class Capture:
        def __init__(self, captured: list[str]) -> None:
            self._captured = captured

        def write(self, text: str) -> None:
            self._captured.append(text)

        def flush(self) -> None:
            pass

        def isatty(self) -> bool:
            return False

    old_stdout = sys.stdout
    old_stderr = sys.stderr
    old_stdin = sys.stdin
    sys.stdout = Capture(captured_stdout)
    sys.stderr = Capture(captured_stderr)
    sys.stdin = Capture([])
    try:
        app(args, standalone_mode=False)
    except SystemExit:
        pass
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        sys.stdin = old_stdin
    return "".join(captured_stdout), "".join(captured_stderr)


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


class TestSetupCommand:
    def test_setup_codex_dry_run_json_outputs_install_plan(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = _invoke(["setup", tmp, "--target", "codex", "--dry-run", "--json"])
            data = json.loads(output)
            assert data["target"] == "codex"
            assert data["target_dir"] == ".agents/skills"
            assert any(r["status"] == "would_install" for r in data["results"])

    def test_setup_claude_writes_claude_skills(self):
        with tempfile.TemporaryDirectory() as tmp:
            _invoke(["setup", tmp, "--target", "claude", "--skill", "qa"])
            destination = Path(tmp) / ".claude" / "skills" / "qa" / "SKILL.md"
            assert destination.exists()

    def test_setup_opencode_skill_filter_writes_only_requested_skill(self):
        with tempfile.TemporaryDirectory() as tmp:
            _invoke(["setup", tmp, "--target", "opencode", "--skill", "qa"])
            root = Path(tmp) / ".opencode" / "skills"
            assert (root / "qa" / "SKILL.md").exists()
            assert not (root / "planning-features").exists()

    def test_setup_without_target_in_noninteractive_mode_exits_with_guidance(self):
        with tempfile.TemporaryDirectory() as tmp:
            _stdout, stderr = _invoke_with_stderr(["setup", tmp])
            assert "--target codex" in stderr
