import { describe, test, expect, beforeAll } from "bun:test";
import type { ImportEdge } from "chisel/checker/models/import_edge";
import { FileDiscovery } from "chisel/checker/repositories/file_discovery";
import { ImportGraph } from "chisel/checker/repositories/import_graph";
import { createFileInfo } from "chisel/checker/models/file_info";
import { createProjectInfo } from "chisel/checker/models/project_info";
import { Layer } from "chisel/checker/models/layer";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURE = join(import.meta.dir, "../../fixtures/standalone-app");

let edges: readonly ImportEdge[];

function from(importer: string): ImportEdge[] {
  return edges.filter(e => e.importer === importer);
}

function edgeTo(importer: string, specifier: string): ImportEdge | undefined {
  return edges.find(e => e.importer === importer && e.specifier === specifier);
}

beforeAll(async () => {
  const discovery = new FileDiscovery();
  const discovered = await discovery.discover(FIXTURE);
  const withSource = discovered.files.map(f =>
    createFileInfo({ ...f, source: readFileSync(join(FIXTURE, f.path), "utf-8") }),
  );
  const graph = new ImportGraph();
  graph.build(createProjectInfo({ ...discovered, files: withSource }));
  edges = graph.allImports;
});

describe("ImportGraph — resolution", () => {
  test("resolves $lib aliases to real repo-relative paths", () => {
    const found = edgeTo("src/lib/server/repositories/postgres-notes.ts", "$lib/server/db/schema");
    expect({
      imported: found?.imported,
      isInternal: found?.isInternal,
      resolved: found?.resolved,
    }).toEqual({ imported: "src/lib/server/db/schema.ts", isInternal: true, resolved: true });
  });

  test("reports real line numbers, not line 1", () => {
    // The import sits on line 3 of the file, after two comment lines.
    const found = edgeTo(
      "src/lib/factories/production-controller-factory.ts",
      "$lib/server/repositories/postgres-notes",
    );
    expect({
      line: found?.lineNumber,
      mentionsSymbol: found?.lineContents.includes("PostgresNotes"),
    }).toEqual({ line: 3, mentionsSymbol: true });
  });

  test("flags a dangling alias as unresolved", () => {
    const found = edgeTo("src/lib/services/notes/search.ts", "$lib/server/search/indexer");
    expect({ resolved: found?.resolved, isInternal: found?.isInternal })
      .toEqual({ resolved: false, isInternal: true });
  });

  test("treats third-party packages as external and resolved", () => {
    const found = edgeTo("src/lib/services/notes/stats.ts", "drizzle-orm");
    expect({
      imported: found?.imported,
      isInternal: found?.isInternal,
      resolved: found?.resolved,
    }).toEqual({ imported: "drizzle-orm", isInternal: false, resolved: true });
  });

  test("keeps SvelteKit virtual modules as external rather than unresolved", () => {
    const project = createProjectInfo({
      rootPath: FIXTURE,
      files: [createFileInfo({
        path: "src/lib/remote/x.remote.ts",
        layer: Layer.REMOTE,
        language: "ts",
        source: 'import { query } from "$app/server";\nimport { SECRET } from "$env/static/private";\n',
      })],
    });
    const graph = new ImportGraph();
    graph.build(project);

    expect(graph.allImports.map(e => [e.specifier, e.isInternal, e.resolved])).toEqual([
      ["$app/server", false, true],
      ["$env/static/private", false, true],
    ]);
  });
});

describe("ImportGraph — svelte files", () => {
  test("extracts imports from a component script block", () => {
    const specifiers = from("src/lib/components/app/note-card.svelte").map(e => e.specifier);
    expect(specifiers).toEqual([
      "$lib/server/repositories/postgres-notes",
      "$lib/server/services/notes/management",
    ]);
  });

  test("line numbers in a component are offset back to the whole file", () => {
    // Both imports sit inside the <script> block; the reported line must be the
    // line in the .svelte file, not the line within the extracted fragment.
    const rows = from("src/lib/components/app/note-card.svelte")
      .map(e => [e.lineNumber, e.specifier]);
    expect(rows).toEqual([
      [3, "$lib/server/repositories/postgres-notes"],
      [5, "$lib/server/services/notes/management"],
    ]);
  });

  test("a component with no imports contributes no edges", () => {
    const project = createProjectInfo({
      rootPath: FIXTURE,
      files: [createFileInfo({
        path: "src/lib/components/app/plain.svelte",
        layer: Layer.COMPONENTS,
        language: "svelte",
        source: "<div>hello</div>\n",
      })],
    });
    const graph = new ImportGraph();
    graph.build(project);
    expect(graph.allImports).toEqual([]);
  });
});

describe("ImportGraph — type-only imports", () => {
  test("marks import type as type-only", () => {
    const edge = edgeTo("src/lib/components/app/note-title.svelte", "$lib/models/domain");
    expect(edge!.isTypeOnly).toBe(true);
  });

  test("marks a value import as not type-only", () => {
    const edge = edgeTo("src/lib/services/notes/stats.ts", "drizzle-orm");
    expect(edge!.isTypeOnly).toBe(false);
  });

  test("treats a clause of all-type named bindings as type-only", () => {
    const project = createProjectInfo({
      rootPath: FIXTURE,
      files: [createFileInfo({
        path: "src/lib/models/x.ts",
        layer: Layer.MODELS,
        language: "ts",
        source: 'import { type A, type B } from "./y";\nimport { type C, d } from "./z";\n',
      })],
    });
    const graph = new ImportGraph();
    graph.build(project);
    expect(graph.allImports.map(e => [e.specifier, e.isTypeOnly])).toEqual([
      ["./y", true],
      ["./z", false],
    ]);
  });
});

describe("ImportGraph — statement forms", () => {
  test("captures re-exports, dynamic imports, and side-effect imports", () => {
    const project = createProjectInfo({
      rootPath: FIXTURE,
      files: [createFileInfo({
        path: "src/lib/client/forms.ts",
        layer: Layer.CLIENT,
        language: "ts",
        source: [
          'export { a } from "./a";',
          'import "./side-effect";',
          'const mod = await import("./lazy");',
        ].join("\n"),
      })],
    });
    const graph = new ImportGraph();
    graph.build(project);
    expect(graph.allImports.map(e => e.specifier).sort())
      .toEqual(["./a", "./lazy", "./side-effect"]);
  });

  test("resolves a relative specifier against the importer's directory", () => {
    const project = createProjectInfo({
      rootPath: FIXTURE,
      files: [createFileInfo({
        path: "src/lib/server/services/notes/other.ts",
        layer: Layer.SERVICES,
        language: "ts",
        source: 'import { NoteManagement } from "./management";\n',
      })],
    });
    const graph = new ImportGraph();
    graph.build(project);
    expect(graph.allImports[0]!.imported).toBe("src/lib/server/services/notes/management.ts");
  });
});

describe("ImportGraph — lifecycle", () => {
  test("reports no imports before build", () => {
    expect(new ImportGraph().allImports).toEqual([]);
  });

  test("unresolved exposes exactly the dangling edges", () => {
    const dangling = edges.filter(e => !e.resolved).map(e => e.specifier);
    expect(dangling).toEqual(["$lib/server/search/indexer"]);
  });
});
