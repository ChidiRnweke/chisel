
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.models.violation import Violation


@dataclass(frozen=True, slots=True)
class RuleInfo:
    id: str
    category: str
    description: str
    fix_guidance: str


@runtime_checkable
class ICheckerService(Protocol):
    rule_id_prefix: str

    def check(self, project: ProjectInfo) -> list[Violation]: ...

    def describe_rules(self) -> list[RuleInfo]: ...


@runtime_checkable
class IImportBoundaryService(ICheckerService, Protocol): ...


@runtime_checkable
class IStructuralService(ICheckerService, Protocol): ...


@runtime_checkable
class IComplexityService(ICheckerService, Protocol): ...


@runtime_checkable
class IConcurrencyService(ICheckerService, Protocol): ...


@runtime_checkable
class ISessionService(ICheckerService, Protocol): ...


@runtime_checkable
class IErrorFlowService(ICheckerService, Protocol): ...


@runtime_checkable
class IConfigStartupService(ICheckerService, Protocol): ...


@runtime_checkable
class IProjectStructureService(ICheckerService, Protocol): ...


@runtime_checkable
class IAppFileService(ICheckerService, Protocol): ...


@runtime_checkable
class ICheckTestStructureService(ICheckerService, Protocol): ...


@runtime_checkable
class ISuppressionService(Protocol):
    rule_id_prefix: str

    def check(
        self, violations: list[Violation], sources: dict[str, str]
    ) -> list[Violation]: ...
