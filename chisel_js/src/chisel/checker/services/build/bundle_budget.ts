import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { RuleInfo } from "chisel/checker/rule_metadata";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

/** Vite's own warning threshold. It warns here; nothing makes it fail. */
export const CHUNK_BUDGET_BYTES = 500 * 1024;

/** Where SvelteKit writes the chunks the browser will download. */
export const CLIENT_OUTPUT_DIR = join(".svelte-kit", "output", "client");

export class BuildOutputMissingError extends Error {}

export interface BundleReport {
  readonly violations: readonly Violation[];
  /** Oversized chunks tolerated because they carry no application code. */
  readonly vendorChunksTolerated: number;
  readonly chunksInspected: number;
}

/**
 * Fails when an application-owned chunk exceeds the budget.
 *
 * The subtlety is telling a regression from a known cost. A statically imported
 * diagramming or editor library produces one enormous chunk that no amount of
 * application discipline will shrink; application code creeping into a big
 * chunk is a different thing entirely, and only the second should fail. The
 * discriminator is whether the chunk's sourcemap-ish text mentions the
 * application tree at all.
 */
export class BundleBudgetService {
  readonly ruleIdPrefix = "bundle";

  /** @throws BuildOutputMissingError when the project has not been built. */
  analyse(rootPath: string): BundleReport {
    const outputDir = join(rootPath, CLIENT_OUTPUT_DIR);
    if (!existsSync(outputDir)) {
      throw new BuildOutputMissingError(
        `No client build output at ${CLIENT_OUTPUT_DIR}. Run a production build first — `
        + `this reads what the browser would actually download, which only exists after `
        + `the bundler has run.`,
      );
    }

    const violations: Violation[] = [];
    let vendorChunksTolerated = 0;
    let chunksInspected = 0;

    for (const chunk of this._chunks(outputDir)) {
      chunksInspected += 1;
      const bytes = statSync(chunk).size;
      if (bytes <= CHUNK_BUDGET_BYTES) continue;

      const path = relative(rootPath, chunk).replace(/\\/g, "/");
      if (!this._containsApplicationCode(chunk)) {
        vendorChunksTolerated += 1;
        continue;
      }

      violations.push(createViolation({
        file: path,
        line: 1,
        severity: Severity.ERROR,
        ruleId: `${this.ruleIdPrefix}:oversized-app-chunk`,
        message:
          `${(bytes / 1024).toFixed(1)} kB of application code in one chunk, over the `
          + `${CHUNK_BUDGET_BYTES / 1024} kB budget. Split the route, or load the heavy part `
          + `dynamically. The bundler only warns about this, and a warning nobody can fail `
          + `on is how a bundle grows in one direction forever.`,
      }));
    }

    return { violations, vendorChunksTolerated, chunksInspected };
  }

  /**
   * Whether a chunk carries application code.
   *
   * Application modules are authored under `src/`; a dependency's are not. A
   * chunk referencing neither is treated as application code, because the
   * conservative direction here is to report.
   */
  private _containsApplicationCode(chunk: string): boolean {
    let source: string;
    try {
      source = readFileSync(chunk, "utf-8");
    } catch {
      return true;
    }
    if (/[\\/]src[\\/]/.test(source)) return true;
    return !/node_modules/.test(source);
  }

  private _chunks(directory: string, found: string[] = []): string[] {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return found;
    }

    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) this._chunks(path, found);
      else if (entry.name.endsWith(".js")) found.push(path);
    }
    return found;
  }

  describeRules(): RuleInfo[] {
    return [
      {
        id: "bundle:oversized-app-chunk",
        category: this.ruleIdPrefix,
        description: "A client chunk containing application code exceeds the size budget",
        fixGuidance:
          "Split the route or import the heavy part dynamically. Vendor-only chunks are "
          + "tolerated as a known cost; a chunk mixing application code is a regression. "
          + "Requires a production build — run `chisel-js bundle` after building.",
      },
    ];
  }
}
