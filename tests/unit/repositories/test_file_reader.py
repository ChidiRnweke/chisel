from __future__ import annotations

import tempfile
from pathlib import Path

from chisel.checker.repositories.file_reader import FileReader


class TestFileReader:
    def test_reads_file_content(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write("x = 1\n")
            f.flush()
            reader = FileReader()
            content = reader.read(Path(f.name))
            assert content == "x = 1\n"
