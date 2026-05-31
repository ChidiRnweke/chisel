from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import Path

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo
from chisel.checker.models.severity import Severity
from chisel.checker.models.violation import Violation


@dataclass(slots=True)
class ProjectStructureService:
    rule_id_prefix: str = "project-structure"

    def check(self, project: ProjectInfo) -> list[Violation]:
        violations: list[Violation] = []
        violations.extend(self._check_src_layout(project))
        violations.extend(self._check_build_config(project))
        violations.extend(self._check_orm_init_imports(project))
        violations.extend(self._check_structural_coverage(project))
        return violations

    def _check_src_layout(self, project: ProjectInfo) -> list[Violation]:
        root = project.root_path
        src = root / "src"

        if not src.is_dir():
            return self._v(
                str(root), 1, "src-layout-missing",
                "Project must use src layout: src/<appname>/",
            )

        py_files_at_root = list(root.glob("*.py"))
        if py_files_at_root:
            violations: list[Violation] = []
            for py_file in py_files_at_root:
                rel = str(py_file.relative_to(root))
                violations.extend(
                    self._v(
                        rel, 1, "root-py-file",
                        f".py files at project root are invalid: {rel}",
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
                        f".py files at src/ root are invalid: {rel}",
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
                "setup.py is banned — use pyproject.toml only",
            )

        requirements_txt = root / "requirements.txt"
        if requirements_txt.exists():
            return self._v(
                "requirements.txt", 1, "requirements-txt-banned",
                "requirements.txt is banned — use pyproject.toml only",
            )

        pyproject = root / "pyproject.toml"
        if not pyproject.exists():
            return self._v(
                "pyproject.toml", 1, "pyproject-missing",
                "pyproject.toml is required — only build file permitted",
            )

        return []

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
            isinstance(node, (ast.Import, ast.ImportFrom)) for node in tree.body
        )
        if not has_imports:
            return self._v(
                str(orm_init.path), 1, "orm-init-empty",
                "repositories/orm/__init__.py must import all ORM models "
                "for Alembic autogeneration",
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
                        f"Service '{name}' has no corresponding test file "
                        f"(expected tests/unit/services/test_{name}.py)",
                    )
                )

        for ctrl in controller_files:
            name = ctrl.path.stem
            expected = f"tests/unit/controllers/test_{name}.py"
            if expected not in test_files:
                violations.extend(
                    self._v(
                        str(ctrl.path), 1, "missing-test-coverage",
                        f"Controller '{name}' has no corresponding test file "
                        f"(expected tests/unit/controllers/test_{name}.py)",
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
