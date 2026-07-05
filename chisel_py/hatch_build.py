from __future__ import annotations

from pathlib import Path

from hatchling.builders.hooks.plugin.interface import BuildHookInterface


class SkillsBuildHook(BuildHookInterface):
    PLUGIN_NAME = "skills"

    def initialize(self, version: str, build_data: dict) -> None:
        root = Path(self.root)
        source = root / "skills"  # already embedded (building from an sdist)
        if not source.is_dir():
            source = root.parent / "skills"  # sibling dir in the monorepo checkout
        if not source.is_dir():
            raise FileNotFoundError(f"Bundled Chisel skills not found near {root}")

        destination = (
            "skills" if self.target_name == "sdist" else "src/chisel/bundled_skills"
        )
        build_data.setdefault("force_include", {})[str(source)] = destination
