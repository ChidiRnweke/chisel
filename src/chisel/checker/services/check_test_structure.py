from __future__ import annotations

import ast
from dataclasses import dataclass

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation


_VALID_TEST_ROOTS = frozenset({"tests/unit", "tests/integration", "tests/e2e"})


@dataclass(slots=True)
class CheckTestStructureService:
    rule_id_prefix: str = "test-structure"

    def check(self, project: ProjectInfo) -> list[Violation]:
        violations: list[Violation] = []
        for file in project.files:
            if not self._is_test_file(file):
                continue
            if file.ast_tree is None:
                continue
            violations.extend(self._check_file_location(file))
            violations.extend(self._check_one_assert(file))
            violations.extend(self._check_test_naming(file))
            violations.extend(self._check_skip_reason(file))
            violations.extend(self._check_banned_imports(file))
        return violations

    def _is_test_file(self, file: FileInfo) -> bool:
        name = file.path.name
        return name.startswith("test_") and name.endswith(".py")

    def _is_unit_or_integration(self, file: FileInfo) -> bool:
        path_str = str(file.path)
        return (
            path_str.startswith("tests/unit/")
            or path_str.startswith("tests/integration/")
        )

    def _v(
        self, file: FileInfo, line: int, rule_suffix: str, message: str
    ) -> list[Violation]:
        return [
            Violation(
                file=str(file.path),
                line=line,
                severity=Severity.ERROR,
                rule_id=f"{self.rule_id_prefix}:{rule_suffix}",
                message=message,
            )
        ]

    def _check_file_location(self, file: FileInfo) -> list[Violation]:
        path_str = str(file.path)
        for root in _VALID_TEST_ROOTS:
            if path_str.startswith(root + "/") or path_str == root:
                return []
        return self._v(
            file, 1, "test-file-location",
            f"Test file '{file.path}' must live under tests/unit/, "
            f"tests/integration/, or tests/e2e/",
        )

    def _check_one_assert(self, file: FileInfo) -> list[Violation]:
        tree = file.ast_tree
        if tree is None:
            return []

        violations: list[Violation] = []
        for node in tree.body:
            if isinstance(node, ast.FunctionDef) and node.name.startswith("test_"):
                assert_count = self._count_asserts(node)
                if assert_count != 1:
                    violations.extend(
                        self._v(
                            file, node.lineno, "one-assert-per-test",
                            f"Test '{node.name}' has {assert_count} assert "
                            f"statements (exactly 1 required)",
                        )
                    )
        return violations

    def _count_asserts(self, node: ast.FunctionDef) -> int:
        count = 0
        for child in ast.walk(node):
            if isinstance(child, ast.Assert):
                count += 1
        return count

    def _check_test_naming(self, file: FileInfo) -> list[Violation]:
        tree = file.ast_tree
        if tree is None:
            return []

        violations: list[Violation] = []
        for node in tree.body:
            if isinstance(node, ast.FunctionDef) and node.name.startswith("test_"):
                name = node.name
                invariant_part = name[len("test_"):]
                if "_" not in invariant_part:
                    violations.extend(
                        self._v(
                            file, node.lineno, "test-naming",
                            f"Test name '{name}' does not describe an invariant "
                            f"— use test_cannot_X, test_returns_Y_when_Z, etc.",
                        )
                    )
        return violations

    def _check_skip_reason(self, file: FileInfo) -> list[Violation]:
        tree = file.ast_tree
        if tree is None:
            return []

        violations: list[Violation] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                for dec in node.decorator_list:
                    if self._is_pytest_skip(dec):
                        if not self._has_reason_keyword(dec):
                            violations.extend(
                                self._v(
                                    file, node.lineno, "skip-without-reason",
                                    f"@pytest.mark.skip on '{node.name}' "
                                    f"must include reason=",
                                )
                            )
        return violations

    def _is_pytest_skip(self, dec: ast.expr) -> bool:
        if isinstance(dec, ast.Attribute) and dec.attr == "skip":
            if isinstance(dec.value, ast.Attribute) and dec.value.attr == "mark":
                return isinstance(dec.value.value, ast.Name) and dec.value.value.id == "pytest"
        if isinstance(dec, ast.Call):
            return self._is_pytest_skip(dec.func)
        return False

    def _has_reason_keyword(self, dec: ast.expr) -> bool:
        if isinstance(dec, ast.Call):
            for kw in dec.keywords:
                if kw.arg == "reason":
                    return True
        return False

    def _check_banned_imports(self, file: FileInfo) -> list[Violation]:
        if not self._is_unit_or_integration(file):
            return []

        tree = file.ast_tree
        if tree is None:
            return []

        violations: list[Violation] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    v = self._check_banned_module(file, node.lineno, alias.name)
                    if v:
                        violations.extend(v)
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                v = self._check_banned_module(file, node.lineno, module)
                if v:
                    violations.extend(v)
        return violations

    def _check_banned_module(
        self, file: FileInfo, line: int, module: str
    ) -> list[Violation] | None:
        banned = {"fastapi.testclient", "uvicorn", "httpx"}
        for prefix in banned:
            if module == prefix or module.startswith(prefix + "."):
                return self._v(
                    file, line, "banned-import-in-tests",
                    f"'{module}' is banned in tests/unit/ and tests/integration/ "
                    f"— use only in tests/e2e/",
                )
        return None
