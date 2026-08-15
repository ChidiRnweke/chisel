import { describe, test, expect } from "bun:test";
import {
  BuildOutputMissingError,
  BundleBudgetService,
  CHUNK_BUDGET_BYTES,
  CLIENT_OUTPUT_DIR,
} from "chisel/checker/services/build/bundle_budget";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Build a throwaway client output tree; each chunk is padded past the budget. */
function analyse(chunks: Record<string, { body: string; oversized: boolean }>) {
  const root = mkdtempSync(join(tmpdir(), "chisel-bundle-"));
  try {
    const outputDir = join(root, CLIENT_OUTPUT_DIR, "_app", "immutable");
    mkdirSync(outputDir, { recursive: true });
    for (const [name, chunk] of Object.entries(chunks)) {
      const padding = chunk.oversized ? "/*".padEnd(CHUNK_BUDGET_BYTES + 1, "x") + "*/" : "";
      writeFileSync(join(outputDir, name), chunk.body + padding);
    }
    return new BundleBudgetService().analyse(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("bundle budget", () => {
  test("an oversized chunk carrying application code is reported", () => {
    const report = analyse({
      "app.js": { body: "// from /src/lib/components/notes/editor.svelte\n", oversized: true },
    });
    expect(report.violations.map(v => v.ruleId)).toEqual(["bundle:oversized-app-chunk"]);
  });

  test("an oversized vendor-only chunk is tolerated as a known cost", () => {
    // A statically imported diagramming library is large no matter how
    // disciplined the application is; only application creep is a regression.
    const report = analyse({
      "vendor.js": { body: "// from /node_modules/mermaid/dist/mermaid.js\n", oversized: true },
    });
    expect({
      violations: report.violations.length,
      tolerated: report.vendorChunksTolerated,
    }).toEqual({ violations: 0, tolerated: 1 });
  });

  test("a chunk within the budget is not inspected for ownership", () => {
    const report = analyse({
      "small.js": { body: "// from /src/lib/app.ts\n", oversized: false },
    });
    expect(report.violations).toEqual([]);
  });

  test("a project that has not been built is an error, not a pass", () => {
    const root = mkdtempSync(join(tmpdir(), "chisel-bundle-"));
    try {
      expect(() => new BundleBudgetService().analyse(root)).toThrow(BuildOutputMissingError);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
