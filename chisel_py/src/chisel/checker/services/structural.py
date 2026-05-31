
import ast
from dataclasses import dataclass

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.services.protocols import RuleInfo
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
        violations.extend(self._check_all_imports_at_top(file, tree))
        violations.extend(self._check_getattr_setattr(file, tree))
        violations.extend(self._check_isinstance_ban(file, tree))
        violations.extend(self._check_class_attribute(file, tree))
        violations.extend(self._check_percent_format(file, tree))
        violations.extend(self._check_logger_fstring(file, tree))
        violations.extend(self._check_print(file, tree))
        violations.extend(self._check_non_dataclass_in_layer(file, tree))
        violations.extend(self._check_dataclass_rules(file, tree))
        violations.extend(self._check_misplaced_dataclass(file, tree))
        violations.extend(self._check_logger_level(file, tree))
        violations.extend(self._check_app_error_rules(file, tree))
        violations.extend(self._check_try_except_routes(file, tree))
        violations.extend(self._check_app_factory(file, tree))
        violations.extend(self._check_orm_mapped(file, tree))
        violations.extend(self._check_http_exception_location(file, tree))
        violations.extend(self._check_concrete_service_import(file, tree))
        return violations

    def describe_rules(self) -> list[RuleInfo]:
        return [
            RuleInfo(id="structural:import-not-at-top", category="structural",
                     description="All imports must be at the top of the file",
                     fix_guidance="Use the module-level structlog logger instead. print() has no log level and doesn't appear in your observability stack."),
            RuleInfo(id="structural:import-not-at-top-nested", category="structural",
                     description="Import statements inside functions, methods, or blocks",
                     fix_guidance="Import statements inside functions, methods, or blocks are banned — move them to the top of the file."),
            RuleInfo(id="structural:getattr-setattr-banned", category="structural",
                     description="getattr() or setattr() used in application code",
                     fix_guidance="Add the attribute to the Protocol interface or use an explicit typed constructor. Dynamic attribute access erases the type system."),
            RuleInfo(id="structural:isinstance-banned", category="structural",
                     description="isinstance() used in application code",
                     fix_guidance="Use match/case for type-based branching. In error handlers the match exc: pattern already handles it. Elsewhere, isinstance checks usually mean logic that belongs on the domain object itself."),
            RuleInfo(id="structural:class-attribute-banned", category="structural",
                     description="__class__ attribute access in application code",
                     fix_guidance="Metaprogramming via __class__ is banned. Use match/case for type-based branching instead."),
            RuleInfo(id="structural:percent-interpolation-banned", category="structural",
                     description="Percent (%) string interpolation used",
                     fix_guidance="Use f-strings for application strings. For logger calls use structured keyword arguments: logger.info('message', key=value)."),
            RuleInfo(id="structural:logger-fstring", category="structural",
                     description="f-string passed to a logger call",
                     fix_guidance="Pass context as keyword arguments, not interpolated strings. Replace logger.info(f'Created {x}') with logger.info('Created item', id=x)."),
            RuleInfo(id="structural:print-banned", category="structural",
                     description="print() called in src/",
                     fix_guidance="Use the module-level structlog logger instead. print() has no log level and doesn't appear in your observability stack."),
            RuleInfo(id="structural:non-dataclass-in-layer", category="structural",
                     description="Class in services/, controllers/, or repositories/ is not a @dataclass",
                     fix_guidance="Add @dataclass(slots=True) and declare dependencies as typed fields. This makes dependencies explicit and injectable."),
            RuleInfo(id="structural:dataclass-no-slots", category="structural",
                     description="@dataclass without slots=True",
                     fix_guidance="Dataclasses must use slots=True for performance and memory efficiency."),
            RuleInfo(id="structural:misplaced-dataclass", category="structural",
                     description="@dataclass with zero methods in services/, controllers/, or repositories/",
                     fix_guidance="This is a model, not a service/controller/repository. Move it to models/."),
            RuleInfo(id="structural:logger-dataclass-field", category="structural",
                     description="logger defined as a dataclass field",
                     fix_guidance="The logger is a module-level constant, not a dependency. Move it outside the class: logger = structlog.getLogger(__name__)."),
            RuleInfo(id="structural:app-error-direct-raise", category="structural",
                     description="AppError raised directly",
                     fix_guidance="Raise a named subclass instead: raise NotFoundError(...). Define new errors in errors.py if needed."),
            RuleInfo(id="structural:app-error-http-status", category="structural",
                     description="HTTP status code in a domain error class",
                     fix_guidance="Remove the status code from the error class. The mapping from domain error to HTTP status lives exclusively in error_handlers.py."),
            RuleInfo(id="structural:try-except-routes", category="structural",
                     description="try/except inside a route handler",
                     fix_guidance="Route handlers don't catch exceptions — error_handlers.py does. Remove the try/except and let the exception propagate."),
            RuleInfo(id="structural:factory-no-staticmethod", category="structural",
                     description="@staticmethod on AppFactory or CheckerFactory",
                     fix_guidance="The factory is instantiated per-request and carries session and user context. Make it a regular instance method."),
            RuleInfo(id="structural:factory-zero-logic", category="structural",
                     description="Conditional logic in AppFactory or CheckerFactory",
                     fix_guidance="The factory wires dependencies and makes no decisions. Move the conditional logic into a service method."),
            RuleInfo(id="structural:bare-column-banned", category="structural",
                     description="Bare Column() used instead of Mapped[T] in ORM models",
                     fix_guidance="Use Mapped[T] for ORM column types instead of bare Column()."),
            RuleInfo(id="structural:missing-protocol", category="structural",
                     description="Service implementation has no corresponding Protocol",
                     fix_guidance="Define an IYourService Protocol in the same file. Controllers and the factory depend on the interface, not the concrete class."),
            RuleInfo(id="structural:http-exception-location", category="structural",
                     description="HTTPException imported outside error_handlers.py",
                     fix_guidance="HTTPExceptions must only appear in error_handlers.py. Raise a domain error from errors.py instead and map it to HTTP status in the error handler."),
            RuleInfo(id="structural:concrete-service-import", category="structural",
                     description="Concrete service class imported outside factory.py",
                     fix_guidance="Only the factory assembles concrete implementations. Import the Protocol interface everywhere else."),
        ]

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
            match node:
                case ast.Import() | ast.ImportFrom():
                    if import_finished:
                        violations.extend(
                            self._v(
                                file, node.lineno, "import-not-at-top",
                                "All imports must be at the top of the file (E402)",
                            )
                        )
                case ast.Expr(value=ast.Constant()):
                    pass
                case ast.ImportFrom(module=None):
                    pass
                case ast.Try() if self._is_import_error_try(node):
                    pass
                case _:
                    import_finished = True
        return violations

    def _find_nested_imports(
        self, file: FileInfo, node: ast.stmt
    ) -> list[Violation]:
        match node:
            case ast.FunctionDef() | ast.AsyncFunctionDef() | ast.ClassDef() | ast.If() | ast.For() | ast.While() | ast.With() | ast.Try():
                pass
            case _:
                return []

        bodies: list[tuple[list[ast.stmt], bool]] = []

        match node:
            case ast.FunctionDef() | ast.AsyncFunctionDef() | ast.ClassDef():
                bodies.append((node.body, False))
            case ast.If():
                guarded = self._is_type_checking_guard(node)
                bodies.append((node.body, guarded))
                bodies.append((node.orelse, False))
            case ast.Try():
                import_guard = self._is_import_error_try(node)
                bodies.append((node.body, import_guard))
                for handler in node.handlers:
                    bodies.append((handler.body, import_guard))
                if node.orelse:
                    bodies.append((node.orelse, False))
                if node.finalbody:
                    bodies.append((node.finalbody, False))
            case ast.For() | ast.While():
                bodies.append((node.body, False))
                if node.orelse:
                    bodies.append((node.orelse, False))
            case ast.With():
                bodies.append((node.body, False))

        violations: list[Violation] = []
        for body, type_checking in bodies:
            for child in body:
                match child:
                    case ast.Import() | ast.ImportFrom():
                        if not type_checking:
                            violations.extend(
                                self._v(
                                    file, child.lineno,
                                    "import-not-at-top-nested",
                                    "Import statements inside functions, methods, "
                                    "or blocks are banned — move them to the top of the file.",
                                )
                            )
                match child:
                    case ast.FunctionDef() | ast.AsyncFunctionDef() | ast.ClassDef() | ast.If() | ast.For() | ast.While() | ast.With() | ast.Try():
                        violations.extend(
                            self._find_nested_imports(file, child)
                        )
        return violations

    def _is_type_checking_guard(self, node: ast.If) -> bool:
        test = node.test
        match test:
            case ast.Name(id="TYPE_CHECKING"):
                return True
            case ast.Attribute(attr="TYPE_CHECKING"):
                return True
            case _:
                return False

    def _is_import_error_try(self, node: ast.Try) -> bool:
        for handler in node.handlers:
            if handler.type is None:
                continue
            match handler.type:
                case ast.Name(id="ImportError") | ast.Name(id="ModuleNotFoundError"):
                    return True
        return False

    def _check_getattr_setattr(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        violations: list[Violation] = []
        for node in ast.walk(tree):
            match node:
                case ast.Call(func=ast.Name(id=name)) if name in ("getattr", "setattr"):
                    violations.extend(
                        self._v(
                            file, node.lineno, "getattr-setattr-banned",
                            "Add the attribute to the Protocol interface or use an explicit typed constructor. "
                            "Dynamic attribute access erases the type system.",
                        )
                    )
        return violations

    def _check_percent_format(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        violations: list[Violation] = []
        for node in ast.walk(tree):
            match node:
                case ast.BinOp(op=ast.Mod(), left=ast.Constant(value=str())):
                    violations.extend(
                        self._v(
                            file, node.lineno, "percent-interpolation-banned",
                            "Use f-strings for application strings. "
                            "For logger calls use structured keyword arguments: "
                            "logger.info('message', key=value).",
                        )
                    )
        return violations

    def _check_logger_fstring(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        violations: list[Violation] = []
        for node in ast.walk(tree):
            match node:
                case ast.Call(func=ast.Attribute(value=ast.Name(id="logger"))):
                    if node.args:
                        match node.args[0]:
                            case ast.JoinedStr():
                                violations.extend(
                                    self._v(
                                        file, node.lineno, "logger-fstring",
                                        "Pass context as keyword arguments, not interpolated strings. "
                                        "Replace logger.info(f'Created {x}') with "
                                        "logger.info('Created item', id=x).",
                                    )
                                )
        return violations

    def _check_print(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        for node in ast.walk(tree):
            match node:
                case ast.Call(func=ast.Name(id="print")):
                    return self._v(
                        file, node.lineno, "print-banned",
                        "Use the module-level structlog logger instead. "
                        "print() has no log level and doesn't appear in your observability stack.",
                    )
        return []

    def _check_isinstance_ban(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer == Layer.TESTS:
            return []
        for node in ast.walk(tree):
            match node:
                case ast.Call(func=ast.Name(id="isinstance")):
                    return self._v(
                        file, node.lineno, "isinstance-banned",
                        "Use match/case for type-based branching. "
                        "In error handlers the match exc: pattern already handles it. "
                        "Elsewhere, isinstance checks usually mean logic that belongs "
                        "on the domain object itself.",
                    )
        return []

    def _check_class_attribute(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer == Layer.TESTS:
            return []
        for node in ast.walk(tree):
            match node:
                case ast.Attribute(attr="__class__"):
                    return self._v(
                        file, node.lineno, "class-attribute-banned",
                        "Metaprogramming via __class__ is banned. "
                        "Use match/case for type-based branching instead.",
                    )
        return []

    def _check_non_dataclass_in_layer(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer not in (Layer.SERVICES, Layer.CONTROLLERS, Layer.REPOSITORIES):
            return []

        violations: list[Violation] = []
        for node in tree.body:
            match node:
                case ast.ClassDef():
                    pass
                case _:
                    continue
            if node.name.endswith("Error"):
                continue
            if node.name.endswith("Protocol"):
                continue
            if node.name.startswith("I"):
                continue
            if self._is_dataclass(node):
                continue
            violations.extend(
                self._v(
                    file, node.lineno, "non-dataclass-in-layer",
                    "Add @dataclass(slots=True) and declare dependencies as typed fields. "
                    "This makes dependencies explicit and injectable.",
                )
            )
        return violations

    def _check_dataclass_rules(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        violations: list[Violation] = []
        for node in tree.body:
            match node:
                case ast.ClassDef():
                    pass
                case _:
                    continue
            if not self._is_dataclass(node):
                continue
            if not self._has_slots(node):
                violations.extend(
                    self._v(
                        file, node.lineno, "dataclass-no-slots",
                        "Dataclasses must use slots=True for performance and memory efficiency.",
                    )
                )
        return violations

    def _check_misplaced_dataclass(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer not in (Layer.SERVICES, Layer.CONTROLLERS, Layer.REPOSITORIES):
            return []
        if file.path.name == "protocols.py":
            return []

        violations: list[Violation] = []
        for node in tree.body:
            match node:
                case ast.ClassDef():
                    pass
                case _:
                    continue
            if not self._is_dataclass(node):
                continue
            method_count = 0
            for n in node.body:
                match n:
                    case ast.FunctionDef() | ast.AsyncFunctionDef():
                        method_count += 1
            if method_count == 0:
                violations.extend(
                    self._v(
                        file, node.lineno, "misplaced-dataclass",
                        "This is a model, not a service/controller/repository. "
                        "Move it to models/.",
                    )
                )
        return violations

    def _check_logger_level(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        violations: list[Violation] = []
        for node in tree.body:
            match node:
                case ast.ClassDef():
                    pass
                case _:
                    continue
            if not self._is_dataclass(node):
                continue
            for item in node.body:
                match item:
                    case ast.AnnAssign(target=ast.Name(id="logger")):
                        violations.extend(
                            self._v(
                                file, item.lineno, "logger-dataclass-field",
                                "The logger is a module-level constant, not a dependency. "
                                "Move it outside the class: "
                                "logger = structlog.getLogger(__name__).",
                            )
                        )
        return violations

    def _check_app_error_rules(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        violations: list[Violation] = []
        for node in ast.walk(tree):
            match node:
                case ast.Raise(exc=ast.Call(func=func)):
                    match func:
                        case ast.Name(id="AppError") | ast.Attribute(attr="AppError"):
                            violations.extend(
                                self._v(
                                    file, node.lineno, "app-error-direct-raise",
                                    "Raise a named subclass instead: "
                                    "raise NotFoundError(...). Define new errors in errors.py if needed.",
                                )
                            )
        for node in tree.body:
            match node:
                case ast.ClassDef():
                    pass
                case _:
                    continue
            if self._extends(node, "AppError"):
                for item in node.body:
                    match item:
                        case ast.Assign():
                            for target in item.targets:
                                match target:
                                    case ast.Name():
                                        name_lower = target.id.lower()
                                        if "status" in name_lower or "http" in name_lower:
                                            violations.extend(
                                                self._v(
                                                    file, item.lineno,
                                                    "app-error-http-status",
                                                    "Remove the status code from the error class. "
                                                    "The mapping from domain error to HTTP status "
                                                    "lives exclusively in error_handlers.py.",
                                                )
                                            )
        return violations

    def _check_try_except_routes(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer != Layer.ROUTES:
            return []
        for node in ast.walk(tree):
            match node:
                case ast.Try():
                    return self._v(
                        file, node.lineno, "try-except-routes",
                        "Route handlers don't catch exceptions — error_handlers.py does. "
                        "Remove the try/except and let the exception propagate.",
                    )
        return []

    def _check_app_factory(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer != Layer.FACTORY:
            return []

        violations: list[Violation] = []
        for node in tree.body:
            match node:
                case ast.ClassDef(name=name) if name in (
                    "AppFactory",
                    "CheckerFactory",
                ):
                    for item in node.body:
                        match item:
                            case ast.FunctionDef() | ast.AsyncFunctionDef():
                                for dec in item.decorator_list:
                                    match dec:
                                        case ast.Name(id="staticmethod"):
                                            violations.extend(
                                                self._v(
                                                    file, item.lineno,
                                                    "factory-no-staticmethod",
                                                    "The factory is instantiated per-request and carries "
                                                    "session and user context. Make it a regular instance method.",
                                                )
                                            )
                    for child in ast.walk(node):
                        match child:
                            case ast.If() | ast.For() | ast.While() | ast.Try():
                                violations.extend(
                                    self._v(
                                        file, child.lineno, "factory-zero-logic",
                                        "The factory wires dependencies and makes no decisions. "
                                        "Move the conditional logic into a service method.",
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
                            message="Define an IYourService Protocol in the same file. "
                            "Controllers and the factory depend on the interface, "
                            "not the concrete class.",
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
            match node:
                case ast.ClassDef():
                    pass
                case _:
                    continue
            for item in node.body:
                match item:
                    case ast.Assign(value=ast.Call(func=ast.Name(id="Column"))):
                        violations.extend(
                            self._v(
                                file, item.lineno, "bare-column-banned",
                                "Use Mapped[T] for ORM column types instead of bare Column().",
                            )
                        )
        return violations

    def _is_dataclass(self, node: ast.ClassDef) -> bool:
        for dec in node.decorator_list:
            match dec:
                case ast.Name(id="dataclass"):
                    return True
                case ast.Call(func=ast.Name(id="dataclass")):
                    return True
        return False

    def _has_slots(self, node: ast.ClassDef) -> bool:
        for dec in node.decorator_list:
            match dec:
                case ast.Call(func=ast.Name(id="dataclass")):
                    for kw in dec.keywords:
                        if kw.arg == "slots":
                            match kw.value:
                                case ast.Constant():
                                    return bool(kw.value.value)
                            return True
        return False

    def _extends(self, node: ast.ClassDef, base_name: str) -> bool:
        for base in node.bases:
            match base:
                case ast.Name(id=name) if name == base_name:
                    return True
                case ast.Attribute(attr=name) if name == base_name:
                    return True
        return False

    def _find_containing_class(
        self,
        func_node: ast.FunctionDef | ast.AsyncFunctionDef,
        tree: ast.Module,
    ) -> ast.ClassDef | None:
        for node in tree.body:
            match node:
                case ast.ClassDef():
                    for item in node.body:
                        if item is func_node:
                            return node
        return None

    def _find_concrete_service_classes(self, tree: ast.Module) -> list[str]:
        classes: list[str] = []
        for node in tree.body:
            match node:
                case ast.ClassDef():
                    if node.name.startswith("I"):
                        continue
                    if node.name.endswith("Error"):
                        continue
                    if node.name.endswith("Protocol"):
                        continue
                    if self._is_dataclass(node):
                        method_count = 0
                        for n in node.body:
                            match n:
                                case ast.FunctionDef() | ast.AsyncFunctionDef():
                                    method_count += 1
                        if method_count == 0:
                            continue
                    classes.append(node.name)
        return classes

    def _protocol_exists(self, project: ProjectInfo, protocol_name: str) -> bool:
        for f in project.files:
            tree = f.ast_tree
            if tree is None:
                continue
            for node in tree.body:
                match node:
                    case ast.ClassDef(name=name) if name == protocol_name:
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
                match node:
                    case ast.ClassDef(name=name) if name == protocol_name:
                        for dec in node.decorator_list:
                            match dec:
                                case ast.Name(id="runtime_checkable"):
                                    return True
                        return False
        return False

    def _check_http_exception_location(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer == Layer.ERROR_HANDLERS:
            return []

        for node in tree.body:
            match node:
                case ast.ImportFrom():
                    module = node.module or ""
                    if module.startswith("fastapi") or module.startswith("starlette"):
                        for alias in node.names:
                            if alias.name == "HTTPException":
                                return self._v(
                                    file, node.lineno, "http-exception-location",
                                    "HTTPExceptions must only appear in error_handlers.py. "
                                    "Raise a domain error from errors.py instead and map it "
                                    "to HTTP status in the error handler.",
                                )
                case ast.Import():
                    for alias in node.names:
                        if "HTTPException" in alias.name:
                            return self._v(
                                file, node.lineno, "http-exception-location",
                                "HTTPExceptions must only appear in error_handlers.py. "
                                "Raise a domain error from errors.py instead and map it "
                                "to HTTP status in the error handler.",
                            )
        return []

    def _check_concrete_service_import(
        self, file: FileInfo, tree: ast.Module
    ) -> list[Violation]:
        if file.layer == Layer.FACTORY:
            return []
        if file.layer == Layer.TESTS:
            return []

        violations: list[Violation] = []
        for node in tree.body:
            match node:
                case ast.ImportFrom():
                    module = node.module or ""
                    if ".services." not in module and not module.endswith(".services"):
                        continue
                    if ".protocols" in module:
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
                                    "Only the factory assembles concrete implementations. "
                                    "Import the Protocol interface everywhere else.",
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
            match node:
                case ast.ClassDef():
                    pass
                case _:
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
            match dec:
                case ast.Call(func=ast.Name(id="dataclass")):
                    for kw in dec.keywords:
                        if kw.arg == "frozen":
                            match kw.value:
                                case ast.Constant():
                                    return bool(kw.value.value)
                            return True
        return False
