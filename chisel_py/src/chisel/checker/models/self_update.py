from dataclasses import dataclass
from enum import Enum


class SelfUpdateManager(str, Enum):
    AUTO = "auto"
    PIP = "pip"
    PIPX = "pipx"
    UV = "uv"


@dataclass(frozen=True, slots=True)
class SelfUpdateResult:
    command: list[str]
    returncode: int
