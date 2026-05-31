from __future__ import annotations

from pathlib import Path

from chisel.checker.models.file_info import FileInfo
from chisel.checker.models.layer import Layer
from chisel.checker.models.project_info import ProjectInfo


class FileDiscovery:
    _LAYER_MAP: dict[str, Layer] = {
        "models": Layer.MODELS,
        "errors": Layer.ERRORS,
        "config": Layer.CONFIG,
        "services": Layer.SERVICES,
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

    _LAYER_FILENAMES: dict[str, Layer] = {
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

        if not package_name:
            package_name = root_path.name

        return ProjectInfo(root_path=root_path, files=files, package_name=package_name)

    def _find_package_name(self, root_path: Path) -> str:
        src = root_path / "src"
        if not src.is_dir():
            return ""
        for child in sorted(src.iterdir()):
            if child.is_dir() and (child / "__init__.py").exists():
                return child.name
        return ""

    def _find_src_root(self, root_path: Path, package_name: str) -> Path:
        if package_name:
            return root_path / "src" / package_name
        src = root_path / "src"
        if src.is_dir():
            return src
        return root_path

    def _classify_file(self, file_path: Path, src_root: Path, package_name: str) -> Layer:
        relative = file_path.relative_to(src_root)

        filename = file_path.name
        if filename in self._LAYER_FILENAMES:
            return self._LAYER_FILENAMES[filename]

        parents = [p.name for p in file_path.parents if str(p) != str(src_root)]
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
