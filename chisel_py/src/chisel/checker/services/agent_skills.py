from __future__ import annotations

import shutil
import tempfile
from dataclasses import dataclass
from importlib import resources
from pathlib import Path
from typing import Protocol, runtime_checkable

from chisel.checker.models.agent_skill import SkillInstallResult, SkillTarget


_TARGET_DIRS: dict[SkillTarget, Path] = {
    SkillTarget.CODEX: Path(".agents") / "skills",
    SkillTarget.CLAUDE: Path(".claude") / "skills",
    SkillTarget.OPENCODE: Path(".opencode") / "skills",
}


@runtime_checkable
class ISkillInstaller(Protocol):
    def available_skills(self) -> list[str]: ...

    def install(
        self,
        project_path: Path,
        target: SkillTarget,
        skill_names: list[str] | None = None,
        overwrite: bool = False,
        dry_run: bool = False,
    ) -> list[SkillInstallResult]: ...

    def target_dir(self, target: SkillTarget) -> Path: ...


@dataclass(slots=True)
class SkillInstaller:
    _source_dir: Path | None = None

    def available_skills(self) -> list[str]:
        return [path.name for path in self._skill_dirs()]

    def install(
        self,
        project_path: Path,
        target: SkillTarget,
        skill_names: list[str] | None = None,
        overwrite: bool = False,
        dry_run: bool = False,
    ) -> list[SkillInstallResult]:
        project_path = project_path.resolve()
        selected = set(skill_names or [])
        available = {path.name: path for path in self._skill_dirs()}

        results: list[SkillInstallResult] = []
        for missing in sorted(selected - available.keys()):
            destination = project_path / _TARGET_DIRS[target] / missing
            results.append(
                SkillInstallResult(
                    name=missing,
                    source="",
                    destination=str(destination),
                    status="skipped_missing",
                    reason="No bundled skill with this name exists.",
                )
            )

        for name, source in sorted(available.items()):
            if selected and name not in selected:
                continue
            self._validate_skill(source, name)
            destination = project_path / _TARGET_DIRS[target] / name
            if destination.exists() and not overwrite:
                results.append(
                    SkillInstallResult(
                        name=name,
                        source=str(source),
                        destination=str(destination),
                        status="skipped_exists",
                        reason="Destination already exists. Pass --overwrite to replace it.",
                    )
                )
                continue
            if dry_run:
                results.append(
                    SkillInstallResult(
                        name=name,
                        source=str(source),
                        destination=str(destination),
                        status="would_install",
                        reason="Dry run; no files were written.",
                    )
                )
                continue
            self._copy_skill(source, destination, overwrite=overwrite)
            results.append(
                SkillInstallResult(
                    name=name,
                    source=str(source),
                    destination=str(destination),
                    status="installed",
                    reason="Installed skill.",
                )
            )

        return results

    def target_dir(self, target: SkillTarget) -> Path:
        return _TARGET_DIRS[target]

    def _copy_skill(
        self, source: Path, destination: Path, overwrite: bool
    ) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        temp_parent = destination.parent
        with tempfile.TemporaryDirectory(
            prefix=f".{destination.name}.", dir=temp_parent
        ) as tmp:
            temp_destination = Path(tmp) / destination.name
            shutil.copytree(
                source,
                temp_destination,
                ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
            )
            if destination.exists():
                if overwrite:
                    shutil.rmtree(destination)
                else:
                    return
            temp_destination.rename(destination)

    def _skill_dirs(self) -> list[Path]:
        source_dir = self._resolve_source_dir()
        return [
            path
            for path in source_dir.iterdir()
            if path.is_dir() and (path / "SKILL.md").is_file()
        ]

    def _resolve_source_dir(self) -> Path:
        if self._source_dir is not None:
            return self._source_dir

        package_source = resources.files("chisel").joinpath("bundled_skills")
        if package_source.is_dir():
            return Path(str(package_source))

        repo_source = Path(__file__).resolve().parents[5] / "skills"
        if repo_source.is_dir():
            return repo_source

        raise FileNotFoundError("Bundled Chisel skills could not be found.")

    def _validate_skill(self, skill_dir: Path, expected_name: str) -> None:
        frontmatter = self._frontmatter(skill_dir / "SKILL.md")
        name = frontmatter.get("name")
        description = frontmatter.get("description")
        if name != expected_name:
            raise ValueError(
                f"{skill_dir / 'SKILL.md'} must declare name: {expected_name}"
            )
        if not description:
            raise ValueError(
                f"{skill_dir / 'SKILL.md'} must declare a description."
            )

    def _frontmatter(self, skill_file: Path) -> dict[str, str]:
        lines = skill_file.read_text(encoding="utf-8").splitlines()
        if not lines or lines[0].strip() != "---":
            raise ValueError(f"{skill_file} must start with YAML frontmatter.")
        data: dict[str, str] = {}
        for line in lines[1:]:
            if line.strip() == "---":
                return data
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            data[key.strip()] = value.strip().strip('"')
        raise ValueError(f"{skill_file} frontmatter is not closed.")
