from __future__ import annotations

import ast
from dataclasses import dataclass

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation


@dataclass(slots=True)
class ConcurrencyService:
    rule_id_prefix: str = "concurrency"

    def check(self, project: ProjectInfo) -> list[Violation]:
        violations: list[Violation] = []
        for file in project.files:
            if file.ast_tree is None:
                continue
            violations.extend(self._check_file(file))
        return violations

    def _check_file(self, file: FileInfo) -> list[Violation]:
        tree = file.ast_tree
        if tree is None:
            return []

        has_gather_import = self._has_gather_import(tree)

        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Attribute):
                    if isinstance(node.func.value, ast.Name):
                        if (
                            node.func.value.id == "asyncio"
                            and node.func.attr == "gather"
                        ):
                            return self._v(
                                file, node.lineno, "asyncio-gather-banned",
                                "asyncio.gather is banned — use asyncio.TaskGroup only",
                            )
                elif isinstance(node.func, ast.Name):
                    if node.func.id == "gather" and has_gather_import:
                        return self._v(
                            file, node.lineno, "asyncio-gather-banned",
                            "asyncio.gather is banned — use asyncio.TaskGroup only",
                        )
        return []

    def _has_gather_import(self, tree: ast.Module) -> bool:
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module == "asyncio":
                if any(alias.name == "gather" for alias in node.names):
                    return True
        return False

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
