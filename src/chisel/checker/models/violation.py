from __future__ import annotations

from dataclasses import dataclass

from chisel.checker.models.severity import Severity


@dataclass(frozen=True, slots=True)
class Violation:
    file: str
    line: int
    severity: Severity
    rule_id: str
    message: str
