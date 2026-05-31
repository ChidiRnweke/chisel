from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class Exemption:
    file_patterns: list[str] = field(default_factory=list)
    rule_ids: list[str] = field(default_factory=list)
    reason: str = ""
