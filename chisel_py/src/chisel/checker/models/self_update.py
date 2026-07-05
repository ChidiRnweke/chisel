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


@dataclass(frozen=True, slots=True)
class VersionNotice:
    current_version: str
    latest_version: str
    command: str
    message: str
