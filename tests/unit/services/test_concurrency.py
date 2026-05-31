
import ast

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.services.concurrency import ConcurrencyService


def _check_source(source: str) -> list:
    service = ConcurrencyService()
    info = FileInfo(
        path=__import__("pathlib").Path("test.py"),
        layer=Layer.UNKNOWN,
        source=source,
    )
    info.ast_tree = ast.parse(source)
    project = ProjectInfo(
        root_path=__import__("pathlib").Path("."),
        files=[info],
    )
    return service.check(project)


def _assert_one(violations, suffix):
    assert len(violations) == 1
    assert violations[0].rule_id == f"concurrency:{suffix}"


def _assert_none(violations):
    assert len(violations) == 0


class TestAsyncioGatherBan:
    def test_detects_asyncio_gather_call(self):
        source = (
            "from __future__ import annotations\n"
            "import asyncio\n"
            "asyncio.gather()\n"
        )
        violations = _check_source(source)
        _assert_one(violations, "asyncio-gather-banned")

    def test_accepts_asyncio_task_group_usage(self):
        source = (
            "from __future__ import annotations\n"
            "import asyncio\n"
            "async def f():\n"
            "    async with asyncio.TaskGroup() as tg:\n"
            "        pass\n"
        )
        violations = _check_source(source)
        _assert_none(violations)

    def test_detects_bare_gather_with_from_import(self):
        source = (
            "from __future__ import annotations\n"
            "from asyncio import gather\n"
            "gather()\n"
        )
        violations = _check_source(source)
        _assert_one(violations, "asyncio-gather-banned")

    def test_ignores_bare_gather_without_asyncio_import(self):
        source = (
            "from __future__ import annotations\n"
            "def gather(): pass\n"
            "gather()\n"
        )
        violations = _check_source(source)
        _assert_none(violations)
