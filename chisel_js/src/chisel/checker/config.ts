import type { CheckerMode } from "chisel/checker/models/mode";
import { CheckerMode as Mode, CHECKER_MODES, isCheckerMode } from "chisel/checker/models/mode";
import { ConfigError } from "chisel/checker/errors";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const CONFIG_FILENAME = "chisel.config.json";

export const DEFAULT_ALLOW_IN: readonly string[] = [
  "src/lib/components/ui/",
  "src/lib/components/primitives/",
];

/**
 * Everything chisel needs to know about a project that it cannot work out for
 * itself.
 *
 * Note what is absent: there are **no rule toggles**. Config carries project
 * facts — which topology this is, where the tsconfig lives, which folders hold
 * vendored or generated code — and nothing that lets a rule be switched off.
 * chisel's opinion is the product; a checker whose rules can be disabled from a
 * config file is a checker that gets disabled. Projects that need different
 * rules should fork.
 *
 * `allowIn` is the one thing that looks like an escape hatch and is not: it
 * names where third-party or generated components live, which is a fact about
 * the repository, and it cannot silence a rule everywhere.
 */
export interface CheckerConfig {
  readonly mode: CheckerMode;
  /** Path to the tsconfig whose `paths` define the project's aliases. */
  readonly tsconfig: string;
  /** Extra glob patterns to exclude from discovery. */
  readonly ignore: readonly string[];
  readonly designSystem: {
    /** Folders exempt from the native-HTML ban: vendored and generated trees. */
    readonly allowIn: readonly string[];
  };
}

const TOP_LEVEL_KEYS = new Set(["mode", "tsconfig", "ignore", "designSystem"]);
const DESIGN_SYSTEM_KEYS = new Set(["allowIn"]);

export function defaultConfig(mode: CheckerMode = Mode.STANDALONE): CheckerConfig {
  return Object.freeze({
    mode,
    tsconfig: "tsconfig.json",
    ignore: Object.freeze([]),
    designSystem: Object.freeze({ allowIn: Object.freeze([...DEFAULT_ALLOW_IN]) }),
  });
}

export interface LoadedConfig {
  readonly config: CheckerConfig;
  /** True when no config file was found and the mode was detected instead. */
  readonly detected: boolean;
}

/**
 * Load `chisel.config.json`, falling back to detection when it is absent.
 *
 * Zero-config has to keep working — requiring `init` before the first `check`
 * would make the tool feel broken on first contact. But the fallback announces
 * itself (`detected: true`) so the CLI can nudge toward pinning the mode, since
 * a detected mode is a guess and a written one is a decision.
 */
export function loadConfig(rootPath: string): LoadedConfig {
  const path = join(rootPath, CONFIG_FILENAME);
  if (!existsSync(path)) {
    return { config: defaultConfig(detectMode(rootPath).mode), detected: true };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf-8"));
  } catch (exc) {
    throw new ConfigError(`${CONFIG_FILENAME} is not valid JSON: ${String(exc)}`);
  }

  return { config: parseConfig(raw), detected: false };
}

export function parseConfig(raw: unknown): CheckerConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ConfigError(`${CONFIG_FILENAME} must contain a JSON object.`);
  }
  const obj = raw as Record<string, unknown>;

  // An unknown key is almost always a typo or a setting from a different tool.
  // Ignoring it silently means the user believes something is configured that
  // is not — strictly worse than a failed run that names the key.
  rejectUnknownKeys(obj, TOP_LEVEL_KEYS, CONFIG_FILENAME);

  const mode = obj.mode ?? Mode.STANDALONE;
  if (!isCheckerMode(mode)) {
    throw new ConfigError(
      `Unknown "mode": ${JSON.stringify(mode)}. Expected one of ${CHECKER_MODES.join(", ")}.`,
    );
  }

  const tsconfig = obj.tsconfig ?? "tsconfig.json";
  if (typeof tsconfig !== "string") {
    throw new ConfigError(`"tsconfig" must be a string path.`);
  }

  const ignore = readStringArray(obj.ignore, "ignore");

  let allowIn = [...DEFAULT_ALLOW_IN];
  if (obj.designSystem !== undefined) {
    if (typeof obj.designSystem !== "object" || obj.designSystem === null || Array.isArray(obj.designSystem)) {
      throw new ConfigError(`"designSystem" must be an object.`);
    }
    const ds = obj.designSystem as Record<string, unknown>;
    rejectUnknownKeys(ds, DESIGN_SYSTEM_KEYS, `${CONFIG_FILENAME} "designSystem"`);
    if (ds.allowIn !== undefined) allowIn = readStringArray(ds.allowIn, "designSystem.allowIn");
  }

  return Object.freeze({
    mode,
    tsconfig,
    ignore: Object.freeze(ignore),
    designSystem: Object.freeze({ allowIn: Object.freeze(allowIn) }),
  });
}

function rejectUnknownKeys(obj: Record<string, unknown>, allowed: ReadonlySet<string>, where: string): void {
  const unknown = Object.keys(obj).filter(k => !allowed.has(k));
  if (unknown.length > 0) {
    throw new ConfigError(
      `Unknown key(s) in ${where}: ${unknown.join(", ")}. `
      + `Expected one of: ${[...allowed].join(", ")}. `
      + `Note that rule sets cannot be toggled from config — chisel's rules are fixed by design.`,
    );
  }
}

function readStringArray(value: unknown, key: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some(v => typeof v !== "string")) {
    throw new ConfigError(`"${key}" must be an array of strings.`);
  }
  return [...(value as string[])];
}

export interface DetectionResult {
  readonly mode: CheckerMode;
  /** Human-readable reasons, shown by `init` so the guess is auditable. */
  readonly reasons: readonly string[];
  /** True when the signals disagreed or were absent and a default was assumed. */
  readonly ambiguous: boolean;
}

/**
 * Guess the project topology from what is on disk.
 *
 * Used by `chisel-js init` to scaffold a config, and as the zero-config
 * fallback. It is deliberately **not** consulted when a config file exists: a
 * rule set that changes because someone added a dependency is a rule set nobody
 * can rely on. Detection scaffolds a decision; it does not keep making it.
 */
export function detectMode(rootPath: string): DetectionResult {
  const standalone: string[] = [];
  const bff: string[] = [];

  const deps = readDependencies(rootPath);
  if (deps.has("drizzle-orm")) standalone.push("drizzle-orm is a dependency");
  if (existsSync(join(rootPath, "src/lib/server"))) standalone.push("src/lib/server/ exists");
  if (deps.has("openapi-fetch")) bff.push("openapi-fetch is a dependency");
  if (existsSync(join(rootPath, "src/lib/api/schema.d.ts"))) {
    bff.push("a generated src/lib/api/schema.d.ts exists");
  }

  if (standalone.length > 0 && bff.length === 0) {
    return { mode: Mode.STANDALONE, reasons: standalone, ambiguous: false };
  }
  if (bff.length > 0 && standalone.length === 0) {
    return { mode: Mode.BFF, reasons: bff, ambiguous: false };
  }

  const reasons = standalone.length === 0 && bff.length === 0
    ? ["no topology signals found"]
    : [`signals for both topologies: ${[...standalone, ...bff].join("; ")}`];
  return { mode: Mode.STANDALONE, reasons, ambiguous: true };
}

function readDependencies(rootPath: string): Set<string> {
  const path = join(rootPath, "package.json");
  if (!existsSync(path)) return new Set();
  try {
    const pkg = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    const names = new Set<string>();
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      const section = pkg[field];
      if (typeof section === "object" && section !== null) {
        for (const name of Object.keys(section)) names.add(name);
      }
    }
    return names;
  } catch {
    return new Set();
  }
}
