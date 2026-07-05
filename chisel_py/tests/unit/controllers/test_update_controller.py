from dataclasses import dataclass
from pathlib import Path

from chisel.checker.controllers.update_controller import UpdateController
from chisel.checker.models.agent_skill import SkillInstallResult, SkillTarget
from chisel.checker.models.self_update import SelfUpdateManager, SelfUpdateResult


@dataclass(slots=True)
class FakeSkillInstaller:
    def install(
        self,
        project_path: Path,
        target: SkillTarget,
        skill_names: list[str] | None = None,
        overwrite: bool = False,
        dry_run: bool = False,
    ) -> list[SkillInstallResult]:
        return [
            SkillInstallResult(
                name="qa",
                source="source",
                destination=str(project_path / "qa"),
                status="would_install" if dry_run else "installed",
                reason=target.value,
            )
        ]

    def target_dir(self, target: SkillTarget) -> Path:
        return Path(".agents") / "skills"


@dataclass(slots=True)
class FakeSelfUpdater:
    def update(
        self,
        manager: SelfUpdateManager = SelfUpdateManager.AUTO,
        dry_run: bool = False,
    ) -> SelfUpdateResult:
        return SelfUpdateResult(command=[manager.value], returncode=0)

    def command_for(self, manager: SelfUpdateManager) -> list[str]:
        return [manager.value]


class TestUpdateController:
    def test_updates_skills_with_installer(self):
        controller = UpdateController(
            _skill_installer=FakeSkillInstaller(),
            _self_updater=FakeSelfUpdater(),
        )
        result = controller.update_skills(".", SkillTarget.CODEX, dry_run=True)
        assert result.results[0].status == "would_install"

    def test_updates_self_with_updater(self):
        controller = UpdateController(
            _skill_installer=FakeSkillInstaller(),
            _self_updater=FakeSelfUpdater(),
        )
        result = controller.update_self(SelfUpdateManager.PIP, dry_run=True)
        assert result.command == ["pip"]
