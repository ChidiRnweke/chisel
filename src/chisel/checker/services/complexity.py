
import ast
from dataclasses import dataclass

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation

_CONTROLLER_MAX_LOC = 30
_CONTROLLER_MAX_COMPLEXITY = 3
_ROUTE_MAX_LOC = 20


@dataclass(slots=True)
class ComplexityService:
    rule_id_prefix: str = "complexity"

    def check(self, project: ProjectInfo) -> list[Violation]:
        violations: list[Violation] = []
        for file in project.files:
            if file.source == "" or file.ast_tree is None:
                continue
            violations.extend(self._check_file(file))
        return violations

    def _check_file(self, file: FileInfo) -> list[Violation]:
        violations: list[Violation] = []
        violations.extend(self._check_loc(file))
        violations.extend(self._check_method_complexity(file))
        violations.extend(self._check_factory_complexity(file))
        return violations

    def _check_loc(self, file: FileInfo) -> list[Violation]:
        if file.layer == Layer.ROUTES:
            violations: list[Violation] = []
            tree = file.ast_tree
            if tree is None:
                return violations
            for node in tree.body:
                match node:
                    case ast.FunctionDef() | ast.AsyncFunctionDef():
                        end = node.end_lineno or node.lineno
                        func_loc = end - node.lineno + 1
                        if func_loc > _ROUTE_MAX_LOC:
                            violations.extend(
                                self._v(
                                    file, node.lineno, "route-loc-limit",
                                    f"Route endpoint '{node.name}' must be "
                                    f"≤ {_ROUTE_MAX_LOC} lines of code "
                                    f"(found {func_loc})",
                                    severity=Severity.WARNING,
                                )
                            )
                    case _:
                        pass
            return violations

        if file.layer == Layer.CONTROLLERS:
            violations: list[Violation] = []
            tree = file.ast_tree
            if tree is None:
                return violations
            for node in tree.body:
                match node:
                    case ast.ClassDef():
                        for item in node.body:
                            match item:
                                case ast.FunctionDef() | ast.AsyncFunctionDef():
                                    end = item.end_lineno or item.lineno
                                    func_loc = end - item.lineno + 1
                                    if func_loc > _CONTROLLER_MAX_LOC:
                                        violations.extend(
                                            self._v(
                                                file, item.lineno, "controller-loc-limit",
                                                f"Controller method '{node.name}."
                                                f"{item.name}' must be "
                                                f"≤ {_CONTROLLER_MAX_LOC} lines of code "
                                                f"(found {func_loc})",
                                                severity=Severity.WARNING,
                                            )
                                        )
                                case _:
                                    pass
                    case _:
                        pass
            return violations

        return []

    def _check_method_complexity(self, file: FileInfo) -> list[Violation]:
        if file.layer != Layer.CONTROLLERS:
            return []

        violations: list[Violation] = []
        tree = file.ast_tree
        if tree is None:
            return violations

        for node in tree.body:
            match node:
                case ast.ClassDef():
                    for item in node.body:
                        match item:
                            case ast.FunctionDef() | ast.AsyncFunctionDef():
                                cc = self._cyclomatic_complexity(item)
                                if cc > _CONTROLLER_MAX_COMPLEXITY:
                                    violations.extend(
                                        self._v(
                                            file, item.lineno,
                                            "controller-complexity-limit",
                                            f"Controller method '{node.name}."
                                            f"{item.name}' has cyclomatic complexity "
                                            f"{cc} (max {_CONTROLLER_MAX_COMPLEXITY})",
                                        )
                                    )
                            case _:
                                pass
                case _:
                    pass
        return violations

    def _check_factory_complexity(self, file: FileInfo) -> list[Violation]:
        if file.layer != Layer.FACTORY:
            return []

        tree = file.ast_tree
        if tree is None:
            return []

        cc = self._file_complexity(tree)
        if cc > 1:
            return self._v(
                file, 1, "factory-complexity-limit",
                f"Factory cyclomatic complexity must be 1 (found {cc})",
            )
        return []

    def _cyclomatic_complexity(
        self, node: ast.FunctionDef | ast.AsyncFunctionDef
    ) -> int:
        complexity = 1
        for child in ast.walk(node):
            match child:
                case ast.If() | ast.For() | ast.While() | ast.ExceptHandler():
                    complexity += 1
                case ast.BoolOp(values=values):
                    complexity += len(values) - 1
                case _:
                    pass
        return complexity

    def _file_complexity(self, tree: ast.Module) -> int:
        complexity = 1
        for node in ast.walk(tree):
            match node:
                case ast.If() | ast.For() | ast.While() | ast.ExceptHandler():
                    complexity += 1
                case ast.BoolOp(values=values):
                    complexity += len(values) - 1
                case _:
                    pass
        return complexity

    def _v(
        self,
        file: FileInfo,
        line: int,
        rule_suffix: str,
        message: str,
        severity: Severity = Severity.ERROR,
    ) -> list[Violation]:
        return [
            Violation(
                file=str(file.path),
                line=line,
                severity=severity,
                rule_id=f"{self.rule_id_prefix}:{rule_suffix}",
                message=message,
            )
        ]
