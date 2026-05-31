from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from chisel.checker.models.file_info import FileInfo


@dataclass(slots=True)
class ProjectInfo:
    root_path: Path
    files: list[FileInfo] = field(default_factory=list)
    package_name: str = ""
