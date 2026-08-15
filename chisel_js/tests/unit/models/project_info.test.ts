import { describe, test, expect } from "bun:test";
import { createProjectInfo } from "chisel/checker/models/project_info";

describe("ProjectInfo", () => {
  test("creates with empty files by default", () => {
    const p = createProjectInfo({ rootPath: "/project" });
    expect({ rootPath: p.rootPath, fileCount: p.files.length, packageName: p.packageName })
      .toEqual({ rootPath: "/project", fileCount: 0, packageName: "" });
  });

  test("stores files when provided", () => {
    const p = createProjectInfo({
      rootPath: "/project",
      packageName: "myapp",
    });
    expect(p.packageName).toBe("myapp");
  });
});
