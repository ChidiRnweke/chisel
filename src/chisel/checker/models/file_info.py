from __future__ import annotations

import ast
from dataclasses import dataclass, field
from pathlib import Path

from chisel.checker.models.layer import Layer


@dataclass(slots=True)
class FileInfo:
    path: Path
    layer: Layer
    source: str = ""
    ast_tree: ast.Module | None = None
