
import tempfile
from pathlib import Path

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.services.project_structure import ProjectStructureService


class TestStructuralCoverage:
    def test_detects_missing_test_for_service_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src").mkdir()
            pyproject = root / "pyproject.toml"
            pyproject.write_text("[project]\nname='x'\n")
            fixture_path = Path("src/myapp/services/foo.py")
            project = ProjectInfo(
                root_path=root,
                files=[
                    FileInfo(path=fixture_path, layer=Layer.SERVICES),
                ],
            )
            violations = ProjectStructureService().check(project)
            has_rule = any(
                v.rule_id == "project-structure:missing-test-coverage"
                for v in violations
            )
            assert has_rule

    def test_detects_missing_test_for_controller_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src").mkdir()
            pyproject = root / "pyproject.toml"
            pyproject.write_text("[project]\nname='x'\n")
            fixture_path = Path("src/myapp/controllers/foo_ctrl.py")
            project = ProjectInfo(
                root_path=root,
                files=[
                    FileInfo(path=fixture_path, layer=Layer.CONTROLLERS),
                ],
            )
            violations = ProjectStructureService().check(project)
            has_rule = any(
                v.rule_id == "project-structure:missing-test-coverage"
                for v in violations
            )
            assert has_rule
