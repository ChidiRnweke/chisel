import { describe, test, expect } from "bun:test";
import { StructuralSvelteService } from "chisel/checker/services/svelte/structural";
import { createFileInfo } from "chisel/checker/models/file_info";
import { Layer } from "chisel/checker/models/layer";
import { createProjectInfo } from "chisel/checker/models/project_info";

describe("StructuralSvelteService", () => {
  test("does not flag files without console", () => {
    const svc = new StructuralSvelteService();
    const file = createFileInfo({
      path: "src/lib/clean.ts",
      layer: Layer.UNKNOWN,
      language: "ts",
      source: 'const x = 1;\n',
    });
    const project = createProjectInfo({ rootPath: "/test", files: [file] });
    const violations = svc.check(project);
    expect(violations.length).toBe(0);
  });
});
