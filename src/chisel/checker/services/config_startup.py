
import ast
from dataclasses import dataclass

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation


@dataclass(slots=True)
class ConfigStartupService:
    rule_id_prefix: str = "config-startup"

    def check(self, project: ProjectInfo) -> list[Violation]:
        violations: list[Violation] = []
        for file in project.files:
            if file.ast_tree is None:
                continue
            violations.extend(self._check_getenv_location(file))
        return violations

    def _check_getenv_location(self, file: FileInfo) -> list[Violation]:
        tree = file.ast_tree
        if tree is None:
            return []

        if file.layer == Layer.CONFIG:
            return []

        for node in ast.walk(tree):
            match node:
                case ast.Call(func=ast.Attribute(
                    value=ast.Name(id="os"), attr="getenv"
                )):
                    return self._v(
                        file, node.lineno, "getenv-outside-config",
                        "os.getenv() must only be called in config.py",
                    )
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
