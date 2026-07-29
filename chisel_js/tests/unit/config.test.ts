import { describe, test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CONFIG_FILENAME,
  DEFAULT_ALLOW_IN,
  detectMode,
  loadConfig,
  parseConfig,
} from "chisel/checker/config";
import { ConfigError } from "chisel/checker/errors";

/** True when `fn` throws a ConfigError, so a group can assert in one expect. */
function throws(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch (exc) {
    return exc instanceof ConfigError;
  }
}

function withProject(files: Record<string, string>, fn: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "chisel-config-"));
  try {
    for (const [path, content] of Object.entries(files)) {
      const full = join(root, path);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, content);
    }
    fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("parseConfig", () => {
  test("defaults every field", () => {
    expect(parseConfig({})).toEqual({
      mode: "sveltekit-standalone",
      tsconfig: "tsconfig.json",
      ignore: [],
      designSystem: { allowIn: [...DEFAULT_ALLOW_IN] },
    });
  });

  test("reads the fields it supports", () => {
    expect(parseConfig({
      mode: "sveltekit-bff",
      tsconfig: "tsconfig.app.json",
      ignore: ["src/lib/components/edra/**"],
      designSystem: { allowIn: ["src/vendor/"] },
    })).toEqual({
      mode: "sveltekit-bff",
      tsconfig: "tsconfig.app.json",
      ignore: ["src/lib/components/edra/**"],
      designSystem: { allowIn: ["src/vendor/"] },
    });
  });

  test("rejects an unknown mode", () => {
    expect(() => parseConfig({ mode: "nextjs" })).toThrow(ConfigError);
  });

  test("rejects unknown top-level keys rather than ignoring them", () => {
    expect(() => parseConfig({ ruleSets: { "design-system": false } })).toThrow(ConfigError);
  });

  test("names the offending key and says rule sets are not toggleable", () => {
    try {
      parseConfig({ strict: false });
      throw new Error("expected parseConfig to throw");
    } catch (exc) {
      expect({
        namesKey: String(exc).includes("strict"),
        explains: String(exc).includes("cannot be toggled"),
      }).toEqual({ namesKey: true, explains: true });
    }
  });

  test("rejects unknown keys nested under designSystem", () => {
    expect(() => parseConfig({ designSystem: { nativeHtmlBan: { enabled: false } } }))
      .toThrow(ConfigError);
  });

  test("rejects wrongly typed fields", () => {
    expect([
      () => parseConfig({ ignore: "src/**" }),
      () => parseConfig({ tsconfig: 7 }),
      () => parseConfig({ designSystem: [] }),
    ].map(throws)).toEqual([true, true, true]);
  });

  test("rejects a non-object document", () => {
    expect([() => parseConfig([]), () => parseConfig("mode")].map(throws))
      .toEqual([true, true]);
  });
});

describe("detectMode", () => {
  test("detects standalone from a drizzle dependency", () => {
    withProject({ "package.json": '{"dependencies":{"drizzle-orm":"^0.36.0"}}' }, root => {
      const result = detectMode(root);
      expect({
        mode: result.mode,
        ambiguous: result.ambiguous,
        fromDrizzle: result.reasons.join().includes("drizzle-orm"),
      }).toEqual({ mode: "sveltekit-standalone", ambiguous: false, fromDrizzle: true });
    });
  });

  test("detects standalone from a $lib/server directory", () => {
    withProject({ "src/lib/server/db.ts": "export const db = 1;" }, root => {
      expect(detectMode(root).mode).toBe("sveltekit-standalone");
    });
  });

  test("detects bff from openapi-fetch and a generated schema", () => {
    withProject({
      "package.json": '{"dependencies":{"openapi-fetch":"^0.13.0"}}',
      "src/lib/api/schema.d.ts": "export type paths = {};",
    }, root => {
      const result = detectMode(root);
      expect({ mode: result.mode, ambiguous: result.ambiguous })
        .toEqual({ mode: "sveltekit-bff", ambiguous: false });
    });
  });

  test("flags a project carrying signals for both topologies", () => {
    withProject({
      "package.json": '{"dependencies":{"drizzle-orm":"^0.36.0","openapi-fetch":"^0.13.0"}}',
    }, root => {
      const result = detectMode(root);
      expect({
        ambiguous: result.ambiguous,
        mode: result.mode,
        conflict: result.reasons.join().includes("both topologies"),
      }).toEqual({ ambiguous: true, mode: "sveltekit-standalone", conflict: true });
    });
  });

  test("flags a project with no signals at all", () => {
    withProject({ "package.json": "{}" }, root => {
      const result = detectMode(root);
      expect({ ambiguous: result.ambiguous, reasons: result.reasons })
        .toEqual({ ambiguous: true, reasons: ["no topology signals found"] });
    });
  });

  test("survives an unreadable package.json", () => {
    withProject({ "package.json": "{ not json" }, root => {
      expect(detectMode(root).ambiguous).toBe(true);
    });
  });
});

describe("loadConfig", () => {
  test("falls back to detection when no config file exists", () => {
    withProject({ "package.json": '{"dependencies":{"drizzle-orm":"^0.36.0"}}' }, root => {
      const loaded = loadConfig(root);
      expect({ detected: loaded.detected, mode: loaded.config.mode })
        .toEqual({ detected: true, mode: "sveltekit-standalone" });
    });
  });

  test("reads a written config and reports it as not detected", () => {
    withProject({
      [CONFIG_FILENAME]: '{"mode":"sveltekit-bff"}',
      // A drizzle dependency that the written mode must override: once the mode
      // is pinned, dependencies stop influencing it.
      "package.json": '{"dependencies":{"drizzle-orm":"^0.36.0"}}',
    }, root => {
      const loaded = loadConfig(root);
      expect({ detected: loaded.detected, mode: loaded.config.mode })
        .toEqual({ detected: false, mode: "sveltekit-bff" });
    });
  });

  test("reports malformed JSON rather than silently defaulting", () => {
    withProject({ [CONFIG_FILENAME]: "{ mode: }" }, root => {
      expect(() => loadConfig(root)).toThrow(ConfigError);
    });
  });
});
