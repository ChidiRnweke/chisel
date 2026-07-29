import { describe, test, expect } from "bun:test";
import { createFileInfo } from "chisel/checker/models/file_info";
import { Layer } from "chisel/checker/models/layer";

describe("FileInfo", () => {
  test("creates with required fields", () => {
    const f = createFileInfo({
      path: "src/routes/users.ts",
      layer: Layer.ROUTES,
      language: "ts",
    });
    expect(f.path).toBe("src/routes/users.ts");
    expect(f.layer).toBe(Layer.ROUTES);
    expect(f.language).toBe("ts");
    expect(f.source).toBe("");
  });

  test("stores source when provided", () => {
    const f = createFileInfo({
      path: "src/app.ts",
      layer: Layer.CONFIG,
      language: "ts",
      source: "console.log('hi')",
    });
    expect(f.source).toBe("console.log('hi')");
  });
});
