from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from importlib import metadata
from pathlib import Path
from typing import Callable, Protocol, runtime_checkable
from urllib import request

from chisel.checker.models.self_update import (
    SelfUpdateManager,
    SelfUpdateResult,
    VersionNotice,
)


@runtime_checkable
class ISelfUpdater(Protocol):
    def update(
        self,
        manager: SelfUpdateManager = SelfUpdateManager.AUTO,
        dry_run: bool = False,
    ) -> SelfUpdateResult: ...

    def command_for(self, manager: SelfUpdateManager) -> list[str]: ...

    def version_notice(self) -> VersionNotice | None: ...


@dataclass(slots=True)
class SelfUpdater:
    _package_name: str = "chisel_checker"
    _display_name: str = "Chisel"
    _registry_url: str = "https://pypi.org/pypi/chisel_checker/json"
    _cache_ttl_seconds: int = 86_400
    _cache_dir: Path | None = None
    _latest_fetcher: Callable[[], str] | None = None
    _current_version: str | None = None

    def update(
        self,
        manager: SelfUpdateManager = SelfUpdateManager.AUTO,
        dry_run: bool = False,
    ) -> SelfUpdateResult:
        command = self.command_for(manager)
        if dry_run:
            return SelfUpdateResult(command=command, returncode=0)
        completed = subprocess.run(command, check=False)
        return SelfUpdateResult(command=command, returncode=completed.returncode)

    def command_for(self, manager: SelfUpdateManager) -> list[str]:
        resolved = self._resolve_manager(manager)
        if resolved is SelfUpdateManager.PIPX:
            return ["pipx", "upgrade", self._package_name]
        if resolved is SelfUpdateManager.UV:
            return ["uv", "tool", "upgrade", self._package_name]
        return [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--upgrade",
            self._package_name,
        ]

    def version_notice(self) -> VersionNotice | None:
        current = self._local_version()
        latest = self._cached_latest_version()
        if current == "" or latest == "":
            return None
        if not self._is_newer(latest, current):
            return None
        command = "chisel update self"
        return VersionNotice(
            current_version=current,
            latest_version=latest,
            command=command,
            message=(
                f"{self._display_name} {latest} is available. "
                f"Update with: {command}"
            ),
        )

    def _resolve_manager(self, manager: SelfUpdateManager) -> SelfUpdateManager:
        if manager is not SelfUpdateManager.AUTO:
            return manager
        if self._looks_like_pipx():
            return SelfUpdateManager.PIPX
        if os.environ.get("UV_TOOL_DIR") or os.environ.get("UV_TOOL_BIN_DIR"):
            return SelfUpdateManager.UV
        return SelfUpdateManager.PIP

    def _looks_like_pipx(self) -> bool:
        venv = os.environ.get("PIPX_HOME") or os.environ.get("PIPX_BIN_DIR")
        if venv:
            return True
        executable = Path(sys.executable)
        return "pipx" in executable.parts

    def _local_version(self) -> str:
        if self._current_version is not None:
            return self._current_version
        try:
            return metadata.version(self._package_name)
        except metadata.PackageNotFoundError:
            return ""

    def _cached_latest_version(self) -> str:
        cache_file = self._cache_file()
        cached = self._read_cache(cache_file)
        if cached != "":
            return cached
        try:
            latest = self._fetch_latest_version()
        except Exception:
            return ""
        self._write_cache(cache_file, latest)
        return latest

    def _read_cache(self, cache_file: Path) -> str:
        try:
            data = json.loads(cache_file.read_text(encoding="utf-8"))
            checked_at = float(data.get("checked_at", 0))
            if time.time() - checked_at > self._cache_ttl_seconds:
                return ""
            return str(data.get("latest_version", ""))
        except Exception:
            return ""

    def _write_cache(self, cache_file: Path, latest: str) -> None:
        try:
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            data = {
                "checked_at": time.time(),
                "latest_version": latest,
            }
            cache_file.write_text(json.dumps(data), encoding="utf-8")
        except Exception:
            return

    def _cache_file(self) -> Path:
        if self._cache_dir is not None:
            return self._cache_dir / "version.json"
        root = os.environ.get("XDG_CACHE_HOME")
        if root:
            return Path(root) / "chisel" / "version.json"
        return Path.home() / ".cache" / "chisel" / "version.json"

    def _fetch_latest_version(self) -> str:
        if self._latest_fetcher is not None:
            return self._latest_fetcher()
        with request.urlopen(self._registry_url, timeout=2) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return str(payload.get("info", {}).get("version", ""))

    def _is_newer(self, latest: str, current: str) -> bool:
        latest_parts = self._version_parts(latest)
        current_parts = self._version_parts(current)
        length = max(len(latest_parts), len(current_parts))
        for index in range(length):
            latest_part = latest_parts[index] if index < len(latest_parts) else 0
            current_part = current_parts[index] if index < len(current_parts) else 0
            if latest_part > current_part:
                return True
            if latest_part < current_part:
                return False
        return False

    def _version_parts(self, version: str) -> list[int]:
        parts: list[int] = []
        for raw in version.split("."):
            digits = ""
            for char in raw:
                if char.isdigit():
                    digits += char
                    continue
                break
            if digits == "":
                parts.append(0)
                continue
            parts.append(int(digits))
        return parts
