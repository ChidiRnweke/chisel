
import ast
from dataclasses import dataclass

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation


@dataclass(slots=True)
class SessionService:
    rule_id_prefix: str = "session"

    def check(self, project: ProjectInfo) -> list[Violation]:
        violations: list[Violation] = []
        for file in project.files:
            if file.ast_tree is None:
                continue
            violations.extend(self._check_execute_location(file))
        return violations

    def _check_execute_location(self, file: FileInfo) -> list[Violation]:
        tree = file.ast_tree
        if tree is None:
            return []

        if file.layer == Layer.REPOSITORIES:
            return []

        for node in ast.walk(tree):
            match node:
                case ast.Call(
                    func=ast.Attribute(attr="execute", value=value)
                ):
                    if self._is_session_receiver(value):
                        return self._v(
                            file, node.lineno, "session-execute-location",
                            "session.execute() must only be called inside repositories/",
                        )
                case _:
                    pass
        return []

    def _is_session_receiver(self, node: ast.expr) -> bool:
        match node:
            case ast.Name():
                return "session" in node.id.lower()
            case ast.Attribute():
                return "session" in node.attr.lower()
            case _:
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
