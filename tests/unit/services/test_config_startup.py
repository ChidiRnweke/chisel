from __future__ import annotations

import ast

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.services.config_startup import ConfigStartupService


def _check_source(source: str, layer: Layer) -> list:
    service = ConfigStartupService()
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


class TestGetenvOutsideConfig:
    def test_detects_os_getenv_outside_config(self):
        source = (
            "from __future__ import annotations\n"
            "import os\n"
            "os.getenv('KEY')\n"
        )
        violations = _check_source(source, Layer.SERVICES)
        assert len(violations) == 1
        assert violations[0].rule_id == "config-startup:getenv-outside-config"

    def test_accepts_os_getenv_in_config(self):
        source = (
            "from __future__ import annotations\n"
            "import os\n"
            "os.getenv('KEY')\n"
        )
        violations = _check_source(source, Layer.CONFIG)
        assert len(violations) == 0
