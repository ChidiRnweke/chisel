import tempfile
from pathlib import Path

from chisel.checker.models.layer import Layer
from chisel.checker.repositories.file_discovery import FileDiscovery


class TestDiscoversSrcLayoutProject:
    def test_finds_package_name_from_src_layout(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src" / "myapp" / "__init__.py").parent.mkdir(parents=True)
            (root / "src" / "myapp" / "__init__.py").write_text("")
            discovery = FileDiscovery()
            project = discovery.discover(root)
            assert project.package_name == "myapp"

    def test_finds_python_files_in_src_layout(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src" / "myapp" / "__init__.py").parent.mkdir(parents=True)
            (root / "src" / "myapp" / "__init__.py").write_text("")
            (root / "src" / "myapp" / "models").mkdir()
            (root / "src" / "myapp" / "models" / "__init__.py").write_text("")
            (root / "src" / "myapp" / "models" / "user.py").write_text("")
            discovery = FileDiscovery()
            project = discovery.discover(root)
            py_paths = [str(f.path) for f in project.files]
            assert any("models/user.py" in p for p in py_paths)


class TestDiscoversFlatLayoutProject:
    def test_finds_package_name_from_flat_layout(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "myapp" / "__init__.py").parent.mkdir(parents=True)
            (root / "myapp" / "__init__.py").write_text("")
            discovery = FileDiscovery()
            project = discovery.discover(root)
            assert project.package_name == "myapp"

    def test_finds_files_in_flat_layout(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "myapp" / "__init__.py").parent.mkdir(parents=True)
            (root / "myapp" / "__init__.py").write_text("")
            (root / "myapp" / "models").mkdir()
            (root / "myapp" / "models" / "user.py").write_text("")
            discovery = FileDiscovery()
            project = discovery.discover(root)
            assert project.files_checked >= 1 if hasattr(project, "files_checked") else len(project.files) >= 1

    def test_classifies_flat_layout_layers_correctly(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "myapp" / "__init__.py").parent.mkdir(parents=True)
            (root / "myapp" / "__init__.py").write_text("")
            (root / "myapp" / "models").mkdir()
            (root / "myapp" / "models" / "user.py").write_text("")
            discovery = FileDiscovery()
            project = discovery.discover(root)
            layer_found = any(f.layer == Layer.MODELS for f in project.files)
            assert layer_found

    def test_classifies_singular_repository_directory_as_repositories_layer(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "myapp" / "repository").mkdir(parents=True)
            (root / "myapp" / "__init__.py").write_text("")
            (root / "myapp" / "repository" / "repo_repository.py").write_text("")
            discovery = FileDiscovery()
            project = discovery.discover(root)
            layer_found = any(
                f.layer == Layer.REPOSITORIES
                and str(f.path).endswith("repository/repo_repository.py")
                for f in project.files
            )
            assert layer_found

    def test_classifies_src_singular_repository_directory_as_repositories_layer(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "src" / "myapp" / "repository").mkdir(parents=True)
            (root / "src" / "myapp" / "__init__.py").write_text("")
            (root / "src" / "myapp" / "repository" / "health_repository.py").write_text(
                ""
            )
            discovery = FileDiscovery()
            project = discovery.discover(root)
            layer_found = any(
                f.layer == Layer.REPOSITORIES
                and str(f.path).endswith("repository/health_repository.py")
                for f in project.files
            )
            assert layer_found

    def test_ignores_tests_and_venv_as_package_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "tests" / "__init__.py").parent.mkdir(parents=True)
            (root / "tests" / "__init__.py").write_text("")
            (root / "venv" / "__init__.py").parent.mkdir(parents=True)
            (root / "venv" / "__init__.py").write_text("")
            discovery = FileDiscovery()
            project = discovery.discover(root)
            assert project.package_name == ""
