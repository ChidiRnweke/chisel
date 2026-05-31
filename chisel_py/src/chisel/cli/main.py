
import json
import sys
from pathlib import Path

import typer

from chisel.checker.factory import CheckerFactory
from chisel.checker.reporter import Reporter
from chisel.checker.services.protocols import RuleInfo

app = typer.Typer()


@app.command()
def check(
    project_path: str = typer.Argument(".", help="Path to project root"),
    json_output: bool = typer.Option(
        False, "--json", help="Output violations as JSON"
    ),
    strict: bool = typer.Option(
        True, "--strict/--no-strict",
        help="Enforce strict src layout and build config rules",
    ),
) -> None:
    factory = CheckerFactory(strict=strict)
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


@app.command()
def rules(
    json_output: bool = typer.Option(
        False, "--json", help="Output rules as JSON"
    ),
) -> None:
    factory = CheckerFactory()
    controller = factory.create_controller()
    all_rules: list[RuleInfo] = []
    for service in controller._services:
        all_rules.extend(service.describe_rules())

    if json_output:
        data = [
            {
                "id": r.id,
                "category": r.category,
                "description": r.description,
                "fix_guidance": r.fix_guidance,
            }
            for r in all_rules
        ]
        sys.stdout.write(json.dumps(data, indent=2) + "\n")
        return

    categorized: dict[str, list[RuleInfo]] = {}
    for rule in all_rules:
        categorized.setdefault(rule.category, []).append(rule)

    for category in sorted(categorized):
        rules_list = categorized[category]
        sys.stdout.write(f"\n{category} ({len(rules_list)} rules)\n")
        for rule in rules_list:
            sys.stdout.write(f"  {rule.id:50s} {rule.description}\n")
    sys.stdout.write("\n")


@app.command()
def explain(
    rule_id: str = typer.Argument(..., help="Rule ID or category prefix"),
    json_output: bool = typer.Option(
        False, "--json", help="Output as JSON"
    ),
) -> None:
    factory = CheckerFactory()
    controller = factory.create_controller()
    all_rules: list[RuleInfo] = []
    for service in controller._services:
        all_rules.extend(service.describe_rules())

    matches = [
        r for r in all_rules
        if r.id == rule_id or r.id.startswith(rule_id + ":") or r.category == rule_id
    ]

    if not matches:
        sys.stderr.write(f"Unknown rule or category: {rule_id}\n")
        raise typer.Exit(code=1)

    if json_output:
        data = [
            {
                "id": r.id,
                "category": r.category,
                "description": r.description,
                "fix_guidance": r.fix_guidance,
            }
            for r in matches
        ]
        sys.stdout.write(json.dumps(data, indent=2) + "\n")
        return

    for rule in matches:
        sys.stdout.write(f"Rule:        {rule.id}\n")
        sys.stdout.write(f"Category:    {rule.category}\n")
        sys.stdout.write(f"Description: {rule.description}\n")
        sys.stdout.write(f"\nHow to fix:\n{rule.fix_guidance}\n")
        sys.stdout.write("\n")


def main() -> None:
    app()
