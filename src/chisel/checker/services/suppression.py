from __future__ import annotations

import re
from dataclasses import dataclass

from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation


_NOQA_RE = re.compile(
    r"#\s*noqa:\s*([a-z0-9_:.-]+(?:\s*,\s*[a-z0-9_:.-]+)*)\s*(?:—|--)?\s*(.*)?",
)


@dataclass(slots=True)
class SuppressionService:
    rule_id_prefix: str = "suppression"

    def check(self, violations: list[Violation], sources: dict[str, str]) -> list[Violation]:
        active: list[Violation] = []
        seen_noqa_lines: set[tuple[str, int]] = set()
        for v in violations:
            suppressed, has_reason = self._is_suppressed(v, sources)
            if suppressed and not has_reason:
                active.append(v)
                key = (v.file, v.line)
                if key not in seen_noqa_lines:
                    seen_noqa_lines.add(key)
                    active.append(
                        Violation(
                            file=v.file,
                            line=v.line,
                            severity=Severity.ERROR,
                            rule_id=f"{self.rule_id_prefix}:missing-reason",
                            message="Suppression comment must include a reason "
                            "after — or --",
                        )
                    )
            elif not suppressed:
                active.append(v)
        return active

    def _is_suppressed(
        self, violation: Violation, sources: dict[str, str]
    ) -> tuple[bool, bool]:
        source = sources.get(violation.file)
        if source is None:
            return False, False

        lines = source.split("\n")
        if violation.line < 1 or violation.line > len(lines):
            return False, False

        target_line = lines[violation.line - 1]
        match = _NOQA_RE.search(target_line)
        if match is None:
            return False, False

        rule_ids_raw = match.group(1)
        rule_ids = {r.strip() for r in rule_ids_raw.split(",")}

        matched = violation.rule_id in rule_ids or any(
            violation.rule_id.startswith(rid) for rid in rule_ids
        )

        if not matched:
            return False, False

        reason = (match.group(2) or "").strip()
        return True, len(reason) > 0
