
from dataclasses import dataclass, field

from chisel.checker.models.import_edge import ImportEdge
from chisel.checker.models.layer import Layer


@dataclass(slots=True)
class FakeImportGraph:
    _edges: list[ImportEdge] = field(default_factory=list)
    _layer_map: dict[str, Layer] = field(default_factory=dict)

    def build(self, *args: object, **kwargs: object) -> None:
        return

    @property
    def all_imports(self) -> list[ImportEdge]:
        return list(self._edges)

    def module_layer(self, module_name: str, package_name: str) -> Layer | None:
        return self._layer_map.get(module_name)

    def set_edges(self, edges: list[ImportEdge]) -> None:
        self._edges = list(edges)

    def set_layers(self, module_name: str, layer: Layer) -> None:
        self._layer_map[module_name] = layer
