
import ast
from dataclasses import dataclass
from chisel.checker.services.protocols import RuleInfo
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
            violations.extend(self._check_mock_ban(file))
            violations.extend(self._check_impl_detail_assertions(file))
            violations.extend(self._check_sleep_ban(file))
        return violations

    def describe_rules(self) -> list[RuleInfo]:
        return [
            RuleInfo(id="test-structure:test-file-location", category="test-structure",
                     description="Test file outside tests/unit/, tests/integration/, or tests/e2e/",
                     fix_guidance="Move into the correct directory. Unit tests in tests/unit/, repository tests in tests/integration/, full-stack tests in tests/e2e/."),
            RuleInfo(id="test-structure:one-assert-per-test", category="test-structure",
                     description="More than one assert in a test function",
                     fix_guidance="Split into separate test functions, one per assertion. Name each after the invariant it proves: test_cannot_X, test_returns_Y_when_Z."),
            RuleInfo(id="test-structure:test-naming", category="test-structure",
                     description="Test name does not describe an invariant",
                     fix_guidance="Name the test after the invariant it proves: test_cannot_X, test_returns_Y_when_Z, test_detects_X, test_allows_X_under_Y."),
            RuleInfo(id="test-structure:skip-without-reason", category="test-structure",
                     description="@pytest.mark.skip without a reason",
                     fix_guidance="Add reason= explaining why this test is skipped and when it should be re-enabled."),
            RuleInfo(id="test-structure:banned-import-in-tests", category="test-structure",
                     description="TestClient, uvicorn, or httpx imported in unit/integration tests",
                     fix_guidance="Inject fakes and call the service or controller directly. The factory pattern exists to make this possible without spinning up the app."),
        ]

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
            "Move into the correct directory. Unit tests in tests/unit/, "
            "repository tests in tests/integration/, full-stack tests in "
            "tests/e2e/.",
        )

    def _check_one_assert(self, file: FileInfo) -> list[Violation]:
        tree = file.ast_tree
        if tree is None:
            return []

        violations: list[Violation] = []
        for node in tree.body:
            match node:
                case ast.FunctionDef(name=name) if name.startswith("test_"):
                    assert_count = self._count_asserts(node)
                    if assert_count != 1:
                        violations.extend(
                            self._v(
                                file, node.lineno, "one-assert-per-test",
                                "Split into separate test functions, one per "
                                "assertion. Name each after the invariant it proves: "
                                "test_cannot_X, test_returns_Y_when_Z.",
                            )
                        )
                case _:
                    pass
        return violations

    def _count_asserts(self, node: ast.FunctionDef) -> int:
        count = 0
        for child in ast.walk(node):
            match child:
                case ast.Assert():
                    count += 1
                case _:
                    pass
        return count

    def _check_test_naming(self, file: FileInfo) -> list[Violation]:
        tree = file.ast_tree
        if tree is None:
            return []

        violations: list[Violation] = []
        for node in tree.body:
            match node:
                case ast.FunctionDef(name=name) if name.startswith("test_"):
                    invariant_part = name[len("test_"):]
                    if "_" not in invariant_part:
                        violations.extend(
                            self._v(
                                file, node.lineno, "test-naming",
                                "Name the test after the invariant it proves: "
                                "test_cannot_X, test_returns_Y_when_Z, "
                                "test_detects_X, test_allows_X_under_Y.",
                            )
                        )
                case _:
                    pass
        return violations

    def _check_skip_reason(self, file: FileInfo) -> list[Violation]:
        tree = file.ast_tree
        if tree is None:
            return []

        violations: list[Violation] = []
        for node in ast.walk(tree):
            match node:
                case ast.FunctionDef():
                    for dec in node.decorator_list:
                        if self._is_pytest_skip(dec):
                            if not self._has_reason_keyword(dec):
                                violations.extend(
                                    self._v(
                                        file, node.lineno, "skip-without-reason",
                                        "Add reason= explaining why this test is "
                                        "skipped and when it should be re-enabled.",
                                    )
                                )
                case _:
                    pass
        return violations

    def _is_pytest_skip(self, dec: ast.expr) -> bool:
        match dec:
            case ast.Attribute(value=ast.Attribute(value=ast.Name(id="pytest"), attr="mark"), attr="skip"):
                return True
            case ast.Call():
                return self._is_pytest_skip(dec.func)
            case _:
                return False

    def _has_reason_keyword(self, dec: ast.expr) -> bool:
        match dec:
            case ast.Call():
                for kw in dec.keywords:
                    if kw.arg == "reason":
                        return True
            case _:
                pass
        return False

    def _check_banned_imports(self, file: FileInfo) -> list[Violation]:
        if not self._is_unit_or_integration(file):
            return []

        tree = file.ast_tree
        if tree is None:
            return []

        violations: list[Violation] = []
        for node in ast.walk(tree):
            match node:
                case ast.Import():
                    for alias in node.names:
                        v = self._check_banned_module(file, node.lineno, alias.name)
                        if v:
                            violations.extend(v)
                case ast.ImportFrom():
                    module = node.module or ""
                    v = self._check_banned_module(file, node.lineno, module)
                    if v:
                        violations.extend(v)
                case _:
                    pass
        return violations

    def _check_banned_module(
        self, file: FileInfo, line: int, module: str
    ) -> list[Violation] | None:
        banned = {"fastapi.testclient", "uvicorn", "httpx"}
        for prefix in banned:
            if module == prefix or module.startswith(prefix + "."):
                return self._v(
                    file, line, "banned-import-in-tests",
                    "Inject fakes and call the service or controller "
                    "directly. The factory pattern exists to make this "
                    "possible without spinning up the app.",
                )
        return None

    def _check_mock_ban(self, file: FileInfo) -> list[Violation]:
        tree = file.ast_tree
        if tree is None:
            return []

        banned_mock = {"unittest.mock", "pytest_mock", "mock"}
        violations: list[Violation] = []
        for node in ast.walk(tree):
            match node:
                case ast.Import():
                    for alias in node.names:
                        for prefix in banned_mock:
                            if alias.name == prefix or alias.name.startswith(
                                prefix + "."
                            ):
                                violations.extend(
                                    self._v(
                                        file, node.lineno, "mock-banned",
                                        f"Mocking library '{alias.name}' is banned "
                                        f"in tests",
                                    )
                                )
                case ast.ImportFrom():
                    module = node.module or ""
                    for prefix in banned_mock:
                        if module == prefix or module.startswith(prefix + "."):
                            violations.extend(
                                self._v(
                                    file, node.lineno, "mock-banned",
                                    f"Mocking library '{module}' is banned in tests",
                                )
                            )
                case _:
                    pass
        return violations

    def _check_impl_detail_assertions(self, file: FileInfo) -> list[Violation]:
        tree = file.ast_tree
        if tree is None:
            return []

        banned_attrs = frozenset({
            "call_count", "call_args", "call_args_list",
            "assert_called", "assert_called_once", "assert_called_with",
            "assert_called_once_with", "assert_not_called",
            "assert_any_call", "assert_has_calls",
        })

        violations: list[Violation] = []
        for node in ast.walk(tree):
            match node:
                case ast.Attribute(attr=attr) if attr in banned_attrs:
                    violations.extend(
                        self._v(
                            file, node.lineno, "impl-detail-assertion",
                            f"Assertion on implementation detail '.{attr}' "
                            f"is banned in tests",
                        )
                    )
                case _:
                    pass
        return violations

    def _check_sleep_ban(self, file: FileInfo) -> list[Violation]:
        if not self._is_unit_or_integration(file):
            return []

        tree = file.ast_tree
        if tree is None:
            return []

        has_sleep_import = False
        for node in ast.walk(tree):
            match node:
                case ast.ImportFrom():
                    module = node.module or ""
                    if module in ("time", "asyncio"):
                        if any(alias.name == "sleep" for alias in node.names):
                            has_sleep_import = True
                case _:
                    pass

        violations: list[Violation] = []
        for node in ast.walk(tree):
            match node:
                case ast.Call(func=ast.Attribute(value=ast.Name(id=name), attr="sleep")) if name in ("time", "asyncio"):
                    violations.extend(
                        self._v(
                            file, node.lineno, "sleep-in-tests",
                            f"{name}.sleep() is banned "
                            f"in unit/integration tests",
                        )
                    )
                case ast.Call(func=ast.Name(id=name)):
                    if name == "sleep" and has_sleep_import:
                        violations.extend(
                            self._v(
                                file, node.lineno, "sleep-in-tests",
                                "sleep() is banned in unit/integration tests",
                            )
                        )
                case _:
                    pass
        return violations
