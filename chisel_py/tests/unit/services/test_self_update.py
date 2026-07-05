import sys

from chisel.checker.models.self_update import SelfUpdateManager
from chisel.checker.services.self_update import SelfUpdater


class TestSelfUpdater:
    def test_pip_command_uses_current_python(self):
        command = SelfUpdater().command_for(SelfUpdateManager.PIP)
        assert command == [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--upgrade",
            "chisel_checker",
        ]

    def test_pipx_command_upgrades_distribution(self):
        command = SelfUpdater().command_for(SelfUpdateManager.PIPX)
        assert command == ["pipx", "upgrade", "chisel_checker"]

    def test_uv_command_upgrades_tool(self):
        command = SelfUpdater().command_for(SelfUpdateManager.UV)
        assert command == ["uv", "tool", "upgrade", "chisel_checker"]

    def test_dry_run_does_not_execute_subprocess(self):
        result = SelfUpdater().update(SelfUpdateManager.PIPX, dry_run=True)
        assert result.returncode == 0
        assert result.command == ["pipx", "upgrade", "chisel_checker"]
