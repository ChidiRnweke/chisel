import { describe, test, expect } from "bun:test";
import { StructuralSvelteService } from "chisel/checker/services/svelte/structural";
import { createFileInfo } from "chisel/checker/models/file_info";
import { Layer } from "chisel/checker/models/layer";
import { createProjectInfo } from "chisel/checker/models/project_info";

describe("StructuralSvelteService", () => {
  test("detects console.log in ts file", () => {
    const svc = new StructuralSvelteService();
    const file = createFileInfo({
      path: "src/lib/foo.ts",
      layer: Layer.UNKNOWN,
      language: "ts",
      source: 'console.log("hello");\n',
    });
    const project = createProjectInfo({ rootPath: "/test", files: [file] });
    const violations = svc.check(project);
    expect(violations.length).toBe(1);
    expect(violations[0].ruleId).toBe("structural:console-log-banned");
  });

  test("detects console.error in svelte file", () => {
    const svc = new StructuralSvelteService();
    const file = createFileInfo({
      path: "src/routes/+page.svelte",
      layer: Layer.ROUTES,
      language: "svelte",
      source: '<script>console.error("oops");</script>\n',
    });
    const project = createProjectInfo({ rootPath: "/test", files: [file] });
    const violations = svc.check(project);
    expect(violations.length).toBe(1);
    expect(violations[0].ruleId).toBe("structural:console-log-banned");
  });

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
