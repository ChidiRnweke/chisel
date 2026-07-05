from dataclasses import dataclass
from enum import Enum


class SkillTarget(str, Enum):
    CODEX = "codex"
    CLAUDE = "claude"
    OPENCODE = "opencode"


@dataclass(frozen=True, slots=True)
class SkillInstallResult:
    name: str
    source: str
    destination: str
    status: str
    reason: str


@dataclass(frozen=True, slots=True)
class SkillSetupResult:
    target: SkillTarget
    target_dir: str
    results: list[SkillInstallResult]
