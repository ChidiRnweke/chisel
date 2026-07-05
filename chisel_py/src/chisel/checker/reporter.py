
import json
from dataclasses import dataclass
from typing import Any

from rich.console import Console
from rich.markup import escape
from rich.table import Table

from chisel.checker.models.result import CheckResult
from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation
from chisel.checker.rule_metadata import skill_name_for_rule


@dataclass(slots=True)
class Reporter:
    _console: Console = Console()

    def report(self, result: CheckResult) -> None:
        table = Table(title="Chisel Architecture Check")
        table.add_column("Ref", style="dim", justify="right")
        table.add_column("File", style="cyan", no_wrap=False)
        table.add_column("Line", style="dim", justify="right")
        table.add_column("Severity")
        table.add_column("Rule")

        refs, messages = self._message_refs(result.violations)

        for v in result.violations:
            sev = self._severity_label(v.severity)
            table.add_row(
                escape(refs[v]),
                v.file,
                str(v.line),
                sev,
                v.rule_id,
            )

        self._console.print(table)
        if messages:
            self._console.print("\n[bold]Messages[/bold]")
            for item in messages:
                self._console.print(
                    f"{escape(item['ref'])} "
                    f"skill: {escape(item['skill_name'])} - "
                    f"{escape(item['message'])}"
                )

        self._console.print(
            f"\n{result.files_checked} files checked | "
            f"[red]{result.errors} errors[/red] | "
            f"[yellow]{result.warnings} warnings[/yellow] | "
            f"[blue]{result.info} info[/blue]"
        )

    def report_json(self, result: CheckResult) -> str:
        refs, messages = self._message_refs(result.violations)
        data = {
            "summary": {
                "files_checked": result.files_checked,
                "errors": result.errors,
                "warnings": result.warnings,
                "info": result.info,
            },
            "messages": messages,
            "violations": [
                {
                    "file": v.file,
                    "line": v.line,
                    "severity": v.severity.value,
                    "rule_id": v.rule_id,
                    "message_ref": refs[v],
                }
                for v in result.violations
            ],
        }
        return json.dumps(data, indent=2)

    def _message_refs(
        self, violations: list[Violation]
    ) -> tuple[dict[Violation, str], list[dict[str, Any]]]:
        refs: dict[Violation, str] = {}
        by_message: dict[tuple[str, str], str] = {}
        messages: list[dict[str, Any]] = []

        for violation in violations:
            skill_name = skill_name_for_rule(violation.rule_id)
            key = (violation.message, skill_name)
            ref = by_message.get(key)
            if ref is None:
                ref = f"[{len(messages) + 1}]"
                by_message[key] = ref
                messages.append(
                    {
                        "ref": ref,
                        "skill_name": skill_name,
                        "message": violation.message,
                    }
                )
            refs[violation] = ref

        return refs, messages

    def _severity_label(self, severity: Severity) -> str:
        if severity == Severity.ERROR:
            return "[red]ERROR[/red]"
        if severity == Severity.WARNING:
            return "[yellow]WARNING[/yellow]"
        return "[blue]INFO[/blue]"
