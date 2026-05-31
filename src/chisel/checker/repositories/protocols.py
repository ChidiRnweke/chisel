
from pathlib import Path
from typing import Protocol

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.import_edge import ImportEdge
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo


class IFileDiscovery(Protocol):
    def discover(self, root_path: Path) -> ProjectInfo: ...


class IFileReader(Protocol):
    def read(self, path: Path) -> str: ...


class IImportGraph(Protocol):
    def build(self, project_root: Path, package_name: str) -> None: ...

    @property
    def all_imports(self) -> list[ImportEdge]: ...

    def module_layer(self, module_name: str, package_name: str) -> Layer | None: ...
