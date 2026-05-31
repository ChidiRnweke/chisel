from __future__ import annotations

import ast
from dataclasses import dataclass

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation


@dataclass(slots=True)
class StructuralService:
    rule_id_prefix: str = "structural"

    def check(self, project: ProjectInfo) -> list[Violation]:
        violations: list[Violation] = []
        for file in project.files:
            if file.ast_tree is None:
                continue
            violations.extend(self._check_file(file))
        violations.extend(self._check_service_protocols(project))
        return violations

    def _check_file(self, file: FileInfo) -> list[Violation]:
        tree = file.ast_tree
        if tree is None:
            return []

        violations: list[Violation] = []
        violations.extend(self._check_future_annotations(file, tree))
        violations.extend(self._check_all_imports_at_top(file, tree))
        violations.extend(self._check_getattr_setattr(file, tree))
        violations.extend(self._check_percent_format(file, tree))
        violations.extend(self._check_logger_fstring(file, tree))
        violations.extend(self._check_print(file, tree))
        violations.extend(self._check_free_functions_services(file, tree))
        violations.extend(self._check_dataclass_rules(file, tree))
        violations.extend(self._check_misplaced_dataclass(file, tree))
        violations.extend(self._check_logger_level(file, tree))
        violations.extend(self._check_app_error_rules(file, tree))
        violations.extend(self._check_match_case(file, tree))
        violations.extend(self._check_try_except_routes(file, tree))
        violations.extend(self._check_app_factory(file, tree))
        violations.extend(self._check_orm_mapped(file, tree))
        violations.extend(self._check_http_exception_location(file, tree))
        violations.extend(self._check_concrete_service_import(file, tree))
        violations.extend(self._check_frozen_dataclass(file, tree))
        return violations

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

    def _check_future_annotations(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        for node in tree.body:
            if isinstance(node, ast.ImportFrom) and node.module == "__future__":
                if any(alias.name == "annotations" for alias in node.names):
                    return []
        return self._v(
            file, 1, "missing-future-annotations",
            'Missing "from __future__ import annotations"',
        )

    def _check_all_imports_at_top(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        violations: list[Violation] = []
        violations.extend(self._check_top_level_import_order(file, tree))
        for node in tree.body:
            violations.extend(self._find_nested_imports(file, node))
        return violations

    def _check_top_level_import_order(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        violations: list[Violation] = []
        import_finished = False
        for node in tree.body:
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                if import_finished:
                    violations.extend(
                        self._v(
                            file, node.lineno, "import-not-at-top",
                            "All imports must be at the top of the file (E402)",
                        )
                    )
            elif isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant):
                continue
            elif isinstance(node, ast.ImportFrom) and node.module is None:
                continue
            else:
                import_finished = True
        return violations

    _COMPOUND_TYPES = (
        ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef,
        ast.If, ast.For, ast.While, ast.With, ast.Try,
    )

    def _find_nested_imports(
        self, file: FileInfo, node: ast.stmt
    ) -> list[Violation]:
        if not isinstance(node, self._COMPOUND_TYPES):
            return []

        bodies: list[tuple[list[ast.stmt], bool]] = []

        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            bodies.append((node.body, False))
        elif isinstance(node, ast.If):
            guarded = self._is_type_checking_guard(node)
            bodies.append((node.body, guarded))
            bodies.append((node.orelse, False))
        elif isinstance(node, ast.Try):
            bodies.append((node.body, False))
            for handler in node.handlers:
                bodies.append((handler.body, False))
            if node.orelse:
                bodies.append((node.orelse, False))
            if node.finalbody:
                bodies.append((node.finalbody, False))
        elif isinstance(node, (ast.For, ast.While)):
            bodies.append((node.body, False))
            if node.orelse:
                bodies.append((node.orelse, False))
        elif isinstance(node, ast.With):
            bodies.append((node.body, False))

        violations: list[Violation] = []
        for body, type_checking in bodies:
            for child in body:
                if isinstance(child, (ast.Import, ast.ImportFrom)):
                    if not type_checking:
                        violations.extend(
                            self._v(
                                file, child.lineno,
                                "import-not-at-top-nested",
                                "Import statements inside functions, methods, "
                                "or blocks are banned — move to top of file",
                            )
                        )
                if isinstance(child, self._COMPOUND_TYPES):
                    violations.extend(
                        self._find_nested_imports(file, child)
                    )
        return violations

    def _is_type_checking_guard(self, node: ast.If) -> bool:
        test = node.test
        if isinstance(test, ast.Name) and test.id == "TYPE_CHECKING":
            return True
        if isinstance(test, ast.Attribute) and test.attr == "TYPE_CHECKING":
            return True
        return False

    def _check_getattr_setattr(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        violations: list[Violation] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                if node.func.id in ("getattr", "setattr"):
                    violations.extend(
                        self._v(
                            file, node.lineno, "getattr-setattr-banned",
                            f"{node.func.id}() is banned in application code",
                        )
                    )
        return violations

    def _check_percent_format(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        violations: list[Violation] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mod):
                if isinstance(node.left, ast.Constant):
                    if isinstance(node.left.value, str):
                        violations.extend(
                            self._v(
                                file, node.lineno, "percent-interpolation-banned",
                                "'%' string interpolation is banned — use f-strings",
                            )
                        )
        return violations

    def _check_logger_fstring(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        violations: list[Violation] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                if isinstance(node.func.value, ast.Name):
                    if node.func.value.id == "logger":
                        if node.args and isinstance(node.args[0], ast.JoinedStr):
                            violations.extend(
                                self._v(
                                    file, node.lineno, "logger-fstring",
                                    "f-string in logger call is banned — use structured "
                                    "key-value arguments",
                                )
                            )
        return violations

    def _check_print(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                if node.func.id == "print":
                    return self._v(
                        file, node.lineno, "print-banned",
                        "print() is banned in src/ — use logger",
                    )
        return []

    def _check_free_functions_services(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer != Layer.SERVICES:
            return []

        violations: list[Violation] = []
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                name = node.name
                cls = self._find_containing_class(node, tree)
                if cls is None:
                    violations.extend(
                        self._v(
                            file, node.lineno, "free-function-services",
                            f"Module-level free function '{name}' in services/ "
                            f"is banned — use utils/ or models/",
                        )
                    )
        return violations

    def _check_dataclass_rules(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        violations: list[Violation] = []
        for node in tree.body:
            if not isinstance(node, ast.ClassDef):
                continue
            if not self._is_dataclass(node):
                continue
            if not self._has_slots(node):
                violations.extend(
                    self._v(
                        file, node.lineno, "dataclass-no-slots",
                        f"Dataclass '{node.name}' must use slots=True",
                    )
                )
        return violations

    def _check_misplaced_dataclass(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer not in (Layer.SERVICES, Layer.CONTROLLERS, Layer.REPOSITORIES):
            return []

        violations: list[Violation] = []
        for node in tree.body:
            if not isinstance(node, ast.ClassDef):
                continue
            if not self._is_dataclass(node):
                continue
            method_count = sum(
                1 for n in node.body
                if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
            )
            if method_count == 0:
                violations.extend(
                    self._v(
                        file, node.lineno, "misplaced-dataclass",
                        f"Dataclass '{node.name}' with no methods in "
                        f"'{file.layer.value}/' is a misplaced model — move to models/",
                    )
                )
        return violations

    def _check_logger_level(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        violations: list[Violation] = []
        for node in tree.body:
            if not isinstance(node, ast.ClassDef):
                continue
            if not self._is_dataclass(node):
                continue
            for item in node.body:
                if isinstance(item, ast.AnnAssign):
                    if isinstance(item.target, ast.Name):
                        if item.target.id == "logger":
                            violations.extend(
                                self._v(
                                    file, item.lineno, "logger-dataclass-field",
                                    "logger must never be a dataclass field — "
                                    "use module-level",
                                )
                            )
        return violations

    def _check_app_error_rules(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        violations: list[Violation] = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Raise) and isinstance(node.exc, ast.Call):
                func = node.exc.func
                is_app_error = (
                    (isinstance(func, ast.Name) and func.id == "AppError")
                    or (isinstance(func, ast.Attribute) and func.attr == "AppError")
                )
                if is_app_error:
                    violations.extend(
                        self._v(
                            file, node.lineno, "app-error-direct-raise",
                            "AppError must never be raised directly — "
                            "use named subclasses only",
                        )
                    )
        for node in tree.body:
            if not isinstance(node, ast.ClassDef):
                continue
            if self._extends(node, "AppError"):
                for item in node.body:
                    if isinstance(item, ast.Assign):
                        for target in item.targets:
                            if isinstance(target, ast.Name):
                                name_lower = target.id.lower()
                                if "status" in name_lower or "http" in name_lower:
                                    violations.extend(
                                        self._v(
                                            file, item.lineno,
                                            "app-error-http-status",
                                            "AppError subclasses must not contain "
                                            "HTTP status codes",
                                        )
                                    )
        return violations

    def _check_match_case(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer == Layer.ERROR_HANDLERS:
            return []
        for node in ast.walk(tree):
            if isinstance(node, ast.Match):
                return self._v(
                    file, node.lineno, "match-case-location",
                    "match/case is only permitted in error_handlers.py",
                )
        return []

    def _check_try_except_routes(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer != Layer.ROUTES:
            return []
        for node in ast.walk(tree):
            if isinstance(node, ast.Try):
                return self._v(
                    file, node.lineno, "try-except-routes",
                    "try/except is banned inside route handlers",
                )
        return []

    def _check_app_factory(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer != Layer.FACTORY:
            return []

        violations: list[Violation] = []
        for node in tree.body:
            if isinstance(node, ast.ClassDef) and node.name in (
                "AppFactory",
                "CheckerFactory",
            ):
                for item in node.body:
                    if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        for dec in item.decorator_list:
                            if isinstance(dec, ast.Name) and dec.id == "staticmethod":
                                violations.extend(
                                    self._v(
                                        file, item.lineno,
                                        "factory-no-staticmethod",
                                        "AppFactory has no @staticmethod",
                                    )
                                )
                for child in ast.walk(node):
                    if isinstance(child, (ast.If, ast.For, ast.While, ast.Try)):
                        violations.extend(
                            self._v(
                                file, child.lineno, "factory-zero-logic",
                                "AppFactory must contain zero conditional logic",
                            )
                        )
        return violations

    def _check_orm_mapped(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer != Layer.REPOSITORIES:
            return []

        violations: list[Violation] = []
        for node in tree.body:
            if not isinstance(node, ast.ClassDef):
                continue
            for item in node.body:
                if isinstance(item, ast.Assign) and isinstance(
                    item.value, ast.Call
                ):
                    if isinstance(item.value.func, ast.Name):
                        if item.value.func.id == "Column":
                            violations.extend(
                                self._v(
                                    file, item.lineno, "bare-column-banned",
                                    f"ORM model '{node.name}' uses bare Column() — "
                                    f"use Mapped[T] instead",
                                )
                            )
        return violations

    def _check_service_protocols(
        self, project: ProjectInfo
    ) -> list[Violation]:
        violations: list[Violation] = []
        service_files = [
            f for f in project.files
            if f.layer == Layer.SERVICES and f.path.suffix == ".py"
        ]

        for svc_file in service_files:
            tree = svc_file.ast_tree
            if tree is None:
                continue

            concrete_classes = self._find_concrete_service_classes(tree)
            for cls_name in concrete_classes:
                protocol_name = f"I{cls_name}"
                if not self._protocol_exists(project, protocol_name):
                    violations.append(
                        Violation(
                            file=str(svc_file.path),
                            line=1,
                            severity=Severity.ERROR,
                            rule_id=f"{self.rule_id_prefix}:missing-protocol",
                            message=f"Service '{cls_name}' has no corresponding "
                            f"Protocol '{protocol_name}'",
                        )
                    )
                elif not self._protocol_has_runtime_checkable(
                    project, protocol_name
                ):
                    violations.append(
                        Violation(
                            file=str(svc_file.path),
                            line=1,
                            severity=Severity.ERROR,
                            rule_id=f"{self.rule_id_prefix}:protocol-not-runtime-checkable",
                            message=f"Protocol '{protocol_name}' must be decorated "
                            f"with @runtime_checkable",
                        )
                    )
        return violations

    def _is_dataclass(self, node: ast.ClassDef) -> bool:
        for dec in node.decorator_list:
            if isinstance(dec, ast.Name) and dec.id == "dataclass":
                return True
            if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Name):
                if dec.func.id == "dataclass":
                    return True
        return False

    def _has_slots(self, node: ast.ClassDef) -> bool:
        for dec in node.decorator_list:
            if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Name):
                if dec.func.id == "dataclass":
                    for kw in dec.keywords:
                        if kw.arg == "slots":
                            if isinstance(kw.value, ast.Constant):
                                return bool(kw.value.value)
                            return True
        return False

    def _extends(self, node: ast.ClassDef, base_name: str) -> bool:
        for base in node.bases:
            if isinstance(base, ast.Name) and base.id == base_name:
                return True
            if isinstance(base, ast.Attribute) and base.attr == base_name:
                return True
        return False

    def _find_containing_class(
        self,
        func_node: ast.FunctionDef | ast.AsyncFunctionDef,
        tree: ast.Module,
    ) -> ast.ClassDef | None:
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                for item in node.body:
                    if item is func_node:
                        return node
        return None

    def _find_concrete_service_classes(self, tree: ast.Module) -> list[str]:
        classes: list[str] = []
        for node in tree.body:
            if isinstance(node, ast.ClassDef):
                if node.name.startswith("I"):
                    continue
                if node.name.endswith("Error"):
                    continue
                if node.name.endswith("Protocol"):
                    continue
                classes.append(node.name)
        return classes

    def _protocol_exists(self, project: ProjectInfo, protocol_name: str) -> bool:
        for f in project.files:
            tree = f.ast_tree
            if tree is None:
                continue
            for node in tree.body:
                if isinstance(node, ast.ClassDef) and node.name == protocol_name:
                    return True
        return False

    def _protocol_has_runtime_checkable(
        self, project: ProjectInfo, protocol_name: str
    ) -> bool:
        for f in project.files:
            tree = f.ast_tree
            if tree is None:
                continue
            for node in tree.body:
                if isinstance(node, ast.ClassDef) and node.name == protocol_name:
                    for dec in node.decorator_list:
                        if isinstance(dec, ast.Name) and dec.id == "runtime_checkable":
                            return True
                    return False
        return False

    def _check_http_exception_location(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer == Layer.ERROR_HANDLERS:
            return []

        for node in tree.body:
            if isinstance(node, ast.ImportFrom):
                module = node.module or ""
                if module.startswith("fastapi") or module.startswith("starlette"):
                    for alias in node.names:
                        if alias.name == "HTTPException":
                            return self._v(
                                file, node.lineno, "http-exception-location",
                                "HTTPException must only appear in error_handlers.py",
                            )
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if "HTTPException" in alias.name:
                        return self._v(
                            file, node.lineno, "http-exception-location",
                            "HTTPException must only appear in error_handlers.py",
                        )
        return []

    def _check_concrete_service_import(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer == Layer.FACTORY:
            return []

        violations: list[Violation] = []
        for node in tree.body:
            if isinstance(node, ast.ImportFrom):
                module = node.module or ""
                if ".services." not in module and not module.endswith(".services"):
                    continue
                for alias in node.names:
                    name = alias.name
                    if (
                        name[0:1].isupper()
                        and not name.startswith("I")
                        and not name.endswith("Error")
                        and not name.endswith("Protocol")
                    ):
                        violations.extend(
                            self._v(
                                file, node.lineno,
                                "concrete-service-import",
                                f"Concrete service '{name}' must only be imported "
                                f"in factory.py — import the Protocol instead",
                            )
                        )
        return violations

    def _check_frozen_dataclass(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer != Layer.MODELS:
            return []

        violations: list[Violation] = []
        for node in tree.body:
            if not isinstance(node, ast.ClassDef):
                continue
            if not self._is_dataclass(node):
                continue
            if not self._has_frozen(node):
                violations.extend(
                    self._v(
                        file, node.lineno, "dataclass-no-frozen",
                        f"Dataclass '{node.name}' in models/ must use frozen=True",
                    )
                )
        return violations

    def _has_frozen(self, node: ast.ClassDef) -> bool:
        for dec in node.decorator_list:
            if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Name):
                if dec.func.id == "dataclass":
                    for kw in dec.keywords:
                        if kw.arg == "frozen":
                            if isinstance(kw.value, ast.Constant):
                                return bool(kw.value.value)
                            return True
        return False
