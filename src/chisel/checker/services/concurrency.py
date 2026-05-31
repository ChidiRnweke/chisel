
import ast
from dataclasses import dataclass

from chisel.checker.services.protocols import RuleInfo

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation


@dataclass(slots=True)
class ConcurrencyService:
    rule_id_prefix: str = "concurrency"

    def describe_rules(self) -> list[RuleInfo]:
        return [
            RuleInfo(id="concurrency:asyncio-gather-banned", category="concurrency",
                     description="asyncio.gather() used",
                     fix_guidance="Replace with asyncio.TaskGroup. TaskGroup cancels sibling tasks on failure and propagates exceptions cleanly."),
        ]

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
            match node:
                case ast.Call(func=ast.Attribute(
                    value=ast.Name(id="asyncio"), attr="gather"
                )):
                    return self._v(
                        file, node.lineno, "asyncio-gather-banned",
                        "Replace with asyncio.TaskGroup. TaskGroup cancels "
                        "sibling tasks on failure and propagates exceptions cleanly.",
                    )
                case ast.Call(func=ast.Name(id="gather")) if has_gather_import:
                    return self._v(
                        file, node.lineno, "asyncio-gather-banned",
                        "Replace with asyncio.TaskGroup. TaskGroup cancels "
                        "sibling tasks on failure and propagates exceptions cleanly.",
                    )
                case _:
                    pass
        return []

    def _has_gather_import(self, tree: ast.Module) -> bool:
        for node in ast.walk(tree):
            match node:
                case ast.ImportFrom(module="asyncio"):
                    if any(alias.name == "gather" for alias in node.names):
                        return True
                case _:
                    pass
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
