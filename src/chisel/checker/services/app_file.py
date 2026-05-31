from __future__ import annotations

import ast
from dataclasses import dataclass

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation

_APP_MAX_LOC = 50


@dataclass(slots=True)
class AppFileService:
    rule_id_prefix: str = "app-file"

    def check(self, project: ProjectInfo) -> list[Violation]:
        violations: list[Violation] = []
        for file in project.files:
            if file.layer != Layer.APP_FILE:
                continue
            violations.extend(self._check_file(file))
        return violations

    def _check_file(self, file: FileInfo) -> list[Violation]:
        violations: list[Violation] = []
        violations.extend(self._check_loc(file))
        violations.extend(self._check_no_routes(file))
        violations.extend(self._check_complexity(file))
        return violations

    def _check_loc(self, file: FileInfo) -> list[Violation]:
        lines = file.source.split("\n")
        loc = len([l for l in lines if l.strip() and not l.strip().startswith("#")])
        if loc > _APP_MAX_LOC:
            return self._v(
                file, 1, "app-loc-limit",
                f"app.py must be ≤ {_APP_MAX_LOC} lines of code (found {loc})",
            )
        return []

    def _check_no_routes(self, file: FileInfo) -> list[Violation]:
        tree = file.ast_tree
        if tree is None:
            return []

        route_decorators = {"get", "post", "put", "delete", "patch", "route"}
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                for dec in node.decorator_list:
                    if isinstance(dec, ast.Attribute) and dec.attr in route_decorators:
                        return self._v(
                            file, node.lineno, "route-in-app",
                            "Route definitions are banned in app.py",
                        )
                    if isinstance(dec, ast.Call) and isinstance(dec.func, ast.Attribute):
                        if dec.func.attr in route_decorators:
                            return self._v(
                                file, node.lineno, "route-in-app",
                                "Route definitions are banned in app.py",
                            )
        return []

    def _check_complexity(self, file: FileInfo) -> list[Violation]:
        tree = file.ast_tree
        if tree is None:
            return []

        cc = self._file_complexity(tree)
        if cc > 1:
            return self._v(
                file, 1, "app-complexity-limit",
                f"app.py cyclomatic complexity must be 1 (found {cc})",
            )
        return []

    def _file_complexity(self, tree: ast.Module) -> int:
        complexity = 1
        for node in ast.walk(tree):
            if isinstance(node, (ast.If, ast.For, ast.While, ast.ExceptHandler)):
                complexity += 1
            elif isinstance(node, ast.BoolOp):
                complexity += len(node.values) - 1
        return complexity

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
