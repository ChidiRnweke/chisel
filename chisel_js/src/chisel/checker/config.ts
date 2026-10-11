import type { CheckerMode } from "chisel/checker/models/mode";
import { CheckerMode as Mode, CHECKER_MODES, isCheckerMode } from "chisel/checker/models/mode";
import { ConfigError } from "chisel/checker/errors";
import { existsSync } from "node:fs";
import type { Json, JsonObject } from "chisel/checker/repositories/json_file";
import { asObject, asStrings, readJsonFile } from "chisel/checker/repositories/json_file";
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
    /**
     * The module every icon comes from, such as `$lib/components/icons`. When
     * set, icon libraries may not be imported anywhere else.
     */
    readonly icons?: string;
    /**
     * The stylesheet that defines the design tokens, such as
     * `src/routes/layout.css`. Token rules (contrast, colour steps) read it.
     */
    readonly tokens?: string;
  };
  /**
   * Process entry points beyond the ones SvelteKit names (hooks, routes,
   * remote functions): a background worker, a seed script. Like a route, they
   * may call controller operations and nothing below them.
   */
  readonly entryPoints: readonly string[];
  readonly agent: {
    /**
     * Folder whose modules turn controller operations into agent tools. A tool
     * is an entry point: it calls one operation and converts its result.
     */
    readonly tools?: string;
    /** The only files that may construct tools from an agent SDK. */
    readonly toolAdapters: readonly string[];
  };
}

const TOP_LEVEL_KEYS = new Set(["mode", "tsconfig", "ignore", "designSystem", "entryPoints", "agent"]);
const DESIGN_SYSTEM_KEYS = new Set(["allowIn", "icons", "tokens"]);
const AGENT_KEYS = new Set(["tools", "toolAdapters"]);

export function defaultConfig(mode: CheckerMode = Mode.STANDALONE): CheckerConfig {
  return Object.freeze({
    mode,
    tsconfig: "tsconfig.json",
    ignore: Object.freeze([]),
    designSystem: Object.freeze({ allowIn: Object.freeze([...DEFAULT_ALLOW_IN]) }),
    entryPoints: Object.freeze([]),
    agent: Object.freeze({ toolAdapters: Object.freeze([]) }),
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

  const read = readJsonFile(path);
  if (read.kind === "failure") {
    throw new ConfigError(`${CONFIG_FILENAME} is not valid JSON: ${read.reason}`);
  }

  return { config: parseConfig(read.value), detected: false };
}

export function parseConfig(raw: Json): CheckerConfig {
  const obj = asObject(raw);
  if (obj === undefined) {
    throw new ConfigError(`${CONFIG_FILENAME} must contain a JSON object.`);
  }

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
  let icons: string | undefined;
  let tokens: string | undefined;
  if (obj.designSystem !== undefined) {
    const ds = readObject(obj.designSystem, "designSystem");
    rejectUnknownKeys(ds, DESIGN_SYSTEM_KEYS, `${CONFIG_FILENAME} "designSystem"`);
    if (ds.allowIn !== undefined) allowIn = readStringArray(ds.allowIn, "designSystem.allowIn");
    icons = readOptionalString(ds.icons, "designSystem.icons");
    tokens = readOptionalString(ds.tokens, "designSystem.tokens");
  }

  const entryPoints = readStringArray(obj.entryPoints, "entryPoints");

  let tools: string | undefined;
  let toolAdapters: string[] = [];
  if (obj.agent !== undefined) {
    const agent = readObject(obj.agent, "agent");
    rejectUnknownKeys(agent, AGENT_KEYS, `${CONFIG_FILENAME} "agent"`);
    tools = readOptionalString(agent.tools, "agent.tools");
    toolAdapters = readStringArray(agent.toolAdapters, "agent.toolAdapters");
  }

  return Object.freeze({
    mode,
    tsconfig,
    ignore: Object.freeze(ignore),
    designSystem: Object.freeze({
      allowIn: Object.freeze(allowIn),
      ...(icons === undefined ? {} : { icons }),
      ...(tokens === undefined ? {} : { tokens }),
    }),
    entryPoints: Object.freeze(entryPoints),
    agent: Object.freeze({
      ...(tools === undefined ? {} : { tools }),
      toolAdapters: Object.freeze(toolAdapters),
    }),
  });
}

function readObject(value: Json, key: string): JsonObject {
  const obj = asObject(value);
  if (obj === undefined) throw new ConfigError(`"${key}" must be an object.`);
  return obj;
}

function readOptionalString(value: Json | undefined, key: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new ConfigError(`"${key}" must be a string.`);
  return value;
}

function rejectUnknownKeys(obj: JsonObject, allowed: ReadonlySet<string>, where: string): void {
  const unknown = Object.keys(obj).filter(k => !allowed.has(k));
  if (unknown.length > 0) {
    throw new ConfigError(
      `Unknown key(s) in ${where}: ${unknown.join(", ")}. `
      + `Expected one of: ${[...allowed].join(", ")}. `
      + `Note that rule sets cannot be toggled from config — chisel's rules are fixed by design.`,
    );
  }
}

function readStringArray(value: Json | undefined, key: string): string[] {
  if (value === undefined) return [];
  const strings = asStrings(value);
  if (strings === undefined || !Array.isArray(value) || strings.length !== value.length) {
    throw new ConfigError(`"${key}" must be an array of strings.`);
  }
  return strings;
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

  const dependencies = readDependencies(rootPath);
  if (dependencies.kind === "failure") {
    return {
      mode: Mode.STANDALONE,
      reasons: [`package.json could not be read (${dependencies.reason}); assumed standalone`],
      ambiguous: true,
    };
  }
  const deps = dependencies.names;
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

type Dependencies =
  | { readonly kind: "read"; readonly names: ReadonlySet<string> }
  | { readonly kind: "failure"; readonly reason: string };

function readDependencies(rootPath: string): Dependencies {
  const path = join(rootPath, "package.json");
  if (!existsSync(path)) return { kind: "read", names: new Set() };
  const read = readJsonFile(path);
  if (read.kind === "failure") return read;
  const pkg = asObject(read.value);
  if (pkg === undefined) return { kind: "failure", reason: "package.json is not a JSON object" };
  const names = new Set<string>();
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    for (const name of Object.keys(asObject(pkg[field]) ?? {})) names.add(name);
  }
  return { kind: "read", names };
}
