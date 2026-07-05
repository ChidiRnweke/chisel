
import pytest

from chisel.checker.models.import_edge import ImportEdge
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.services.import_boundary import ImportBoundaryService
from tests.fakes.fake_import_graph import FakeImportGraph


@pytest.fixture
def graph() -> FakeImportGraph:
    return FakeImportGraph()


@pytest.fixture
def service(graph: FakeImportGraph) -> ImportBoundaryService:
    return ImportBoundaryService(_import_graph=graph)


@pytest.fixture
def project() -> ProjectInfo:
    return ProjectInfo(
        root_path=__import__("pathlib").Path("."),
        package_name="myapp",
    )


def _edge(importer: str, imported: str, line: int = 1, contents: str = "") -> ImportEdge:
    return ImportEdge(
        importer=importer,
        imported=imported,
        line_number=line,
        line_contents=contents,
    )


def _assert_count(violations: list, rule_suffix: str, expected: int) -> None:
    prefix = "import-boundary:"
    count = sum(1 for v in violations if v.rule_id == f"{prefix}{rule_suffix}")
    assert count == expected


def _assert_one(violations: list, rule_suffix: str) -> None:
    _assert_count(violations, rule_suffix, 1)


def _assert_none(violations: list, rule_suffix: str) -> None:
    _assert_count(violations, rule_suffix, 0)


class TestLayerNoInternalImports:
    def test_detects_models_layer_importing_from_services(self, service, graph, project):
        graph.set_edges([_edge("myapp.models.foo", "myapp.services.bar")])
        graph.set_layers("myapp.models.foo", Layer.MODELS)
        graph.set_layers("myapp.services.bar", Layer.SERVICES)
        violations = service.check(project)
        _assert_one(violations, "layer-no-internal-imports")

    def test_accepts_models_layer_importing_from_same_layer(self, service, graph, project):
        graph.set_edges([_edge("myapp.models.foo", "myapp.models.bar")])
        graph.set_layers("myapp.models.foo", Layer.MODELS)
        graph.set_layers("myapp.models.bar", Layer.MODELS)
        violations = service.check(project)
        _assert_none(violations, "layer-no-internal-imports")


class TestLayerBannedImports:
    def test_detects_services_layer_importing_from_controllers(self, service, graph, project):
        graph.set_edges([_edge("myapp.services.foo", "myapp.controllers.bar")])
        graph.set_layers("myapp.services.foo", Layer.SERVICES)
        graph.set_layers("myapp.controllers.bar", Layer.CONTROLLERS)
        violations = service.check(project)
        _assert_one(violations, "layer-banned-import")

    def test_accepts_services_layer_importing_from_models(self, service, graph, project):
        graph.set_edges([_edge("myapp.services.foo", "myapp.models.bar")])
        graph.set_layers("myapp.services.foo", Layer.SERVICES)
        graph.set_layers("myapp.models.bar", Layer.MODELS)
        violations = service.check(project)
        _assert_none(violations, "layer-banned-import")


class TestBannedThirdPartyImports:
    def test_detects_services_layer_importing_sqlalchemy(self, service, graph, project):
        graph.set_edges([_edge("myapp.services.foo", "sqlalchemy")])
        graph.set_layers("myapp.services.foo", Layer.SERVICES)
        violations = service.check(project)
        _assert_one(violations, "banned-module")

    def test_accepts_repositories_layer_importing_sqlalchemy(self, service, graph, project):
        graph.set_edges([_edge("myapp.repositories.orm.foo", "sqlalchemy")])
        graph.set_layers("myapp.repositories.orm.foo", Layer.REPOSITORIES)
        violations = service.check(project)
        _assert_none(violations, "banned-module")


class TestFastapiLocation:
    def test_detects_fastapi_in_services_layer(self, service, graph, project):
        graph.set_edges([_edge("myapp.services.foo", "fastapi")])
        graph.set_layers("myapp.services.foo", Layer.SERVICES)
        violations = service.check(project)
        _assert_one(violations, "fastapi-location")

    def test_accepts_fastapi_in_routes_layer(self, service, graph, project):
        graph.set_edges([_edge("myapp.routes.foo", "fastapi")])
        graph.set_layers("myapp.routes.foo", Layer.ROUTES)
        violations = service.check(project)
        _assert_none(violations, "fastapi-location")

    def test_accepts_fastapi_in_app_file(self, service, graph, project):
        graph.set_edges([_edge("myapp.app", "fastapi")])
        graph.set_layers("myapp.app", Layer.APP_FILE)
        violations = service.check(project)
        _assert_none(violations, "fastapi-location")


class TestSqlalchemyLocation:
    def test_detects_sqlalchemy_in_services_layer(self, service, graph, project):
        graph.set_edges([_edge("myapp.services.foo", "sqlalchemy")])
        graph.set_layers("myapp.services.foo", Layer.SERVICES)
        violations = service.check(project)
        _assert_one(violations, "sqlalchemy-location")

    def test_detects_sqlalchemy_ext_async_in_services_layer(self, service, graph, project):
        graph.set_edges([_edge("myapp.services.foo", "sqlalchemy.ext.asyncio")])
        graph.set_layers("myapp.services.foo", Layer.SERVICES)
        violations = service.check(project)
        _assert_one(violations, "async-session-location")

    def test_accepts_sqlalchemy_in_repositories_layer(self, service, graph, project):
        graph.set_edges([_edge("myapp.repositories.foo", "sqlalchemy")])
        graph.set_layers("myapp.repositories.foo", Layer.REPOSITORIES)
        violations = service.check(project)
        _assert_none(violations, "sqlalchemy-location")

    def test_accepts_sqlalchemy_in_factory_layer(self, service, graph, project):
        graph.set_edges([_edge("myapp.factory", "sqlalchemy")])
        graph.set_layers("myapp.factory", Layer.FACTORY)
        violations = service.check(project)
        _assert_none(violations, "sqlalchemy-location")

    def test_accepts_async_session_in_factory_layer(self, service, graph, project):
        graph.set_edges([_edge("myapp.factory", "sqlalchemy.ext.asyncio")])
        graph.set_layers("myapp.factory", Layer.FACTORY)
        violations = service.check(project)
        _assert_none(violations, "async-session-location")


class TestSqlalchemyBannedInDependencies:
    def test_accepts_async_session_in_dependencies_layer(self, service, graph, project):
        graph.set_edges([_edge("myapp.dependencies", "sqlalchemy.ext.asyncio")])
        graph.set_layers("myapp.dependencies", Layer.DEPENDENCIES)
        violations = service.check(project)
        _assert_none(violations, "async-session-location")

    def test_detects_raw_sqlalchemy_in_dependencies_layer(self, service, graph, project):
        graph.set_edges([_edge("myapp.dependencies", "sqlalchemy")])
        graph.set_layers("myapp.dependencies", Layer.DEPENDENCIES)
        violations = service.check(project)
        _assert_one(violations, "sqlalchemy-location")

    def test_detects_sqlalchemy_submodule_in_dependencies_layer(self, service, graph, project):
        graph.set_edges([_edge("myapp.dependencies", "sqlalchemy.orm")])
        graph.set_layers("myapp.dependencies", Layer.DEPENDENCIES)
        violations = service.check(project)
        _assert_one(violations, "sqlalchemy-location")


class TestFactoryImportLocation:
    def test_detects_factory_import_outside_routes(self, service, graph, project):
        graph.set_edges([_edge("myapp.services.foo", "myapp.factory")])
        graph.set_layers("myapp.services.foo", Layer.SERVICES)
        violations = service.check(project)
        _assert_one(violations, "factory-import-location")

    def test_accepts_factory_import_in_routes(self, service, graph, project):
        graph.set_edges([_edge("myapp.routes.foo", "myapp.factory")])
        graph.set_layers("myapp.routes.foo", Layer.ROUTES)
        violations = service.check(project)
        _assert_none(violations, "factory-import-location")

    def test_accepts_factory_import_in_dependencies(self, service, graph, project):
        graph.set_edges([_edge("myapp.dependencies", "myapp.factory")])
        graph.set_layers("myapp.dependencies", Layer.DEPENDENCIES)
        graph.set_layers("myapp.factory", Layer.FACTORY)
        violations = service.check(project)
        _assert_none(violations, "factory-import-location")


class TestAppFileAssemblyImports:
    def test_accepts_app_file_importing_routes(self, service, graph, project):
        graph.set_edges([_edge("myapp.app", "myapp.routes.recipes")])
        graph.set_layers("myapp.app", Layer.APP_FILE)
        graph.set_layers("myapp.routes.recipes", Layer.ROUTES)
        violations = service.check(project)
        _assert_none(violations, "layer-banned-import")

    def test_accepts_app_file_importing_error_handlers(self, service, graph, project):
        graph.set_edges([_edge("myapp.app", "myapp.error_handlers")])
        graph.set_layers("myapp.app", Layer.APP_FILE)
        graph.set_layers("myapp.error_handlers", Layer.ERROR_HANDLERS)
        violations = service.check(project)
        _assert_none(violations, "layer-banned-import")

    def test_accepts_app_file_importing_dependencies(self, service, graph, project):
        graph.set_edges([_edge("myapp.app", "myapp.dependencies")])
        graph.set_layers("myapp.app", Layer.APP_FILE)
        graph.set_layers("myapp.dependencies", Layer.DEPENDENCIES)
        violations = service.check(project)
        _assert_none(violations, "layer-banned-import")


class TestOrmLeak:
    def test_detects_orm_import_outside_repositories(self, service, graph, project):
        graph.set_edges([_edge("myapp.services.foo", "myapp.repositories.orm.bar")])
        graph.set_layers("myapp.services.foo", Layer.SERVICES)
        violations = service.check(project)
        _assert_one(violations, "orm-leak")

    def test_accepts_orm_import_inside_repositories(self, service, graph, project):
        graph.set_edges([_edge("myapp.repositories.foo", "myapp.repositories.orm.bar")])
        graph.set_layers("myapp.repositories.foo", Layer.REPOSITORIES)
        violations = service.check(project)
        _assert_none(violations, "orm-leak")
