from dataclasses import dataclass
from pathlib import Path

from chisel.checker.controllers.skill_setup_controller import SkillSetupController
from chisel.checker.models.agent_skill import SkillInstallResult, SkillTarget


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


class TestSkillSetupController:
    def test_returns_setup_result_from_installer(self):
        controller = SkillSetupController(_installer=FakeSkillInstaller())
        result = controller.setup(".", SkillTarget.CODEX, dry_run=True)
        assert result.results[0].status == "would_install"
