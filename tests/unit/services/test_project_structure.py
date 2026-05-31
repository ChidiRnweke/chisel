
import tempfile
from pathlib import Path

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.services.project_structure import ProjectStructureService


def _service() -> ProjectStructureService:
    return ProjectStructureService()


class TestSrcLayout:
    def test_detects_missing_src_layout(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            project = ProjectInfo(root_path=root, files=[])
            violations = _service().check(project)
            has_rule = any(
                v.rule_id == "project-structure:src-layout-missing"
                for v in violations
            )
            assert has_rule

    def test_detects_py_files_at_project_root(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src").mkdir()
            (root / "setup.py").write_text("# setup")
            project = ProjectInfo(root_path=root, files=[])
            violations = _service().check(project)
            has_rule = any(
                v.rule_id == "project-structure:setup-py-banned"
                for v in violations
            )
            assert has_rule


class TestBuildConfig:
    def test_detects_setup_py(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src").mkdir()
            (root / "setup.py").write_text("# setup")
            project = ProjectInfo(root_path=root, files=[])
            violations = _service().check(project)
            has_rule = any(
                v.rule_id == "project-structure:setup-py-banned"
                for v in violations
            )
            assert has_rule

    def test_detects_requirements_txt(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src").mkdir()
            (root / "requirements.txt").write_text("pytest")
            project = ProjectInfo(root_path=root, files=[])
            violations = _service().check(project)
            has_rule = any(
                v.rule_id == "project-structure:requirements-txt-banned"
                for v in violations
            )
            assert has_rule

    def test_detects_missing_pyproject_toml(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src").mkdir()
            project = ProjectInfo(root_path=root, files=[])
            violations = _service().check(project)
            has_rule = any(
                v.rule_id == "project-structure:pyproject-missing"
                for v in violations
            )
            assert has_rule
