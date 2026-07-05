
from dataclasses import dataclass
from pathlib import Path

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo


@dataclass(slots=True)
class FileDiscovery:
    _LAYER_MAP = {
        "models": Layer.MODELS,
        "errors": Layer.ERRORS,
        "config": Layer.CONFIG,
        "services": Layer.SERVICES,
        "repository": Layer.REPOSITORIES,
        "repositories": Layer.REPOSITORIES,
        "controllers": Layer.CONTROLLERS,
        "factory": Layer.FACTORY,
        "routes": Layer.ROUTES,
        "dependencies": Layer.DEPENDENCIES,
        "error_handlers": Layer.ERROR_HANDLERS,
        "utils": Layer.UTILS,
        "tests": Layer.TESTS,
        "app": Layer.APP_FILE,
    }

    _LAYER_FILENAMES = {
        "errors.py": Layer.ERRORS,
        "config.py": Layer.CONFIG,
        "factory.py": Layer.FACTORY,
        "dependencies.py": Layer.DEPENDENCIES,
        "error_handlers.py": Layer.ERROR_HANDLERS,
        "app.py": Layer.APP_FILE,
    }

    def discover(self, root_path: Path) -> ProjectInfo:
        root_path = root_path.resolve()
        package_name = self._find_package_name(root_path)
        src_root = self._find_src_root(root_path, package_name)

        files: list[FileInfo] = []
        for py_file in sorted(src_root.rglob("*.py")):
            if self._is_ignored(py_file, src_root):
                continue
            relative = py_file.relative_to(root_path)
            layer = self._classify_file(py_file, src_root, package_name)
            files.append(FileInfo(path=relative, layer=layer))

        tests_root = root_path / "tests"
        if tests_root.is_dir():
            for py_file in sorted(tests_root.rglob("*.py")):
                if self._is_ignored(py_file, tests_root):
                    continue
                relative = py_file.relative_to(root_path)
                files.append(FileInfo(path=relative, layer=Layer.TESTS))

        return ProjectInfo(root_path=root_path, files=files, package_name=package_name)

    def _find_package_name(self, root_path: Path) -> str:
        src = root_path / "src"
        if src.is_dir():
            for child in sorted(src.iterdir()):
                if child.is_dir() and (child / "__init__.py").exists():
                    return child.name

        for child in sorted(root_path.iterdir()):
            if not child.is_dir():
                continue
            if child.name in ("tests", "__pycache__", ".mypy_cache", ".venv", "venv", "node_modules"):
                continue
            if child.name.startswith("."):
                continue
            if (child / "__init__.py").exists():
                return child.name

        return ""

    def _find_src_root(self, root_path: Path, package_name: str) -> Path:
        if package_name:
            candidate = root_path / "src" / package_name
            if candidate.is_dir():
                return candidate
            candidate = root_path / package_name
            if candidate.is_dir():
                return candidate
        src = root_path / "src"
        if src.is_dir():
            return src
        return root_path

    def _classify_file(self, file_path: Path, src_root: Path, package_name: str) -> Layer:
        relative = file_path.relative_to(src_root)

        filename = file_path.name
        if filename in self._LAYER_FILENAMES:
            return self._LAYER_FILENAMES[filename]

        parts = relative.parts

        for part in parts[:-1]:
            if part in self._LAYER_MAP:
                return self._LAYER_MAP[part]

        for part in reversed(parts[:-1]):
            if part in self._LAYER_MAP:
                return self._LAYER_MAP[part]

        return Layer.UNKNOWN

    def _is_ignored(self, path: Path, src_root: Path) -> bool:
        parts = path.parts
        for part in parts:
            if part.startswith(".") or part in ("__pycache__", "node_modules", ".venv", "venv"):
                return True
            if part == "migrations":
                return True
        return False
