
import ast

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.models.severity import Severity
from chisel.checker.services.complexity import ComplexityService


def _check_source(source: str, layer: Layer, name: str = "test_file.py") -> list:
    service = ComplexityService()
    info = FileInfo(
        path=__import__("pathlib").Path(name),
        layer=layer,
        source=source,
    )
    info.ast_tree = ast.parse(source)
    project = ProjectInfo(
        root_path=__import__("pathlib").Path("."),
        files=[info],
    )
    return service.check(project)


def _count(violations: list, suffix: str) -> int:
    return sum(1 for v in violations if v.rule_id == f"complexity:{suffix}")


class TestControllerMethodLoc:
    def test_detects_controller_method_exceeding_loc_limit(self):
        body_lines = ["        x = " + str(i) for i in range(32)]
        source = (
            "from __future__ import annotations\n"
            "class Foo:\n"
            "    def method(self):\n"
            + "\n".join(body_lines) + "\n"
        )
        violations = _check_source(source, Layer.CONTROLLERS)
        assert _count(violations, "controller-loc-limit") == 1

    def test_accepts_controller_method_within_loc_limit(self):
        source = (
            "from __future__ import annotations\n"
            "class Foo:\n"
            "    def method(self):\n"
            "        return 1\n"
        )
        violations = _check_source(source, Layer.CONTROLLERS)
        assert _count(violations, "controller-loc-limit") == 0

    def test_detects_async_controller_method_exceeding_loc_limit(self):
        body_lines = ["        x = " + str(i) for i in range(32)]
        source = (
            "from __future__ import annotations\n"
            "class Foo:\n"
            "    async def method(self):\n"
            + "\n".join(body_lines) + "\n"
        )
        violations = _check_source(source, Layer.CONTROLLERS)
        assert _count(violations, "controller-loc-limit") == 1


class TestControllerMethodComplexity:
    def test_detects_controller_method_exceeding_complexity_limit(self):
        source = (
            "from __future__ import annotations\n"
            "class Foo:\n"
            "    def method(self, x):\n"
            "        if x:\n"
            "            pass\n"
            "        elif x == 1:\n"
            "            pass\n"
            "        elif x == 2:\n"
            "            pass\n"
            "        else:\n"
            "            pass\n"
        )
        violations = _check_source(source, Layer.CONTROLLERS)
        assert _count(violations, "controller-complexity-limit") == 1

    def test_accepts_controller_method_within_complexity_limit(self):
        source = (
            "from __future__ import annotations\n"
            "class Foo:\n"
            "    def method(self, x):\n"
            "        return x\n"
        )
        violations = _check_source(source, Layer.CONTROLLERS)
        assert _count(violations, "controller-complexity-limit") == 0

    def test_detects_async_controller_method_exceeding_complexity_limit(self):
        source = (
            "from __future__ import annotations\n"
            "class Foo:\n"
            "    async def method(self, x):\n"
            "        if x:\n"
            "            pass\n"
            "        elif x == 1:\n"
            "            pass\n"
            "        elif x == 2:\n"
            "            pass\n"
            "        else:\n"
            "            pass\n"
        )
        violations = _check_source(source, Layer.CONTROLLERS)
        assert _count(violations, "controller-complexity-limit") == 1


class TestRouteEndpointLoc:
    def test_detects_route_endpoint_exceeding_loc_limit(self):
        lines = ["    pass"] * 21
        source = (
            "from __future__ import annotations\n"
            "def get_users():\n"
            + "\n".join(lines) + "\n"
        )
        violations = _check_source(source, Layer.ROUTES)
        assert _count(violations, "route-loc-limit") == 1

    def test_accepts_route_endpoint_within_loc_limit(self):
        source = (
            "from __future__ import annotations\n"
            "def get_users():\n"
            "    pass\n"
        )
        violations = _check_source(source, Layer.ROUTES)
        assert _count(violations, "route-loc-limit") == 0

    def test_detects_async_route_endpoint_exceeding_loc_limit(self):
        lines = ["    pass"] * 21
        source = (
            "from __future__ import annotations\n"
            "async def get_users():\n"
            + "\n".join(lines) + "\n"
        )
        violations = _check_source(source, Layer.ROUTES)
        assert _count(violations, "route-loc-limit") == 1


class TestFactoryComplexity:
    def test_detects_factory_complexity_exceeding_one(self):
        source = (
            "from __future__ import annotations\n"
            "from dataclasses import dataclass\n"
            "@dataclass(slots=True)\n"
            "class CheckerFactory:\n"
            "    def create(self):\n"
            "        if True:\n"
            "            pass\n"
            "        else:\n"
            "            pass\n"
        )
        violations = _check_source(source, Layer.FACTORY)
        assert _count(violations, "factory-complexity-limit") == 1


class TestSeverityLevels:
    def test_route_loc_limit_produces_warning_severity(self):
        lines = ["    pass"] * 21
        source = (
            "from __future__ import annotations\n"
            "def get_users():\n"
            + "\n".join(lines) + "\n"
        )
        violations = _check_source(source, Layer.ROUTES)
        route_violations = [v for v in violations if v.rule_id == "complexity:route-loc-limit"]
        assert len(route_violations) == 1
        assert route_violations[0].severity == Severity.WARNING

    def test_controller_loc_limit_produces_warning_severity(self):
        body_lines = ["        x = " + str(i) for i in range(32)]
        source = (
            "from __future__ import annotations\n"
            "class Foo:\n"
            "    def method(self):\n"
            + "\n".join(body_lines) + "\n"
        )
        violations = _check_source(source, Layer.CONTROLLERS)
        ctrl_violations = [v for v in violations if v.rule_id == "complexity:controller-loc-limit"]
        assert len(ctrl_violations) == 1
        assert ctrl_violations[0].severity == Severity.WARNING

    def test_controller_complexity_limit_produces_error_severity(self):
        source = (
            "from __future__ import annotations\n"
            "class Foo:\n"
            "    def method(self, x):\n"
            "        if x:\n"
            "            pass\n"
            "        elif x == 1:\n"
            "            pass\n"
            "        elif x == 2:\n"
            "            pass\n"
            "        else:\n"
            "            pass\n"
        )
        violations = _check_source(source, Layer.CONTROLLERS)
        cc_violations = [v for v in violations if v.rule_id == "complexity:controller-complexity-limit"]
        assert len(cc_violations) == 1
        assert cc_violations[0].severity == Severity.ERROR


class TestNoDuplicateAppLocCheck:
    def test_app_file_loc_not_checked_by_complexity_service(self):
        lines = ["x = 1"] * 51
        source = "from __future__ import annotations\n" + "\n".join(lines) + "\n"
        violations = _check_source(source, Layer.APP_FILE)
        assert _count(violations, "app-loc-limit") == 0
