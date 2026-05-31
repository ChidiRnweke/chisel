from dataclasses import dataclass
from pathlib import Path


@dataclass(slots=True)
class FileReader:
    def read(self, path: Path) -> str:
        return path.read_text(encoding="utf-8")
