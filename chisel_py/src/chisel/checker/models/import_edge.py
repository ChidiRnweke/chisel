
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ImportEdge:
    importer: str
    imported: str
    line_number: int
    line_contents: str
