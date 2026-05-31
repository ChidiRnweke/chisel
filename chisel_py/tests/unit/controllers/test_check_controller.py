
import tempfile
from pathlib import Path

from chisel.checker.controllers.check_controller import CheckController
from chisel.checker.services.concurrency import ConcurrencyService
from chisel.checker.services.suppression import SuppressionService


class TestCheckController:
    def test_returns_result_with_correct_file_count(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src" / "myapp").mkdir(parents=True)
            (root / "src" / "myapp" / "__init__.py").write_text("x = 1\n")
            (root / "pyproject.toml").write_text(
                "[project]\nname='myapp'\nrequires-python='>=3.11'\n"
            )
            controller = CheckController(
                _services=[ConcurrencyService()],
                _suppression=SuppressionService(),
            )
            result = controller.check(str(root))
            assert result.files_checked >= 1

    def test_returns_result_with_zero_violations_for_clean_project(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src" / "myapp").mkdir(parents=True)
            (root / "src" / "myapp" / "__init__.py").write_text("x = 1\n")
            (root / "pyproject.toml").write_text(
                "[project]\nname='myapp'\nrequires-python='>=3.11'\n"
            )
            controller = CheckController(
                _services=[ConcurrencyService()],
                _suppression=SuppressionService(),
            )
            result = controller.check(str(root))
            assert result.errors == 0

    def test_applies_exceptions_filter_before_suppression(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src" / "myapp").mkdir(parents=True)
            (root / "src" / "myapp" / "__init__.py").write_text(
                'print("hello")\n'
            )
            (root / "pyproject.toml").write_text(
                "[project]\nname='myapp'\nrequires-python='>=3.11'\n"
            )
            (root / "chisel-exceptions.toml").write_text(
                '[[exceptions]]\nfiles = ["src/myapp/__init__.py"]\nrules = ["*"]\nreason = "test"\n'
            )
            controller = CheckController(
                _services=[ConcurrencyService()],
                _suppression=SuppressionService(),
            )
            result = controller.check(str(root))
            assert result.errors == 0
