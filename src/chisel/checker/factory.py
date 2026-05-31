from __future__ import annotations

from dataclasses import dataclass, field

from chisel.checker.controllers.check_controller import CheckController
from chisel.checker.repositories.import_graph import ImportGraph
from chisel.checker.repositories.protocols import IImportGraph
from chisel.checker.services.app_file import AppFileService
from chisel.checker.services.complexity import ComplexityService
from chisel.checker.services.concurrency import ConcurrencyService
from chisel.checker.services.config_startup import ConfigStartupService
from chisel.checker.services.error_flow import ErrorFlowService
from chisel.checker.services.import_boundary import ImportBoundaryService
from chisel.checker.services.project_structure import ProjectStructureService
from chisel.checker.services.protocols import ICheckerService
from chisel.checker.services.session import SessionService
from chisel.checker.services.structural import StructuralService
from chisel.checker.services.suppression import SuppressionService
from chisel.checker.services.check_test_structure import CheckTestStructureService


@dataclass(slots=True)
class CheckerFactory:
    _import_graph: IImportGraph = field(default_factory=ImportGraph)
    _suppression: SuppressionService = field(default_factory=SuppressionService)

    def create_controller(self) -> CheckController:
        services: list[ICheckerService] = [
            ImportBoundaryService(_import_graph=self._import_graph),
            StructuralService(),
            ComplexityService(),
            ConcurrencyService(),
            SessionService(),
            ErrorFlowService(),
            ConfigStartupService(),
            ProjectStructureService(),
            AppFileService(),
            CheckTestStructureService(),
        ]

        return CheckController(
            _services=services,
            _suppression=self._suppression,
            _import_graph=self._import_graph,
        )
