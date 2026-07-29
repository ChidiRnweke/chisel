import type { CheckerConfig } from "chisel/checker/config";
import type { CheckerMode } from "chisel/checker/models/mode";
import { CONFIG_FILENAME, DEFAULT_ALLOW_IN, defaultConfig, detectMode } from "chisel/checker/config";
import { ConfigError } from "chisel/checker/errors";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Component folders that are conventionally vendored or generated. */
const VENDORED_HINTS = ["ui", "primitives", "vendor", "generated"];

export interface InitResult {
  readonly configPath: string;
  readonly config: CheckerConfig;
  readonly mode: CheckerMode;
  readonly detectionReasons: readonly string[];
  readonly ambiguous: boolean;
  readonly written: boolean;
}

export class InitController {
  /**
   * Scaffold `chisel.config.json`.
   *
   * This is the only place topology detection influences anything. Writing the
   * mode down converts a guess into a decision: from here on `check` reads the
   * file, so adding a dependency can never quietly change which rules run.
   */
  init(
    projectPath: string,
    options: { mode?: CheckerMode; overwrite?: boolean; dryRun?: boolean } = {},
  ): InitResult {
    const configPath = join(projectPath, CONFIG_FILENAME);
    if (existsSync(configPath) && options.overwrite !== true && options.dryRun !== true) {
      throw new ConfigError(
        `${CONFIG_FILENAME} already exists. Pass --overwrite to replace it.`,
      );
    }

    const detection = detectMode(projectPath);
    const mode = options.mode ?? detection.mode;

    const config: CheckerConfig = {
      ...defaultConfig(mode),
      designSystem: { allowIn: seedAllowIn(projectPath) },
    };

    const written = options.dryRun !== true;
    if (written) writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

    return {
      configPath,
      config,
      mode,
      // When the mode was given explicitly, detection did not decide anything.
      detectionReasons: options.mode === undefined ? detection.reasons : [],
      ambiguous: options.mode === undefined && detection.ambiguous,
      written,
    };
  }
}

/**
 * Seed the design-system exemption list from folders that actually exist.
 *
 * Vendored and generated component trees are full of raw HTML by nature, and a
 * ban that drowns them in violations gets the whole rule set switched off. The
 * defaults are always included so the list reads the same across projects.
 */
function seedAllowIn(projectPath: string): readonly string[] {
  const componentsDir = join(projectPath, "src/lib/components");
  const found = new Set<string>(DEFAULT_ALLOW_IN);

  let entries: string[];
  try {
    entries = readdirSync(componentsDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch {
    return [...found];
  }

  for (const name of entries) {
    if (VENDORED_HINTS.includes(name.toLowerCase())) {
      found.add(`src/lib/components/${name}/`);
    }
  }

  return [...found].sort();
}
