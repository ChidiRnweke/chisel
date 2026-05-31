from __future__ import annotations

import pytest

from tests.fakes.fake_import_graph import FakeImportGraph


@pytest.fixture
def fake_import_graph() -> FakeImportGraph:
    return FakeImportGraph()
