import fnmatch
from dataclasses import dataclass, field
from pathlib import Path

try:
    import tomllib
except ImportError:
    import tomli as tomllib

from chisel.checker.models.exemption import Exemption


@dataclass(slots=True)
class ExceptionRegistry:
    _exemptions: list[Exemption] = field(default_factory=list)

    def load(self, root: Path) -> None:
        config_path = root / "chisel-exceptions.toml"
        if not config_path.exists():
            return
        data = tomllib.loads(config_path.read_text(encoding="utf-8"))
        for entry in data.get("exceptions", []):
            self._exemptions.append(
                Exemption(
                    file_patterns=list(entry.get("files", [])),
                    rule_ids=list(entry.get("rules", [])),
                    reason=entry.get("reason", ""),
                )
            )

    def is_exempted(self, file: str, rule_id: str) -> bool:
        for exemption in self._exemptions:
            if not self._file_matches(file, exemption.file_patterns):
                continue
            if not self._rule_matches(rule_id, exemption.rule_ids):
                continue
            return True
        return False

    def _file_matches(self, file: str, patterns: list[str]) -> bool:
        for pattern in patterns:
            if fnmatch.fnmatch(file, pattern):
                return True
        return False

    def _rule_matches(self, rule_id: str, rules: list[str]) -> bool:
        for rule in rules:
            if rule == "*":
                return True
            if rule_id == rule:
                return True
            if rule_id.startswith(rule + ":") or rule_id.startswith(rule + "."):
                return True
        return False

    def filter(self, violations: list) -> list:
        return [
            v for v in violations
            if not self.is_exempted(v.file, v.rule_id)
        ]
