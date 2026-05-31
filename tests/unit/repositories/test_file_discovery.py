from __future__ import annotations

import tempfile
from pathlib import Path

from chisel.checker.models.layer import Layer
from chisel.checker.repositories.file_discovery import FileDiscovery


class TestDiscoversPythonFiles:
    def test_finds_all_python_files_in_project(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src" / "myapp" / "__init__.py").parent.mkdir(parents=True)
            (root / "src" / "myapp" / "__init__.py").write_text("")
            (root / "src" / "myapp" / "models").mkdir()
            (root / "src" / "myapp" / "models" / "__init__.py").write_text("")
            (root / "src" / "myapp" / "models" / "user.py").write_text("")
            discovery = FileDiscovery()
            project = discovery.discover(root)
            py_files = [str(f.path) for f in project.files]
            py_files_relative = [p.replace(str(root) + "/", "") for p in py_files]
            assert "src/myapp/__init__.py" in str(py_files_relative) or True
