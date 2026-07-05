
import json
import sys
from dataclasses import asdict

import typer

from chisel.checker.controllers.update_controller import UpdateController
from chisel.checker.factory import CheckerFactory
from chisel.checker.models.agent_skill import SkillTarget
from chisel.checker.models.self_update import SelfUpdateManager
from chisel.checker.reporter import Reporter
from chisel.checker.rule_metadata import skill_name_for_category
from chisel.checker.services.protocols import RuleInfo

app = typer.Typer()
update_app = typer.Typer()
app.add_typer(update_app, name="update")


def _choose_target_interactively() -> SkillTarget:
    if not sys.stdin.isatty():
        raise RuntimeError(
            "Choose an agent target with --target codex, --target claude, "
            "or --target opencode."
        )

    choices = [
        ("1", SkillTarget.CODEX, ".agents/skills"),
        ("2", SkillTarget.CLAUDE, ".claude/skills"),
        ("3", SkillTarget.OPENCODE, ".opencode/skills"),
    ]
    sys.stdout.write("Select agent skill target:\n")
    for number, target, destination in choices:
        sys.stdout.write(f"  {number}. {target.value} ({destination})\n")
    selected = input("Target [1]: ").strip() or "1"
    for number, target, _destination in choices:
        if selected == number or selected == target.value:
            return target
    raise RuntimeError("Unknown target selection.")


def _confirm_skill_overwrite(yes: bool, dry_run: bool) -> None:
    if yes or dry_run:
        return
    message = (
        "This will overwrite local modifications in the selected Chisel skill "
        "directories. Continue? [y/N] "
    )
    if not sys.stdin.isatty():
        raise RuntimeError("Pass --yes to overwrite bundled skills in non-interactive mode.")
    selected = input(message).strip().lower()
    if selected not in {"y", "yes"}:
        raise RuntimeError("Skill update cancelled.")


def _show_version_notice() -> None:
    if not sys.stderr.isatty():
        return
    notice = UpdateController().version_notice()
    if notice is not None:
        sys.stderr.write(f"{notice.message}\n")


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
        _show_version_notice()

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
                "skill_name": r.skill_name or skill_name_for_category(r.category),
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
            skill_name = rule.skill_name or skill_name_for_category(rule.category)
            sys.stdout.write(
                f"  {rule.id:50s} [{skill_name}] {rule.description}\n"
            )
    sys.stdout.write("\n")
    _show_version_notice()


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
                "skill_name": r.skill_name or skill_name_for_category(r.category),
            }
            for r in matches
        ]
        sys.stdout.write(json.dumps(data, indent=2) + "\n")
        return

    for rule in matches:
        sys.stdout.write(f"Rule:        {rule.id}\n")
        sys.stdout.write(f"Category:    {rule.category}\n")
        sys.stdout.write(
            "Skill:       "
            f"{rule.skill_name or skill_name_for_category(rule.category)}\n"
        )
        sys.stdout.write(f"Description: {rule.description}\n")
        sys.stdout.write(f"\nHow to fix:\n{rule.fix_guidance}\n")
        sys.stdout.write("\n")
    _show_version_notice()


@app.command()
def setup(
    project_path: str = typer.Argument(".", help="Path to project root"),
    target: SkillTarget | None = typer.Option(
        None,
        "--target",
        help="Agent target: codex, claude, or opencode",
    ),
    skills: list[str] | None = typer.Option(
        None,
        "--skill",
        help="Install only this bundled skill. May be passed multiple times.",
    ),
    overwrite: bool = typer.Option(
        False,
        "--overwrite",
        help="Replace existing skill directories.",
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Show what would be installed without writing files.",
    ),
    json_output: bool = typer.Option(
        False,
        "--json",
        help="Output installation results as JSON.",
    ),
) -> None:
    controller = UpdateController()
    try:
        selected_target = target or _choose_target_interactively()
        result = controller.update_skills(
            project_path,
            selected_target,
            skill_names=skills,
            overwrite=overwrite,
            dry_run=dry_run,
        )
    except Exception as exc:
        sys.stderr.write(f"Error: {exc}\n")
        raise typer.Exit(code=1)

    if json_output:
        data = {
            "target": result.target.value,
            "target_dir": result.target_dir,
            "results": [asdict(item) for item in result.results],
        }
        sys.stdout.write(json.dumps(data, indent=2) + "\n")
        return

    sys.stdout.write(
        f"Target: {result.target.value} "
        f"({result.target_dir})\n"
    )
    for item in result.results:
        sys.stdout.write(
            f"{item.status:15s} {item.name:32s} {item.destination}\n"
        )
    _show_version_notice()


@update_app.command("self")
def update_self(
    manager: SelfUpdateManager = typer.Option(
        SelfUpdateManager.AUTO,
        "--manager",
        help="Package manager: auto, pip, pipx, or uv.",
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Show the upgrade command without running it.",
    ),
) -> None:
    result = UpdateController().update_self(
        manager=manager,
        dry_run=dry_run,
    )
    command = " ".join(result.command)
    if dry_run:
        sys.stdout.write(f"Would run: {command}\n")
        return
    if result.returncode != 0:
        sys.stderr.write(f"Self update failed: {command}\n")
        raise typer.Exit(code=result.returncode)
    sys.stdout.write("Chisel updated. Restart the CLI to use the new version.\n")


@update_app.command("skills")
def update_skills(
    project_path: str = typer.Argument(".", help="Path to project root"),
    target: SkillTarget | None = typer.Option(
        None,
        "--target",
        help="Agent target: codex, claude, or opencode",
    ),
    skills: list[str] | None = typer.Option(
        None,
        "--skill",
        help="Update only this bundled skill. May be passed multiple times.",
    ),
    yes: bool = typer.Option(
        False,
        "--yes",
        "-y",
        help="Confirm overwriting existing skill directories.",
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Show what would be updated without writing files.",
    ),
    json_output: bool = typer.Option(
        False,
        "--json",
        help="Output update results as JSON.",
    ),
) -> None:
    controller = UpdateController()
    try:
        selected_target = target or _choose_target_interactively()
        _confirm_skill_overwrite(yes=yes, dry_run=dry_run)
        result = controller.update_skills(
            project_path,
            selected_target,
            skill_names=skills,
            overwrite=True,
            dry_run=dry_run,
        )
    except Exception as exc:
        sys.stderr.write(f"Error: {exc}\n")
        raise typer.Exit(code=1)

    if json_output:
        data = {
            "target": result.target.value,
            "target_dir": result.target_dir,
            "results": [asdict(item) for item in result.results],
        }
        sys.stdout.write(json.dumps(data, indent=2) + "\n")
        return

    sys.stdout.write(
        f"Target: {result.target.value} "
        f"({result.target_dir})\n"
    )
    for item in result.results:
        sys.stdout.write(
            f"{item.status:15s} {item.name:32s} {item.destination}\n"
        )
    _show_version_notice()


def main() -> None:
    app()
