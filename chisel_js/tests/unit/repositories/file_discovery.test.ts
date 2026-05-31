import { describe, test, expect } from "bun:test";
import { FileDiscovery } from "chisel/checker/repositories/file_discovery";

describe("FileDiscovery", () => {
  test("discovers ts and svelte files", async () => {
    const discovery = new FileDiscovery();
    const dir = import.meta.dir + "/__fixtures__";
    
    // Create test fixtures
    const fs = await import("node:fs/promises");
    await fs.mkdir(dir + "/src/app/src/routes", { recursive: true });
    await fs.writeFile(dir + "/src/app/src/routes/+page.svelte", "<script>console.log('hi')</script>\n");
    await fs.writeFile(dir + "/src/app/src/routes/+page.server.ts", "export const load = () => ({})");
    
    try {
      const project = await discovery.discover(dir);
      expect(project.files.length).toBeGreaterThanOrEqual(2);
      const svelteFiles = project.files.filter(f => f.path.endsWith(".svelte"));
      const tsFiles = project.files.filter(f => f.path.endsWith(".ts"));
      expect(svelteFiles.length).toBe(1);
      expect(tsFiles.length).toBe(1);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("classifies test files correctly", async () => {
    const discovery = new FileDiscovery();
    const dir = import.meta.dir + "/__fixtures2__";
    
    const fs = await import("node:fs/promises");
    await fs.mkdir(dir + "/tests/unit/models", { recursive: true });
    await fs.writeFile(dir + "/tests/unit/models/severity.test.ts", "import { test } from 'bun:test';");
    
    try {
      const project = await discovery.discover(dir);
      const tests = project.files.filter(f => f.path.includes("tests/"));
      expect(tests.length).toBe(1);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
