/** Base class for every error chisel raises deliberately. */
export class CheckerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The import graph could not be built for the target project. */
export class ImportGraphError extends CheckerError {}

/** `chisel.config.json` is missing, malformed, or carries unknown keys. */
export class ConfigError extends CheckerError {}
