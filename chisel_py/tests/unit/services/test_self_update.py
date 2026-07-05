import sys
import tempfile
from pathlib import Path

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

    def test_version_notice_returns_message_for_newer_version(self):
        with tempfile.TemporaryDirectory() as tmp:
            updater = SelfUpdater(
                _cache_dir=Path(tmp),
                _latest_fetcher=lambda: "0.2.1",
                _current_version="0.2.0",
            )
            notice = updater.version_notice()
            assert notice is not None and notice.message == (
                "Chisel 0.2.1 is available. Update with: chisel update self"
            )

    def test_version_notice_skips_equal_version(self):
        with tempfile.TemporaryDirectory() as tmp:
            updater = SelfUpdater(
                _cache_dir=Path(tmp),
                _latest_fetcher=lambda: "0.2.0",
                _current_version="0.2.0",
            )
            assert updater.version_notice() is None

    def test_version_notice_uses_cached_latest_version(self):
        with tempfile.TemporaryDirectory() as tmp:
            cache_file = Path(tmp) / "version.json"
            cache_file.write_text(
                '{"checked_at": 99999999999, "latest_version": "0.2.2"}',
                encoding="utf-8",
            )
            updater = SelfUpdater(
                _cache_dir=Path(tmp),
                _latest_fetcher=lambda: "0.2.1",
                _current_version="0.2.0",
            )
            notice = updater.version_notice()
            assert notice is not None and notice.latest_version == "0.2.2"

    def test_version_notice_silently_skips_registry_failure(self):
        def fail() -> str:
            raise RuntimeError("offline")

        with tempfile.TemporaryDirectory() as tmp:
            updater = SelfUpdater(
                _cache_dir=Path(tmp),
                _latest_fetcher=fail,
                _current_version="0.2.0",
            )
            assert updater.version_notice() is None
