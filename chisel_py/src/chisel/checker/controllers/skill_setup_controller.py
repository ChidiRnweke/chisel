from dataclasses import dataclass
from pathlib import Path

from chisel.checker.models.agent_skill import SkillSetupResult, SkillTarget
from chisel.checker.services.agent_skills import ISkillInstaller


@dataclass(slots=True)
class SkillSetupController:
    _installer: ISkillInstaller

    def setup(
        self,
        project_path: str,
        target: SkillTarget,
        skill_names: list[str] | None = None,
        overwrite: bool = False,
        dry_run: bool = False,
    ) -> SkillSetupResult:
        results = self._installer.install(
            Path(project_path),
            target,
            skill_names=skill_names,
            overwrite=overwrite,
            dry_run=dry_run,
        )
        return SkillSetupResult(
            target=target,
            target_dir=str(self._installer.target_dir(target)),
            results=results,
        )
