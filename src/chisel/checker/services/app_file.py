
import ast
from dataclasses import dataclass
from chisel.checker.services.protocols import RuleInfo
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

    def describe_rules(self) -> list[RuleInfo]:
        return [
            RuleInfo(id="app-file:app-loc-limit", category="app-file",
                     description="app.py exceeds 50 lines of code",
                     fix_guidance="app.py should contain only create_app() and the lifespan context. Move everything else into the appropriate layer."),
            RuleInfo(id="app-file:route-in-app", category="app-file",
                     description="Route definition inside app.py",
                     fix_guidance="app.py only creates the app and registers routers. Move this route into routes/ and register it via app.include_router()."),
            RuleInfo(id="app-file:app-complexity-limit", category="app-file",
                     description="app.py cyclomatic complexity exceeds 1",
                     fix_guidance="app.py should contain only create_app() and the lifespan context. Move everything else into the appropriate layer."),
        ]

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
                "app.py should contain only create_app() and the lifespan "
                "context. Move everything else into the appropriate layer.",
            )
        return []

    def _check_no_routes(self, file: FileInfo) -> list[Violation]:
        tree = file.ast_tree
        if tree is None:
            return []

        route_decorators = {"get", "post", "put", "delete", "patch", "route"}
        for node in ast.walk(tree):
            match node:
                case ast.FunctionDef() | ast.AsyncFunctionDef():
                    for dec in node.decorator_list:
                        match dec:
                            case ast.Attribute(attr=attr) if attr in route_decorators:
                                return self._v(
                                    file, node.lineno, "route-in-app",
                                    "app.py only creates the app and registers routers. "
                                    "Move this route into routes/ and register it "
                                    "via app.include_router().",
                                )
                            case ast.Call(func=ast.Attribute(attr=attr)) if attr in route_decorators:
                                return self._v(
                                    file, node.lineno, "route-in-app",
                                    "app.py only creates the app and registers routers. "
                                    "Move this route into routes/ and register it "
                                    "via app.include_router().",
                                )
                            case _:
                                pass
                case _:
                    pass
        return []

    def _check_complexity(self, file: FileInfo) -> list[Violation]:
        tree = file.ast_tree
        if tree is None:
            return []

        cc = self._file_complexity(tree)
        if cc > 1:
            return self._v(
                file, 1, "app-complexity-limit",
                "app.py should contain only create_app() and the lifespan "
                "context. Move everything else into the appropriate layer.",
            )
        return []

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
