import { describe, test, expect } from "bun:test";
import { ImportGraph } from "chisel/checker/repositories/import_graph";
import { ImportBoundaryService } from "chisel/checker/services/architecture/import_boundary";
import { ServerLayerLeakService } from "chisel/checker/services/architecture/server_layer_leak";
import { classifyFile } from "chisel/checker/repositories/file_discovery";
import { createFileInfo } from "chisel/checker/models/file_info";
import { createProjectInfo } from "chisel/checker/models/project_info";
import { isServerContext, isServerOnlyModule, Layer } from "chisel/checker/models/layer";
import { FakeImportGraph, edge } from "../fakes/fake_import_graph";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * False positives found by running the checker against a large real SvelteKit
 * app. Every case here was the checker being wrong, not the repo — the first
 * run produced 1215 violations, of which 726 were noise from these seven bugs.
 */

function graphFor(files: Record<string, string>, tsconfig?: string): ImportGraph {
  const root = mkdtempSync(join(tmpdir(), "chisel-regress-"));
  try {
    writeFileSync(join(root, "tsconfig.json"), tsconfig
      ?? '{"compilerOptions":{"baseUrl":".","paths":{"$lib":["src/lib"],"$lib/*":["src/lib/*"]}}}');
    const infos = [];
    for (const [path, source] of Object.entries(files)) {
      const full = join(root, path);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, source);
      infos.push(createFileInfo({
        path,
        layer: classifyFile(path).layer,
        language: path.endsWith(".svelte") ? "svelte" : "ts",
        source,
      }));
    }
    const graph = new ImportGraph();
    graph.build(createProjectInfo({ rootPath: root, files: infos }));
    return graph;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("resolver: TypeScript's .js-means-.ts convention", () => {
  test("a .js specifier resolves to the .ts file it compiles from", () => {
    // Projects using `rewriteRelativeImportExtensions` or NodeNext write every
    // relative import this way. Not handling it made 435 of 1215 violations.
    const graph = graphFor({
      "src/lib/utils.ts": "export const a = 1;",
      "src/lib/stores/x.svelte.ts": 'import { a } from "$lib/utils.js";\nexport const b = a;',
    });
    const found = graph.allImports.find(e => e.specifier === "$lib/utils.js");
    expect({ imported: found?.imported, resolved: found?.resolved })
      .toEqual({ imported: "src/lib/utils.ts", resolved: true });
  });

  test("a .svelte.js specifier resolves to the .svelte.ts source", () => {
    const graph = graphFor({
      "src/lib/components/ui/sidebar/context.svelte.ts": "export const ctx = 1;",
      "src/lib/components/ui/sidebar/x.ts":
        'import { ctx } from "./context.svelte.js";\nexport const y = ctx;',
    });
    expect(graph.unresolved).toEqual([]);
  });

  test("a relative .js specifier resolves the same way", () => {
    const graph = graphFor({
      "src/lib/client/a.ts": "export const a = 1;",
      "src/lib/client/b.ts": 'import { a } from "./a.js";\nexport const b = a;',
    });
    expect(graph.allImports[0]?.imported).toBe("src/lib/client/a.ts");
  });
});

describe("resolver: SvelteKit generated modules", () => {
  test("./$types is generated, not dangling", () => {
    // It lives in .svelte-kit/types/, so probing the route directory fails.
    const graph = graphFor({
      "src/routes/notes/+page.server.ts":
        'import type { PageServerLoad } from "./$types";\nexport const load: PageServerLoad = () => ({});',
    });
    expect(graph.unresolved).toEqual([]);
  });
});

describe("layers: what counts as server-only", () => {
  test("a +server.ts API endpoint is a server context", () => {
    // It carries no dotted `.server.` marker but is server-only all the same.
    expect({
      target: isServerOnlyModule("src/routes/api/x/+server.ts"),
      importer: isServerContext("src/routes/api/x/+server.ts"),
    }).toEqual({ target: true, importer: true });
  });

  test("a *.remote.ts may import server code but is not itself a leak target", () => {
    // SvelteKit generates a fetch stub for it, so components may import it.
    expect({
      target: isServerOnlyModule("src/lib/remote/notes.remote.ts"),
      importer: isServerContext("src/lib/remote/notes.remote.ts"),
    }).toEqual({ target: false, importer: true });
  });
});

describe("boundaries: remote functions are the client's way in", () => {
  test("a component may call a remote function", () => {
    const graph = new FakeImportGraph();
    graph.setEdges([edge({
      importer: "src/lib/components/app/card.svelte",
      imported: "src/lib/remote/notes.remote.ts",
    })]);
    const project = createProjectInfo({
      rootPath: "/app",
      files: [
        createFileInfo({ path: "src/lib/components/app/card.svelte", layer: Layer.COMPONENTS, language: "svelte" }),
        createFileInfo({ path: "src/lib/remote/notes.remote.ts", layer: Layer.REMOTE, language: "ts" }),
      ],
    });
    expect({
      boundary: new ImportBoundaryService(graph).check(project),
      leak: new ServerLayerLeakService(graph).check(project),
    }).toEqual({ boundary: [], leak: [] });
  });
});

describe("boundaries: layers with no architectural intent", () => {
  function check(importerPath: string, layer: Layer, imported: string, isInternal = true) {
    const graph = new FakeImportGraph();
    graph.setEdges([edge({ importer: importerPath, imported, isInternal })]);
    const project = createProjectInfo({
      rootPath: "/app",
      files: [
        createFileInfo({ path: importerPath, layer, language: "ts" }),
        createFileInfo({ path: imported, layer: Layer.REPOSITORIES, language: "ts" }),
      ],
    });
    return {
      boundary: new ImportBoundaryService(graph).check(project),
      leak: new ServerLayerLeakService(graph).check(project),
    };
  }

  test("a migration script may open a database", () => {
    expect(check("scripts/migrate.js", Layer.UNKNOWN, "drizzle-orm/postgres-js", false))
      .toEqual({ boundary: [], leak: [] });
  });

  test("a test may import a server module", () => {
    expect(check("src/evals/lab/app.ts", Layer.TESTS, "src/lib/server/app-factory.ts"))
      .toEqual({ boundary: [], leak: [] });
  });

  test("in-src test doubles classify as tests, not as stray client modules", () => {
    expect(classifyFile("src/lib/testing/fakes/in-memory-notes.ts"))
      .toEqual({ layer: Layer.TESTS, classified: true });
  });
});

describe("classification: a layer split across two locations", () => {
  test("universal repository interfaces belong to the repositories layer", () => {
    // Interfaces at src/lib/repositories/ with adapters under $lib/server is a
    // common split. Treating the universal half as a stray made every service
    // that depends on an interface look like it was importing client code.
    expect({
      interfaces: classifyFile("src/lib/repositories/index.ts").layer,
      adapters: classifyFile("src/lib/server/repositories/postgres-notes.ts").layer,
    }).toEqual({ interfaces: Layer.REPOSITORIES, adapters: Layer.REPOSITORIES });
  });

  test("a service may depend on a repository interface", () => {
    const graph = new FakeImportGraph();
    graph.setEdges([edge({
      importer: "src/lib/services/notes/management.ts",
      imported: "src/lib/repositories/index.ts",
    })]);
    const project = createProjectInfo({
      rootPath: "/app",
      files: [
        createFileInfo({ path: "src/lib/services/notes/management.ts", layer: Layer.SERVICES, language: "ts" }),
        createFileInfo({ path: "src/lib/repositories/index.ts", layer: Layer.REPOSITORIES, language: "ts" }),
      ],
    });
    expect(new ImportBoundaryService(graph).check(project)).toEqual([]);
  });
});

describe("boundaries: barrel files are a layer's public surface", () => {
  function barrelCheck(importer: string, imported: string) {
    const graph = new FakeImportGraph();
    graph.setEdges([edge({ importer, imported })]);
    const project = createProjectInfo({
      rootPath: "/app",
      files: [
        createFileInfo({ path: importer, layer: Layer.SERVICES, language: "ts" }),
        createFileInfo({ path: imported, layer: Layer.SERVICES, language: "ts" }),
      ],
    });
    return new ImportBoundaryService(graph).check(project).map(v => v.ruleId);
  }

  test("a layer-root index.ts may re-export its own modules", () => {
    expect(barrelCheck("src/lib/services/index.ts", "src/lib/services/notes/management.ts"))
      .toEqual([]);
  });

  test("but one service still may not import another", () => {
    expect(barrelCheck("src/lib/services/notes/management.ts", "src/lib/services/agent/runs.ts"))
      .toEqual(["import-boundary:banned-layer-import"]);
  });
});
