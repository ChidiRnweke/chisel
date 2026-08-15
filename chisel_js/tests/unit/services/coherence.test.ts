import { describe, test, expect } from "bun:test";
import { CoherenceService } from "chisel/checker/services/shared/coherence";
import { createProjectInfo } from "chisel/checker/models/project_info";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Run the service over a throwaway tree; it reads the filesystem, not ProjectInfo. */
function check(files: Record<string, string>): string[] {
  const root = mkdtempSync(join(tmpdir(), "chisel-coherence-"));
  try {
    for (const [path, source] of Object.entries(files)) {
      mkdirSync(join(root, path, ".."), { recursive: true });
      writeFileSync(join(root, path), source);
    }
    return new CoherenceService()
      .check(createProjectInfo({ rootPath: root }))
      .map(v => v.ruleId);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("coherence — test-runner globs", () => {
  test("a glob matching no files is reported", () => {
    // The suite silently stopped running and CI stayed green.
    expect(check({
      "vitest.config.ts": "export default { test: { include: ['tests/unit/**/*.spec.ts'] } };\n",
      "src/lib/notes.ts": "export const a = 1;\n",
    })).toEqual(["coherence:empty-test-glob"]);
  });

  test("a glob that matches is left alone", () => {
    expect(check({
      "vitest.config.ts": "export default { test: { include: ['src/**/*.spec.ts'] } };\n",
      "src/lib/notes.spec.ts": "export const a = 1;\n",
    })).toEqual([]);
  });

  test("every project's include is checked, not just the first", () => {
    // Nesting is not special-cased, so a five-project config yields all five.
    expect(check({
      "vitest.config.ts":
        "export default { test: { projects: ["
        + "{ test: { include: ['src/**/*.spec.ts'] } },"
        + "{ test: { include: ['tests/e2e/**/*.e2e.ts'] } }"
        + "] } };\n",
      "src/lib/notes.spec.ts": "export const a = 1;\n",
    })).toEqual(["coherence:empty-test-glob"]);
  });

  test("a project without a runner config has nothing to check", () => {
    expect(check({ "src/lib/notes.ts": "export const a = 1;\n" })).toEqual([]);
  });
});

describe("coherence — documentation paths", () => {
  test("a cited path that does not exist is reported", () => {
    expect(check({
      "ARCHITECTURE.md": "The wiring lives in `src/lib/server/application.ts`.\n",
    })).toEqual(["coherence:broken-doc-path"]);
  });

  test("a cited path that exists passes", () => {
    expect(check({
      "ARCHITECTURE.md": "The wiring lives in `src/lib/server/application.ts`.\n",
      "src/lib/server/application.ts": "export const app = 1;\n",
    })).toEqual([]);
  });

  test("docs one level down are maintained too", () => {
    expect(check({
      "docs/TESTING.md": "Fakes live in `src/lib/testing/fakes.ts`.\n",
    })).toEqual(["coherence:broken-doc-path"]);
  });

  test("generated reference output is not maintained by hand", () => {
    expect(check({
      "docs/reference-generated/notes.md": "See `src/lib/gone.ts`.\n",
    })).toEqual([]);
  });

  test("prose about a directory is not a path reference", () => {
    expect(check({
      "README.md": "Application code lives under `src/`, tests under `tests/`.\n",
    })).toEqual([]);
  });
});
