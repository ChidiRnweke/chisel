from __future__ import annotations

from dataclasses import dataclass, field

from chisel.checker.models.violation import Violation


@dataclass(frozen=True, slots=True)
class CheckResult:
    violations: list[Violation] = field(default_factory=list)
    errors: int = 0
    warnings: int = 0
    info: int = 0
    files_checked: int = 0

    @property
    def has_errors(self) -> bool:
        return self.errors > 0
