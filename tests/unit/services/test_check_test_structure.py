from __future__ import annotations

import ast

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.services.check_test_structure import CheckTestStructureService


def _check_file(source: str, path: str, layer: Layer = Layer.UNKNOWN) -> list:
    service = CheckTestStructureService()
    info = FileInfo(
        path=__import__("pathlib").Path(path),
        layer=layer,
        source=source,
    )
    info.ast_tree = ast.parse(source)
    project = ProjectInfo(
        root_path=__import__("pathlib").Path("."),
        files=[info],
    )
    return service.check(project)


def _count(violations, suffix):
    prefix = "test-structure:"
    return sum(1 for v in violations if v.rule_id == f"{prefix}{suffix}")


class TestTestFileLocation:
    def test_detects_test_file_outside_valid_test_dirs(self):
        violations = _check_file(
            "from __future__ import annotations\ndef test_it(): assert True\n",
            path="src/test_foo.py",
        )
        assert _count(violations, "test-file-location") == 1

    def test_accepts_test_file_in_unit_test_dir(self):
        violations = _check_file(
            "from __future__ import annotations\ndef test_it(): assert True\n",
            path="tests/unit/test_foo.py",
        )
        assert _count(violations, "test-file-location") == 0


class TestOneAssertPerTest:
    def test_detects_two_asserts_in_test_function(self):
        violations = _check_file(
            "from __future__ import annotations\n"
            "def test_it():\n"
            "    assert True\n"
            "    assert False\n",
            path="tests/unit/test_foo.py",
        )
        assert _count(violations, "one-assert-per-test") == 1

    def test_accepts_single_assert_in_test_function(self):
        violations = _check_file(
            "from __future__ import annotations\n"
            "def test_it():\n"
            "    assert True\n",
            path="tests/unit/test_foo.py",
        )
        assert _count(violations, "one-assert-per-test") == 0

    def test_accepts_test_function_with_zero_asserts(self):
        violations = _check_file(
            "from __future__ import annotations\n"
            "def test_it():\n"
            "    pass\n",
            path="tests/unit/test_foo.py",
        )
        assert _count(violations, "one-assert-per-test") == 1


class TestTestNaming:
    def test_detects_single_word_test_name(self):
        violations = _check_file(
            "from __future__ import annotations\n"
            "def test_create(): pass\n",
            path="tests/unit/test_foo.py",
        )
        assert _count(violations, "test-naming") == 1

    def test_accepts_descriptive_test_name(self):
        violations = _check_file(
            "from __future__ import annotations\n"
            "def test_cannot_create_with_empty_title(): pass\n",
            path="tests/unit/test_foo.py",
        )
        assert _count(violations, "test-naming") == 0


class TestSkipReason:
    def test_detects_skip_without_reason(self):
        violations = _check_file(
            "from __future__ import annotations\n"
            "import pytest\n"
            "@pytest.mark.skip\n"
            "def test_it(): pass\n",
            path="tests/unit/test_foo.py",
        )
        assert _count(violations, "skip-without-reason") == 1

    def test_accepts_skip_with_reason(self):
        violations = _check_file(
            "from __future__ import annotations\n"
            "import pytest\n"
            "@pytest.mark.skip(reason='not implemented')\n"
            "def test_it(): pass\n",
            path="tests/unit/test_foo.py",
        )
        assert _count(violations, "skip-without-reason") == 0


class TestBannedImportsInTests:
    def test_detects_test_client_import_in_unit_test(self):
        violations = _check_file(
            "from __future__ import annotations\n"
            "from fastapi.testclient import TestClient\n",
            path="tests/unit/test_foo.py",
        )
        assert _count(violations, "banned-import-in-tests") == 1

    def test_accepts_standard_imports_in_unit_test(self):
        violations = _check_file(
            "from __future__ import annotations\nimport os\n",
            path="tests/unit/test_foo.py",
        )
        assert _count(violations, "banned-import-in-tests") == 0

    def test_detects_uvicorn_import_in_integration_test(self):
        violations = _check_file(
            "from __future__ import annotations\nimport uvicorn\n",
            path="tests/integration/test_foo.py",
        )
        assert _count(violations, "banned-import-in-tests") == 1
