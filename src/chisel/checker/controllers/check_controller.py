
import ast
import sys
from dataclasses import dataclass, field
from pathlib import Path

from chisel.checker.errors import ImportGraphError
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.models.result import CheckResult
from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation
from chisel.checker.repositories.file_discovery import FileDiscovery
from chisel.checker.repositories.file_reader import FileReader
from chisel.checker.repositories.import_graph import ImportGraph
from chisel.checker.repositories.protocols import IImportGraph
from chisel.checker.services.protocols import ICheckerService, ISuppressionService


@dataclass(slots=True)
class CheckController:
    _suppression: ISuppressionService
    _services: list[ICheckerService] = field(default_factory=list)
    _import_graph: IImportGraph = field(default_factory=ImportGraph)  # noqa

    def check(self, project_path: str) -> CheckResult:
        root = Path(project_path).resolve()
        project = self._prepare_project(root)
        if project.package_name:
            self._build_import_graph(root, project.package_name)
        violations = self._run_services(project)
        sources = self._collect_sources(project)
        active = self._suppression.check(violations, sources)
        return self._summarize(active, len(project.files))

    def _prepare_project(self, root: Path) -> ProjectInfo:
        discovery = FileDiscovery()
        project = discovery.discover(root)
        reader = FileReader()
        populated = [
            self._load_file(f, root, reader) for f in project.files
        ]
        return ProjectInfo(
            root_path=project.root_path,
            files=populated,
            package_name=project.package_name,
        )

    def _load_file(
        self, file_info, root: Path, reader: FileReader
    ):
        try:
            source = reader.read(root / file_info.path)
            return type(file_info)(
                path=file_info.path,
                layer=file_info.layer,
                source=source,
                ast_tree=ast.parse(source),
            )
        except Exception:
            return file_info

    def _build_import_graph(self, root: Path, package_name: str) -> None:
        src = root / "src"
        src_path = str(src) if src.is_dir() else str(root)
        original_path = list(sys.path)
        try:
            if src_path not in sys.path:
                sys.path.insert(0, src_path)
            self._import_graph.build(root, package_name)
        except Exception as exc:
            raise ImportGraphError(
                f"Failed to build import graph for "
                f"'{package_name}': {exc}"
            ) from exc
        finally:
            sys.path = original_path

    def _run_services(self, project: ProjectInfo) -> list[Violation]:
        violations: list[Violation] = []
        for service in self._services:
            violations.extend(service.check(project))
        return violations

    def _collect_sources(self, project: ProjectInfo) -> dict[str, str]:
        return {str(f.path): f.source for f in project.files}

    def _summarize(
        self, violations: list[Violation], files_checked: int
    ) -> CheckResult:
        errors = sum(1 for v in violations if v.severity == Severity.ERROR)
        warnings = sum(1 for v in violations if v.severity == Severity.WARNING)
        info = sum(1 for v in violations if v.severity == Severity.INFO)
        return CheckResult(
            violations=violations,
            errors=errors,
            warnings=warnings,
            info=info,
            files_checked=files_checked,
        )
