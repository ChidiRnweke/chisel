
import ast

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.services.app_file import AppFileService


def _check_source(source: str) -> list:
    service = AppFileService()
    info = FileInfo(
        path=__import__("pathlib").Path("app.py"),
        layer=Layer.APP_FILE,
        source=source,
    )
    info.ast_tree = ast.parse(source)
    project = ProjectInfo(
        root_path=__import__("pathlib").Path("."),
        files=[info],
    )
    return service.check(project)


def _count(violations, suffix):
    return sum(1 for v in violations if v.rule_id == f"app-file:{suffix}")


class TestAppFileLocLimit:
    def test_detects_app_file_exceeding_loc_limit(self):
        lines = ["x = 1"] * 51
        source = "from __future__ import annotations\n" + "\n".join(lines) + "\n"
        violations = _check_source(source)
        assert _count(violations, "app-loc-limit") == 1


class TestNoRoutesInApp:
    def test_detects_route_decorator_in_app_file(self):
        source = (
            "from __future__ import annotations\n"
            "@router.get('/users')\n"
            "def get_users(): pass\n"
        )
        violations = _check_source(source)
        assert _count(violations, "route-in-app") == 1


class TestNoAsyncRoutesInApp:
    def test_detects_async_route_decorator_in_app_file(self):
        source = (
            "from __future__ import annotations\n"
            "@router.get('/users')\n"
            "async def get_users(): pass\n"
        )
        violations = _check_source(source)
        assert _count(violations, "route-in-app") == 1


class TestAppFileComplexity:
    def test_detects_app_file_complexity_exceeding_one(self):
        source = (
            "from __future__ import annotations\n"
            "def create_app():\n"
            "    if True:\n"
            "        pass\n"
            "    else:\n"
            "        pass\n"
        )
        violations = _check_source(source)
        assert _count(violations, "app-complexity-limit") == 1
