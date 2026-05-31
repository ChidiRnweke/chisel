from __future__ import annotations

from chisel.checker.models.import_edge import ImportEdge
from chisel.checker.models.layer import Layer
from tests.fakes.fake_import_graph import FakeImportGraph


class TestFakeImportGraph:
    def test_all_imports_returns_set_edges(self):
        graph = FakeImportGraph()
        edge = ImportEdge(
            importer="myapp.foo", imported="myapp.bar",
            line_number=1, line_contents="import bar",
        )
        graph.set_edges([edge])
        assert len(graph.all_imports) == 1

    def test_module_layer_returns_set_layer(self):
        graph = FakeImportGraph()
        graph.set_layers("myapp.services.foo", Layer.SERVICES)
        assert graph.module_layer("myapp.services.foo", "myapp") == Layer.SERVICES

    def test_module_layer_returns_none_for_unknown_module(self):
        graph = FakeImportGraph()
        assert graph.module_layer("unknown", "myapp") is None
