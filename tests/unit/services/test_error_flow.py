
import ast

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.services.error_flow import ErrorFlowService


def _check_source(source: str, layer: Layer) -> list:
    service = ErrorFlowService()
    info = FileInfo(
        path=__import__("pathlib").Path("test.py"),
        layer=layer,
        source=source,
    )
    info.ast_tree = ast.parse(source)
    project = ProjectInfo(
        root_path=__import__("pathlib").Path("."),
        files=[info],
    )
    return service.check(project)


class TestHttpInError:
    def test_detects_http_status_in_error_class(self):
        source = (
            "from __future__ import annotations\n"
            "class AppError(Exception): pass\n"
            "class MyError(AppError):\n"
            "    status_code = 404\n"
        )
        violations = _check_source(source, Layer.SERVICES)
        assert len(violations) == 1
        assert violations[0].rule_id == "error-flow:http-in-error"

    def test_accepts_error_class_without_http_status(self):
        source = (
            "from __future__ import annotations\n"
            "class AppError(Exception): pass\n"
            "class MyError(AppError):\n"
            "    message: str\n"
        )
        violations = _check_source(source, Layer.SERVICES)
        assert len(violations) == 0

    def test_ignores_http_status_in_error_handlers_file(self):
        source = (
            "from __future__ import annotations\n"
            "class AppError(Exception): pass\n"
            "class MyError(AppError):\n"
            "    status_code = 404\n"
        )
        violations = _check_source(source, Layer.ERROR_HANDLERS)
        assert len(violations) == 0
