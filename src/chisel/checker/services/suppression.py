from __future__ import annotations

import re
from dataclasses import dataclass

from chisel.checker.models.violation import Violation


_NOQA_RE = re.compile(r"#\s*noqa:\s*([a-z0-9_]+(?:\s*,\s*[a-z0-9_]+)*)\s*(?:—|--)?\s*(.*)?")


@dataclass(slots=True)
class SuppressionService:
    rule_id_prefix: str = "suppression"

    def check(self, violations: list[Violation], sources: dict[str, str]) -> list[Violation]:
        active: list[Violation] = []
        for v in violations:
            if not self._is_suppressed(v, sources):
                active.append(v)
        return active

    def _is_suppressed(self, violation: Violation, sources: dict[str, str]) -> bool:
        source = sources.get(violation.file)
        if source is None:
            return False

        lines = source.split("\n")
        if violation.line < 1 or violation.line > len(lines):
            return False

        target_line = lines[violation.line - 1]
        match = _NOQA_RE.search(target_line)
        if match is None:
            return False

        rule_ids_raw = match.group(1)
        rule_ids = {r.strip() for r in rule_ids_raw.split(",")}

        if violation.rule_id in rule_ids:
            return True

        if any(violation.rule_id.startswith(rid) for rid in rule_ids):
            return True

        return False
