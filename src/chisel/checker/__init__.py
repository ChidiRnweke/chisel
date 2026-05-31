from __future__ import annotations

from chisel.checker.factory import CheckerFactory
from chisel.checker.reporter import Reporter


def check_project(project_path: str) -> None:
    factory = CheckerFactory()
    controller = factory.create_controller()
    result = controller.check(project_path)
    reporter = Reporter()
    reporter.report(result)
