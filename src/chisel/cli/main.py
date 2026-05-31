from __future__ import annotations

import sys
from pathlib import Path

import typer

from chisel.checker.factory import CheckerFactory
from chisel.checker.reporter import Reporter

app = typer.Typer()


@app.command()
def check(
    project_path: str = typer.Argument(".", help="Path to project root"),
    json_output: bool = typer.Option(
        False, "--json", help="Output violations as JSON"
    ),
) -> None:
    factory = CheckerFactory()
    controller = factory.create_controller()

    try:
        result = controller.check(project_path)
    except Exception as exc:
        sys.stderr.write(f"Error: {exc}\n")
        raise typer.Exit(code=1)

    reporter = Reporter()
    if json_output:
        sys.stdout.write(reporter.report_json(result) + "\n")
    else:
        reporter.report(result)

    if result.has_errors:
        raise typer.Exit(code=1)


def main() -> None:
    app()
