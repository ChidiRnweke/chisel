
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(slots=True)
class CheckerConfig:
    target_path: Path = field(default_factory=Path.cwd)
