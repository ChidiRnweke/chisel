
import ast
from dataclasses import dataclass

from chisel.checker.services.protocols import RuleInfo

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation


@dataclass(slots=True)
class ErrorFlowService:
    rule_id_prefix: str = "error-flow"

    def describe_rules(self) -> list[RuleInfo]:
        return [
            RuleInfo(id="error-flow:http-in-error", category="error-flow",
                     description="HTTP status code in a domain error class",
                     fix_guidance="Remove the status code from the error class. The mapping from domain error to HTTP status lives exclusively in error_handlers.py."),
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

        if file.layer == Layer.ERROR_HANDLERS:
            return []

        return self._check_http_in_error(file, tree)

    @staticmethod
    def _is_error_base(base: ast.expr) -> bool:
        match base:
            case ast.Name():
                return "Error" in base.id
            case _:
                return False

    def _check_http_in_error(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        for node in tree.body:
            match node:
                case ast.ClassDef():
                    has_error_base = any(
                        self._is_error_base(base) for base in node.bases
                    )
                    if not has_error_base:
                        continue
                    for item in node.body:
                        match item:
                            case ast.Assign():
                                for target in item.targets:
                                    match target:
                                        case ast.Name():
                                            name_lower = target.id.lower()
                                            if "status" in name_lower or "http" in name_lower:
                                                return self._v(
                                                    file, item.lineno, "http-in-error",
                                                    "Remove the status code from the error class. "
                                                    "The mapping from domain error to HTTP status "
                                                    "lives exclusively in error_handlers.py.",
                                                )
                                        case _:
                                            pass
                            case _:
                                pass
                case _:
                    pass
        return []

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
