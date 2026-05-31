
from dataclasses import dataclass

from chisel.checker.models.import_edge import ImportEdge
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation
from chisel.checker.repositories.protocols import IImportGraph

_BANNED_INTERNAL_LAYERS: dict[Layer, set[Layer] | None] = {
    Layer.MODELS: None,
    Layer.ERRORS: None,
    Layer.CONFIG: None,
    Layer.SERVICES: {
        Layer.SERVICES,
        Layer.CONTROLLERS,
        Layer.FACTORY,
        Layer.CONFIG,
        Layer.ROUTES,
        Layer.DEPENDENCIES,
        Layer.ERROR_HANDLERS,
    },
    Layer.REPOSITORIES: {
        Layer.SERVICES,
        Layer.CONTROLLERS,
        Layer.FACTORY,
        Layer.CONFIG,
        Layer.ROUTES,
        Layer.DEPENDENCIES,
    },
    Layer.CONTROLLERS: {
        Layer.CONTROLLERS,
        Layer.CONFIG,
        Layer.FACTORY,
        Layer.REPOSITORIES,
    },
    Layer.FACTORY: set(),
    Layer.ROUTES: {
        Layer.SERVICES,
        Layer.REPOSITORIES,
        Layer.CONTROLLERS,
        Layer.CONFIG,
        Layer.ERRORS,
    },
    Layer.DEPENDENCIES: {
        Layer.SERVICES,
        Layer.REPOSITORIES,
        Layer.CONTROLLERS,
        Layer.ERROR_HANDLERS,
    },
    Layer.ERROR_HANDLERS: {
        Layer.SERVICES,
        Layer.REPOSITORIES,
        Layer.CONTROLLERS,
        Layer.FACTORY,
        Layer.CONFIG,
        Layer.ROUTES,
        Layer.MODELS,
        Layer.DEPENDENCIES,
        Layer.APP_FILE,
    },
}

_BANNED_THIRD_PARTY: dict[Layer, set[str]] = {
    Layer.SERVICES: {"sqlalchemy", "fastapi", "starlette"},
    Layer.CONTROLLERS: {"sqlalchemy", "fastapi", "starlette"},
    Layer.REPOSITORIES: {"fastapi"},
    Layer.ROUTES: {"sqlalchemy"},
    Layer.DEPENDENCIES: {"sqlalchemy"},
}

_FASTAPI_ALLOWED_LAYERS: frozenset[Layer] = frozenset({
    Layer.ROUTES,
    Layer.DEPENDENCIES,
    Layer.ERROR_HANDLERS,
})

_SQLALCHEMY_ALLOWED_LAYERS: frozenset[Layer] = frozenset({
    Layer.REPOSITORIES,
    Layer.DEPENDENCIES,
})

_SQLALCHEMY_EXT_ALLOWED_LAYERS: frozenset[Layer] = frozenset({
    Layer.REPOSITORIES,
})

_FACTORY_IMPORT_ALLOWED_LAYERS: frozenset[Layer] = frozenset({
    Layer.ROUTES,
})


@dataclass(slots=True)
class ImportBoundaryService:
    _import_graph: IImportGraph
    rule_id_prefix: str = "import-boundary"

    def check(self, project: ProjectInfo) -> list[Violation]:
        violations: list[Violation] = []
        for edge in self._import_graph.all_imports:
            violations.extend(self._check_edge(edge, project.package_name))
        return violations

    def _check_edge(self, edge: ImportEdge, package_name: str) -> list[Violation]:
        violations: list[Violation] = []

        importer_layer = self._import_graph.module_layer(edge.importer, package_name)
        imported_layer = self._import_graph.module_layer(edge.imported, package_name)

        if importer_layer is None:
            return violations

        is_internal = edge.imported.startswith(package_name)

        violations.extend(
            self._check_layer_boundary(edge, importer_layer, imported_layer, is_internal)
        )
        violations.extend(self._check_banned_third_party(edge, importer_layer))
        violations.extend(self._check_fastapi_location(edge, importer_layer))
        violations.extend(self._check_sqlalchemy_location(edge, importer_layer))
        violations.extend(
            self._check_factory_import(edge, importer_layer, package_name)
        )
        violations.extend(self._check_orm_leak(edge, importer_layer))
        return violations

    def _check_layer_boundary(
        self,
        edge: ImportEdge,
        importer_layer: Layer,
        imported_layer: Layer | None,
        is_internal: bool,
    ) -> list[Violation]:
        if not is_internal:
            return []
        if imported_layer is None:
            return []
        if imported_layer == importer_layer:
            return []

        banned_set = _BANNED_INTERNAL_LAYERS.get(importer_layer)
        if banned_set is None:
            return self._violation(
                edge,
                "layer-no-internal-imports",
                f"Layer '{importer_layer.value}' must not import any internal code "
                f"from other layers (imports '{edge.imported}')",
            )

        if imported_layer in banned_set:
            return self._violation(
                edge,
                "layer-banned-import",
                f"Layer '{importer_layer.value}' must not import from "
                f"'{imported_layer.value}' (imports '{edge.imported}')",
            )

        return []

    def _check_banned_third_party(
        self, edge: ImportEdge, importer_layer: Layer
    ) -> list[Violation]:
        banned = _BANNED_THIRD_PARTY.get(importer_layer, set())
        for prefix in banned:
            if edge.imported == prefix or edge.imported.startswith(prefix + "."):
                return self._violation(
                    edge,
                    "banned-module",
                    f"Layer '{importer_layer.value}' must not import '{prefix}' "
                    f"(imports '{edge.imported}')",
                )
        return []

    def _check_fastapi_location(
        self, edge: ImportEdge, importer_layer: Layer
    ) -> list[Violation]:
        if edge.imported == "fastapi" or edge.imported.startswith("fastapi."):
            if importer_layer not in _FASTAPI_ALLOWED_LAYERS:
                return self._violation(
                    edge,
                    "fastapi-location",
                    f"'fastapi' must only be imported in routes/, dependencies.py, "
                    f"error_handlers.py (found in '{importer_layer.value}')",
                )
        return []

    def _check_sqlalchemy_location(
        self, edge: ImportEdge, importer_layer: Layer
    ) -> list[Violation]:
        async_session_prefix = "sqlalchemy.ext.asyncio"
        if edge.imported == async_session_prefix or edge.imported.startswith(
            async_session_prefix + "."
        ):
            if importer_layer not in _SQLALCHEMY_EXT_ALLOWED_LAYERS:
                return self._violation(
                    edge,
                    "async-session-location",
                    f"'sqlalchemy.ext.asyncio' must only be imported in repositories/ "
                    f"(found in '{importer_layer.value}')",
                )
        if edge.imported == "sqlalchemy" or edge.imported.startswith("sqlalchemy."):
            if importer_layer not in _SQLALCHEMY_ALLOWED_LAYERS:
                return self._violation(
                    edge,
                    "sqlalchemy-location",
                    f"'sqlalchemy' must only be imported in repositories/ "
                    f"(found in '{importer_layer.value}')",
                )
        return []

    def _check_factory_import(
        self, edge: ImportEdge, importer_layer: Layer, package_name: str
    ) -> list[Violation]:
        factory_module = f"{package_name}.factory" if package_name else "factory"
        if edge.imported == factory_module or edge.imported.startswith(factory_module):
            if importer_layer not in _FACTORY_IMPORT_ALLOWED_LAYERS:
                return self._violation(
                    edge,
                    "factory-import-location",
                    f"'factory.py' must only be imported by routes/ "
                    f"(found in '{importer_layer.value}')",
                )
        return []

    def _check_orm_leak(
        self, edge: ImportEdge, importer_layer: Layer
    ) -> list[Violation]:
        if ".orm." in edge.imported:
            if importer_layer != Layer.REPOSITORIES:
                return self._violation(
                    edge,
                    "orm-leak",
                    f"ORM types must never be imported outside repositories/ "
                    f"(found in '{importer_layer.value}': '{edge.imported}')",
                )
        return []

    def _violation(
        self, edge: ImportEdge, rule_suffix: str, message: str
    ) -> list[Violation]:
        return [
            Violation(
                file=self._file_path(edge.importer),
                line=edge.line_number,
                severity=Severity.ERROR,
                rule_id=f"{self.rule_id_prefix}:{rule_suffix}",
                message=message,
            )
        ]

    def _file_path(self, module_name: str) -> str:
        return module_name.replace(".", "/") + ".py"
