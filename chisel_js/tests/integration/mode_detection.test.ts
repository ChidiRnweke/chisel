import { describe, test, expect } from "bun:test";
import { loadConfig, detectMode } from "chisel/checker/config";
import { CheckerMode } from "chisel/checker/models/mode";
import { join } from "node:path";

const FIXTURES = join(import.meta.dir, "../../fixtures");

/**
 * Detection against real trees, rather than against a temp directory built to
 * order.
 *
 * The e2e suites pass `defaultConfig(mode)` explicitly so their expectations do
 * not move when detection changes — which leaves detection itself untested
 * against anything resembling a project. These two fixtures are what a user
 * actually points the CLI at, neither carries a `chisel.config.json`, and each
 * must be recognised from its own contents.
 */
describe("mode detection against the specimen trees", () => {
  test("a tree with openapi-fetch and a generated schema is a BFF", () => {
    const { config, detected } = loadConfig(join(FIXTURES, "bff-app"));
    expect({ mode: config.mode, detected }).toEqual({ mode: CheckerMode.BFF, detected: true });
  });

  test("a tree with drizzle and $lib/server is standalone", () => {
    const { config, detected } = loadConfig(join(FIXTURES, "conformant-app"));
    expect({ mode: config.mode, detected })
      .toEqual({ mode: CheckerMode.STANDALONE, detected: true });
  });

  test("detection names the signals it found, so a wrong guess is arguable", () => {
    // Unanimity is the bar: a tree that scores for both modes is ambiguous and
    // falls back rather than picking. The BFF fixture therefore has no
    // src/lib/server/ — that single directory would make it score both ways.
    const { mode, ambiguous, reasons } = detectMode(join(FIXTURES, "bff-app"));
    expect({ mode, ambiguous, reasons: [...reasons].sort() }).toEqual({
      mode: CheckerMode.BFF,
      ambiguous: false,
      reasons: ["a generated src/lib/api/schema.d.ts exists", "openapi-fetch is a dependency"],
    });
  });
});
