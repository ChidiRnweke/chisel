import { describe, test, expect } from "bun:test";
import { createProjectInfo } from "chisel/checker/models/project_info";

describe("ProjectInfo", () => {
  test("creates with empty files by default", () => {
    const p = createProjectInfo({ rootPath: "/project" });
    expect(p.rootPath).toBe("/project");
    expect(p.files).toHaveLength(0);
    expect(p.packageName).toBe("");
  });

  test("stores files when provided", () => {
    const p = createProjectInfo({
      rootPath: "/project",
      packageName: "myapp",
    });
    expect(p.packageName).toBe("myapp");
  });
});
