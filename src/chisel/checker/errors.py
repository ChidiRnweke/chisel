from __future__ import annotations


class CheckerError(Exception):
    pass


class FileNotFoundError(CheckerError):
    pass


class ImportGraphError(CheckerError):
    pass


class ConfigError(CheckerError):
    pass
