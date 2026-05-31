
import sys
from pathlib import Path

import grimp

from chisel.checker.errors import ImportGraphError
from chisel.checker.models.import_edge import ImportEdge
from chisel.checker.models.layer import Layer


class ImportGraph:
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

    def __init__(self) -> None:
        self._graph = None

    def build(self, project_root: Path, package_name: str) -> None:
        src = project_root / "src"
        src_path = str(src) if src.is_dir() else str(project_root)

        original_path = list(sys.path)
        try:
            if src_path not in sys.path:
                sys.path.insert(0, src_path)
            self._graph = grimp.build_graph(
                package_name, include_external_packages=True
            )
        except Exception as exc:
            raise ImportGraphError(
                f"Failed to build import graph for '{package_name}': {exc}"
            ) from exc
        finally:
            sys.path = original_path

    @property
    def all_imports(self) -> list[ImportEdge]:
        if self._graph is None:
            return []

        edges: list[ImportEdge] = []
        for module in self._graph.modules:
            for imported in self._graph.find_modules_directly_imported_by(module):
                try:
                    details = self._graph.get_import_details(
                        importer=module, imported=imported
                    )
                except Exception:
                    continue
                for d in details:
                    edges.append(
                        ImportEdge(
                            importer=str(d["importer"]),
                            imported=str(d["imported"]),
                            line_number=int(d["line_number"]),
                            line_contents=str(d["line_contents"]),
                        )
                    )
        return edges

    def module_layer(self, module_name: str, package_name: str) -> Layer | None:
        parts = module_name.split(".")
        if not module_name.startswith(package_name):
            return None
        relative = parts[len(package_name.split(".")):]

        top_file_names = {
            "errors": Layer.ERRORS,
            "config": Layer.CONFIG,
            "factory": Layer.FACTORY,
            "dependencies": Layer.DEPENDENCIES,
            "error_handlers": Layer.ERROR_HANDLERS,
            "app": Layer.APP_FILE,
        }

        for part in relative:
            if part in self._LAYER_MAP:
                return self._LAYER_MAP[part]

        if len(relative) == 1 and relative[0].endswith(".py"):
            name = relative[0]
            for file_key, layer in top_file_names.items():
                if name == file_key or name == file_key.replace(".py", ""):
                    return layer

        return None
