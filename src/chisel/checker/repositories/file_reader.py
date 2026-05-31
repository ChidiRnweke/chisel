from __future__ import annotations

from pathlib import Path


class FileReader:
    def read(self, path: Path) -> str:
        return path.read_text(encoding="utf-8")
