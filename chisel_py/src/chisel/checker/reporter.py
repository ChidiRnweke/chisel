
import json
from dataclasses import dataclass

from rich.console import Console
from rich.table import Table

from chisel.checker.models.result import CheckResult
from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation


@dataclass(slots=True)
class Reporter:
    _console: Console = Console()

    def report(self, result: CheckResult) -> None:
        table = Table(title="Chisel Architecture Check")
        table.add_column("File", style="cyan", no_wrap=False)
        table.add_column("Line", style="dim", justify="right")
        table.add_column("Severity")
        table.add_column("Rule")
        table.add_column("Message", style="white")

        for v in result.violations:
            sev = self._severity_label(v.severity)
            table.add_row(
                v.file,
                str(v.line),
                sev,
                v.rule_id,
                v.message,
            )

        self._console.print(table)

        self._console.print(
            f"\n[fine]: {result.files_checked} files checked | "
            f"[red]{result.errors} errors[/red] | "
            f"[yellow]{result.warnings} warnings[/yellow] | "
            f"[blue]{result.info} info[/blue]"
        )

    def report_json(self, result: CheckResult) -> str:
        data = {
            "summary": {
                "files_checked": result.files_checked,
                "errors": result.errors,
                "warnings": result.warnings,
                "info": result.info,
            },
            "violations": [
                {
                    "file": v.file,
                    "line": v.line,
                    "severity": v.severity.value,
                    "rule_id": v.rule_id,
                    "message": v.message,
                }
                for v in result.violations
            ],
        }
        return json.dumps(data, indent=2)

    def _severity_label(self, severity: Severity) -> str:
        if severity == Severity.ERROR:
            return "[red]ERROR[/red]"
        if severity == Severity.WARNING:
            return "[yellow]WARNING[/yellow]"
        return "[blue]INFO[/blue]"
