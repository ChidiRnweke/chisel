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
      const svelteFiles = project.files.filter(f => f.path.endsWith(".svelte"));
      const tsFiles = project.files.filter(f => f.path.endsWith(".ts"));
      expect({ svelte: svelteFiles.length, ts: tsFiles.length }).toEqual({ svelte: 1, ts: 1 });
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

  test("ignores build/, dist/, .svelte-kit/, and other generated dirs", async () => {
    const discovery = new FileDiscovery();
    const dir = import.meta.dir + "/__fixtures_ignore__";
    const fs = await import("node:fs/promises");
    await fs.mkdir(dir + "/build/routes", { recursive: true });
    await fs.mkdir(dir + "/coverage", { recursive: true });
    await fs.mkdir(dir + "/.svelte-kit/generated", { recursive: true });
    await fs.mkdir(dir + "/src/lib", { recursive: true });
    await fs.writeFile(dir + "/build/routes/_page.svelte", "<script>console.log('gen')</script>");
    await fs.writeFile(dir + "/coverage/summary.svelte", "<div></div>");
    await fs.writeFile(dir + "/.svelte-kit/generated/x.svelte", "<div></div>");
    await fs.writeFile(dir + "/src/lib/Real.svelte", "<div></div>");

    try {
      const project = await discovery.discover(dir);
      const paths = project.files.map(f => f.path);
      expect({
        hasReal: paths.includes("src/lib/Real.svelte"),
        hasBuild: paths.some((p: string) => p.includes("build/")),
        hasCoverage: paths.some((p: string) => p.includes("coverage/")),
        hasSvelteKit: paths.some((p: string) => p.includes(".svelte-kit/")),
      }).toEqual({ hasReal: true, hasBuild: false, hasCoverage: false, hasSvelteKit: false });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("broadens factory recognition for *Factory.ts and /factories/ paths", async () => {
    const discovery = new FileDiscovery();
    const dir = import.meta.dir + "/__fixtures_factory__";
    const fs = await import("node:fs/promises");
    await fs.mkdir(dir + "/src/lib/factories", { recursive: true });
    await fs.mkdir(dir + "/src/lib/server", { recursive: true });
    await fs.mkdir(dir + "/src/lib/services", { recursive: true });
    await fs.writeFile(dir + "/src/lib/factories/AppFactory.ts", "export class AppFactory {}");
    await fs.writeFile(dir + "/src/lib/server/ServerFactory.ts", "export class ServerFactory {}");
    await fs.writeFile(dir + "/src/lib/services/ChatService.ts", "export class ChatService {}");

    try {
      const project = await discovery.discover(dir);
      const factories = project.files.filter(f => f.layer === "factory");
      const services = project.files.filter(f => f.layer === "services");
      expect({
        factoryPaths: new Set(factories.map(f => f.path)),
        servicePaths: services.map(f => f.path),
      }).toEqual({
        factoryPaths: new Set([
          "src/lib/factories/AppFactory.ts",
          "src/lib/server/ServerFactory.ts",
        ]),
        servicePaths: ["src/lib/services/ChatService.ts"],
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  test("normalises relative paths so test-structure sees leading tests/unit/", async () => {
    const discovery = new FileDiscovery();
    const dir = import.meta.dir + "/__fixtures_normal__";
    const fs = await import("node:fs/promises");
    await fs.mkdir(dir + "/tests/unit/services", { recursive: true });
    await fs.writeFile(dir + "/tests/unit/services/ChatService.test.ts", "import { test } from 'bun:test';");

    try {
      const project = await discovery.discover(dir);
      const testFile = project.files.find(f => f.path.endsWith("ChatService.test.ts"));
      expect({
        path: testFile?.path,
        startsWith: testFile?.path.startsWith("tests/unit/"),
      }).toEqual({
        path: "tests/unit/services/ChatService.test.ts",
        startsWith: true,
      });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
