import tempfile
from pathlib import Path

from chisel.checker.models.agent_skill import SkillTarget
from chisel.checker.services.agent_skills import SkillInstaller


def _make_skill(root: Path, name: str, extra_file: bool = False) -> None:
    skill_dir = root / name
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text(
        f"---\nname: {name}\ndescription: Skill {name}.\n---\n\nUse this skill.\n",
        encoding="utf-8",
    )
    if extra_file:
        references = skill_dir / "references"
        references.mkdir()
        (references / "example.md").write_text("Example\n", encoding="utf-8")


class TestSkillInstallerTargets:
    def test_maps_codex_target_to_agents_skills(self):
        installer = SkillInstaller()
        assert installer.target_dir(SkillTarget.CODEX) == Path(".agents") / "skills"

    def test_maps_claude_target_to_claude_skills(self):
        installer = SkillInstaller()
        assert installer.target_dir(SkillTarget.CLAUDE) == Path(".claude") / "skills"

    def test_maps_opencode_target_to_opencode_skills(self):
        installer = SkillInstaller()
        assert installer.target_dir(SkillTarget.OPENCODE) == Path(".opencode") / "skills"


class TestSkillInstallerCopies:
    def test_copies_skill_with_reference_files(self):
        with tempfile.TemporaryDirectory() as source_tmp:
            with tempfile.TemporaryDirectory() as project_tmp:
                source = Path(source_tmp)
                project = Path(project_tmp)
                _make_skill(source, "qa", extra_file=True)
                installer = SkillInstaller(_source_dir=source)
                results = installer.install(project, SkillTarget.CODEX)
                copied_reference = (
                    project
                    / ".agents"
                    / "skills"
                    / "qa"
                    / "references"
                    / "example.md"
                )
                assert results[0].status == "installed"
                assert copied_reference.read_text(encoding="utf-8") == "Example\n"

    def test_skips_existing_skill_without_overwrite(self):
        with tempfile.TemporaryDirectory() as source_tmp:
            with tempfile.TemporaryDirectory() as project_tmp:
                source = Path(source_tmp)
                project = Path(project_tmp)
                _make_skill(source, "qa")
                destination = project / ".agents" / "skills" / "qa"
                destination.mkdir(parents=True)
                (destination / "SKILL.md").write_text("existing\n", encoding="utf-8")
                installer = SkillInstaller(_source_dir=source)
                results = installer.install(project, SkillTarget.CODEX)
                assert results[0].status == "skipped_exists"

    def test_overwrites_existing_skill_when_requested(self):
        with tempfile.TemporaryDirectory() as source_tmp:
            with tempfile.TemporaryDirectory() as project_tmp:
                source = Path(source_tmp)
                project = Path(project_tmp)
                _make_skill(source, "qa")
                destination = project / ".agents" / "skills" / "qa"
                destination.mkdir(parents=True)
                (destination / "SKILL.md").write_text("existing\n", encoding="utf-8")
                installer = SkillInstaller(_source_dir=source)
                results = installer.install(
                    project, SkillTarget.CODEX, overwrite=True
                )
                assert results[0].status == "installed"
                assert "name: qa" in (destination / "SKILL.md").read_text(
                    encoding="utf-8"
                )

    def test_dry_run_does_not_write_files(self):
        with tempfile.TemporaryDirectory() as source_tmp:
            with tempfile.TemporaryDirectory() as project_tmp:
                source = Path(source_tmp)
                project = Path(project_tmp)
                _make_skill(source, "qa")
                installer = SkillInstaller(_source_dir=source)
                results = installer.install(project, SkillTarget.CODEX, dry_run=True)
                destination = project / ".agents" / "skills" / "qa"
                assert results[0].status == "would_install"
                assert not destination.exists()

    def test_filters_by_skill_name(self):
        with tempfile.TemporaryDirectory() as source_tmp:
            with tempfile.TemporaryDirectory() as project_tmp:
                source = Path(source_tmp)
                project = Path(project_tmp)
                _make_skill(source, "qa")
                _make_skill(source, "planning-features")
                installer = SkillInstaller(_source_dir=source)
                results = installer.install(
                    project, SkillTarget.OPENCODE, skill_names=["qa"]
                )
                assert [result.name for result in results] == ["qa"]
