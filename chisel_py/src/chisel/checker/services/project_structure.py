
import ast
from dataclasses import dataclass
from pathlib import Path
from chisel.checker.services.protocols import RuleInfo
from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation


@dataclass(slots=True)
class ProjectStructureService:
    rule_id_prefix: str = "project-structure"
    strict: bool = True

    def check(self, project: ProjectInfo) -> list[Violation]:
        violations: list[Violation] = []
        if self.strict:
            violations.extend(self._check_src_layout(project))
            violations.extend(self._check_build_config(project))
        violations.extend(self._check_orm_init_imports(project))
        violations.extend(self._check_structural_coverage(project))
        return violations

    def describe_rules(self) -> list[RuleInfo]:
        return [
            RuleInfo(id="project-structure:src-layout-missing", category="project-structure",
                     description="Project does not use src layout",
                     fix_guidance="All application code lives under the src layout. Create src/<appname>/ and move all .py files there."),
            RuleInfo(id="project-structure:root-py-file", category="project-structure",
                     description=".py file found at project root",
                     fix_guidance="All application code lives under the src layout. Move this file into src/<appname>/."),
            RuleInfo(id="project-structure:src-root-py-file", category="project-structure",
                     description=".py file found at src/ root",
                     fix_guidance="All application code lives under the src layout. Move this file into src/<appname>/."),
            RuleInfo(id="project-structure:setup-py-banned", category="project-structure",
                     description="setup.py found in project",
                     fix_guidance="Use pyproject.toml exclusively. Remove setup.py and consolidate dependencies there."),
            RuleInfo(id="project-structure:requirements-txt-banned", category="project-structure",
                     description="requirements.txt found in project",
                     fix_guidance="Use pyproject.toml exclusively. Remove requirements.txt and consolidate dependencies there."),
            RuleInfo(id="project-structure:pyproject-missing", category="project-structure",
                     description="pyproject.toml not found",
                     fix_guidance="pyproject.toml is required as the single build configuration file."),
            RuleInfo(id="project-structure:orm-init-empty", category="project-structure",
                     description="ORM __init__.py has no imports",
                     fix_guidance="repositories/orm/__init__.py must import all ORM models for Alembic autogeneration."),
            RuleInfo(id="project-structure:missing-test-coverage", category="project-structure",
                     description="Service or controller has no corresponding test file",
                     fix_guidance="Add a test file under tests/unit/ covering its core invariants."),
        ]

    def _check_src_layout(self, project: ProjectInfo) -> list[Violation]:
        root = project.root_path
        src = root / "src"

        if not src.is_dir():
            return self._v(
                str(root), 1, "src-layout-missing",
                "All application code lives under the src layout. "
                "Create src/<appname>/ and move all .py files there.",
            )

        py_files_at_root = list(root.glob("*.py"))
        if py_files_at_root:
            violations: list[Violation] = []
            for py_file in py_files_at_root:
                rel = str(py_file.relative_to(root))
                violations.extend(
                    self._v(
                        rel, 1, "root-py-file",
                        "All application code lives under the src layout. "
                        "Move this file into src/<appname>/."
                    )
                )
            return violations

        py_files_at_src_root = list(src.glob("*.py"))
        if py_files_at_src_root:
            violations: list[Violation] = []
            for py_file in py_files_at_src_root:
                rel = str(py_file.relative_to(root))
                violations.extend(
                    self._v(
                        rel, 1, "src-root-py-file",
                        "All application code lives under the src layout. "
                        "Move this file into src/<appname>/."
                    )
                )
            return violations

        return []

    def _check_build_config(self, project: ProjectInfo) -> list[Violation]:
        root = project.root_path

        setup_py = root / "setup.py"
        if setup_py.exists():
            return self._v(
                "setup.py", 1, "setup-py-banned",
                "Use pyproject.toml exclusively. Remove setup.py and "
                "consolidate dependencies there.",
            )

        requirements_txt = root / "requirements.txt"
        if requirements_txt.exists():
            return self._v(
                "requirements.txt", 1, "requirements-txt-banned",
                "Use pyproject.toml exclusively. Remove requirements.txt "
                "and consolidate dependencies there.",
            )

        pyproject = root / "pyproject.toml"
        if not pyproject.exists():
            return self._v(
                "pyproject.toml", 1, "pyproject-missing",
                "pyproject.toml is required as the single build "
                "configuration file.",
            )

        return []

    @staticmethod
    def _is_import_node(node: ast.stmt) -> bool:
        match node:
            case ast.Import() | ast.ImportFrom():
                return True
            case _:
                return False

    def _check_orm_init_imports(self, project: ProjectInfo) -> list[Violation]:
        orm_init = None
        for f in project.files:
            if "orm" in str(f.path) and f.path.name == "__init__.py":
                orm_init = f
                break

        if orm_init is None:
            return []

        tree = orm_init.ast_tree
        if tree is None:
            return []

        has_imports = any(
            self._is_import_node(node) for node in tree.body
        )
        if not has_imports:
            return self._v(
                str(orm_init.path), 1, "orm-init-empty",
                "repositories/orm/__init__.py must import all ORM models "
                "for Alembic autogeneration.",
            )

        return []

    def _check_structural_coverage(
        self, project: ProjectInfo
    ) -> list[Violation]:
        violations: list[Violation] = []
        service_files = [
            f for f in project.files
            if f.layer == Layer.SERVICES
            and f.path.name.endswith(".py")
            and f.path.name != "protocols.py"
            and f.path.name != "__init__.py"
        ]
        controller_files = [
            f for f in project.files
            if f.layer == Layer.CONTROLLERS
            and f.path.name != "__init__.py"
        ]

        test_files = {str(f.path) for f in project.files
                      if str(f.path).startswith("tests/")}

        for svc in service_files:
            name = svc.path.stem
            expected = f"tests/unit/services/test_{name}.py"
            if expected not in test_files:
                violations.extend(
                    self._v(
                        str(svc.path), 1, "missing-test-coverage",
                        "Add a test file under tests/unit/ covering its "
                        "core invariants.",
                    )
                )

        for ctrl in controller_files:
            name = ctrl.path.stem
            expected = f"tests/unit/controllers/test_{name}.py"
            if expected not in test_files:
                violations.extend(
                    self._v(
                        str(ctrl.path), 1, "missing-test-coverage",
                        "Add a test file under tests/unit/ covering its "
                        "core invariants.",
                    )
                )

        return violations

    def _v(
        self, file: str, line: int, rule_suffix: str, message: str
    ) -> list[Violation]:
        return [
            Violation(
                file=file,
                line=line,
                severity=Severity.ERROR,
                rule_id=f"{self.rule_id_prefix}:{rule_suffix}",
                message=message,
            )
        ]
