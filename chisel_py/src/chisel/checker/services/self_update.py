from __future__ import annotations

import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, runtime_checkable

from chisel.checker.models.self_update import SelfUpdateManager, SelfUpdateResult


@runtime_checkable
class ISelfUpdater(Protocol):
    def update(
        self,
        manager: SelfUpdateManager = SelfUpdateManager.AUTO,
        dry_run: bool = False,
    ) -> SelfUpdateResult: ...

    def command_for(self, manager: SelfUpdateManager) -> list[str]: ...


@dataclass(slots=True)
class SelfUpdater:
    _package_name: str = "chisel_checker"

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
