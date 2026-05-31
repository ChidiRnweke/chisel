from __future__ import annotations

import ast

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.services.session import SessionService


def _check_source(source: str, layer: Layer) -> list:
    service = SessionService()
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


class TestExecuteOutsideRepos:
    def test_detects_session_execute_outside_repositories(self):
        source = "from __future__ import annotations\nsession.execute()\n"
        violations = _check_source(source, Layer.SERVICES)
        assert len(violations) == 1
        assert violations[0].rule_id == "session:session-execute-location"

    def test_accepts_execute_in_repositories(self):
        source = "from __future__ import annotations\nsession.execute()\n"
        violations = _check_source(source, Layer.REPOSITORIES)
        assert len(violations) == 0

    def test_ignores_non_session_execute_call(self):
        source = "from __future__ import annotations\ncursor.execute()\n"
        violations = _check_source(source, Layer.SERVICES)
        assert len(violations) == 0

    def test_detects_self_session_execute(self):
        source = "from __future__ import annotations\nself._session.execute()\n"
        violations = _check_source(source, Layer.SERVICES)
        assert len(violations) == 1
        assert violations[0].rule_id == "session:session-execute-location"

    def test_ignores_subprocess_execute(self):
        source = "from __future__ import annotations\nsubprocess.execute()\n"
        violations = _check_source(source, Layer.SERVICES)
        assert len(violations) == 0
