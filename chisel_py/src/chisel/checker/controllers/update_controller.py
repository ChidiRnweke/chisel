from dataclasses import dataclass, field
from pathlib import Path

from chisel.checker.models.agent_skill import SkillSetupResult, SkillTarget
from chisel.checker.models.self_update import SelfUpdateManager, SelfUpdateResult
from chisel.checker.services.agent_skills import ISkillInstaller, SkillInstaller
from chisel.checker.services.self_update import ISelfUpdater, SelfUpdater


@dataclass(slots=True)
class UpdateController:
    _skill_installer: ISkillInstaller = field(default_factory=SkillInstaller)
    _self_updater: ISelfUpdater = field(default_factory=SelfUpdater)

    def update_self(
        self,
        manager: SelfUpdateManager = SelfUpdateManager.AUTO,
        dry_run: bool = False,
    ) -> SelfUpdateResult:
        return self._self_updater.update(manager=manager, dry_run=dry_run)

    def update_skills(
        self,
        project_path: str,
        target: SkillTarget,
        skill_names: list[str] | None = None,
        overwrite: bool = True,
        dry_run: bool = False,
    ) -> SkillSetupResult:
        results = self._skill_installer.install(
            Path(project_path),
            target,
            skill_names=skill_names,
            overwrite=overwrite,
            dry_run=dry_run,
        )
        return SkillSetupResult(
            target=target,
            target_dir=str(self._skill_installer.target_dir(target)),
            results=results,
        )
