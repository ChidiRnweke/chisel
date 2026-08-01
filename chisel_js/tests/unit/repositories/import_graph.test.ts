import { describe, test, expect, beforeAll } from "bun:test";
import type { ImportEdge } from "chisel/checker/models/import_edge";
import { FileDiscovery } from "chisel/checker/repositories/file_discovery";
import { ImportGraph } from "chisel/checker/repositories/import_graph";
import { createFileInfo } from "chisel/checker/models/file_info";
import { createProjectInfo } from "chisel/checker/models/project_info";
import { Layer } from "chisel/checker/models/layer";
import { classifyFile } from "chisel/checker/repositories/file_discovery";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

/**
 * Build a graph over a throwaway project on disk. Config files (any `*.json`)
 * are written but not handed to the graph as source files, mirroring what
 * discovery does; everything else becomes a discovered file.
 */
function graphOver(files: Record<string, string>, tsconfigName?: string): ImportGraph {
  const root = mkdtempSync(join(tmpdir(), "chisel-aliases-"));
  try {
    const infos = [];
    for (const [path, source] of Object.entries(files)) {
      const full = join(root, path);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, source);
      if (path.endsWith(".json")) continue;
      infos.push(createFileInfo({
        path,
        layer: classifyFile(path).layer,
        language: path.endsWith(".svelte") ? "svelte" : "ts",
        source,
      }));
    }
    const graph = new ImportGraph(tsconfigName);
    graph.build(createProjectInfo({ rootPath: root, files: infos }));
    return graph;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function resolutions(graph: ImportGraph): Record<string, string> {
  return Object.fromEntries(
    graph.allImports.map(e => [e.specifier, e.resolved ? e.imported : `UNRESOLVED(${e.imported})`]),
  );
}

const LIB_FILES = {
  "src/lib/models/index.ts": "export const model = 1;\n",
  "src/lib/components/ui/button/index.ts": "export const Button = 1;\n",
  "src/lib/state/session.svelte.ts": "export const session = 1;\n",
  "src/lib/utils.ts": "export const helper = 1;\n",
};

const LIB_IMPORTER = {
  "src/lib/client/consumer.ts": [
    'import { model } from "$lib/models";',
    'import { Button } from "$lib/components/ui/button";',
    'import { session } from "$lib/state/session.svelte";',
    'import { helper } from "$lib/utils.js";',
    "export const all = [model, Button, session, helper];",
  ].join("\n"),
};

const LIB_EXPECTED = {
  "$lib/models": "src/lib/models/index.ts",
  "$lib/components/ui/button": "src/lib/components/ui/button/index.ts",
  "$lib/state/session.svelte": "src/lib/state/session.svelte.ts",
  "$lib/utils.js": "src/lib/utils.ts",
};

describe("ImportGraph — tsconfig alias bases", () => {
  test("resolves $lib declared in SvelteKit's generated .svelte-kit/tsconfig.json", () => {
    // The regression: the app's tsconfig only *extends* the generated one, whose
    // `$lib` target is `../src/lib` relative to `.svelte-kit/`. Rebasing that on
    // the repo root instead of `pathsBasePath` points one directory above the
    // project, and every $lib import is reported unresolved.
    const graph = graphOver({
      "tsconfig.json": '{"extends":"./.svelte-kit/tsconfig.json"}',
      ".svelte-kit/tsconfig.json":
        '{"compilerOptions":{"paths":{"$lib":["../src/lib"],"$lib/*":["../src/lib/*"]}}}',
      ...LIB_FILES,
      ...LIB_IMPORTER,
    });

    expect(resolutions(graph)).toEqual(LIB_EXPECTED);
  });

  test("resolves $lib declared directly with an explicit baseUrl", () => {
    const graph = graphOver({
      "tsconfig.json":
        '{"compilerOptions":{"baseUrl":".","paths":{"$lib":["src/lib"],"$lib/*":["src/lib/*"]}}}',
      ...LIB_FILES,
      ...LIB_IMPORTER,
    });

    expect(resolutions(graph)).toEqual(LIB_EXPECTED);
  });

  test("reads the tsconfig named by chisel.config.json, not the default one", () => {
    const graph = graphOver({
      "tsconfig.json": '{"files":[],"references":[{"path":"./tsconfig.app.json"}]}',
      "tsconfig.app.json":
        '{"compilerOptions":{"baseUrl":".","paths":{"$lib":["src/lib"],"$lib/*":["src/lib/*"]}}}',
      ...LIB_FILES,
      ...LIB_IMPORTER,
    }, "tsconfig.app.json");

    expect(resolutions(graph)).toEqual(LIB_EXPECTED);
  });

  test("falls back to src/lib when the tsconfig declares no paths", () => {
    // A SvelteKit checkout before `svelte-kit sync`: the config parses, the
    // `extends` target is missing, and no aliases come out of it.
    const graph = graphOver({
      "tsconfig.json": '{"extends":"./.svelte-kit/tsconfig.json"}',
      ...LIB_FILES,
      ...LIB_IMPORTER,
    });

    expect(resolutions(graph)).toEqual(LIB_EXPECTED);
  });

  test("treats an alias pointing outside the project as external, without warning", () => {
    // A monorepo aliasing a sibling package is configured correctly: nothing
    // the checker discovered lives there, so the import is somebody else's
    // package as far as the layer rules are concerned.
    const graph = graphOver({
      "tsconfig.json":
        '{"compilerOptions":{"baseUrl":".","paths":{"@shared/*":["../shared/*"]}}}',
      "src/lib/client/consumer.ts": 'import { x } from "@shared/x";\nexport const y = x;\n',
    });

    expect({
      isInternal: graph.allImports[0]!.isInternal,
      resolved: graph.allImports[0]!.resolved,
      warnings: graph.warnings,
    }).toEqual({ isInternal: false, resolved: true, warnings: [] });
  });

  test("warns and falls back when $lib itself points outside the project", () => {
    const graph = graphOver({
      "tsconfig.json":
        '{"compilerOptions":{"baseUrl":".","paths":{"$lib":["../elsewhere"],"$lib/*":["../elsewhere/*"]}}}',
      ...LIB_FILES,
      ...LIB_IMPORTER,
    });

    expect({
      resolutions: resolutions(graph),
      warnings: graph.warnings.length,
      mentionsTarget: graph.warnings[0]?.includes("$lib -> ../elsewhere") ?? false,
    }).toEqual({ resolutions: LIB_EXPECTED, warnings: 1, mentionsTarget: true });
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
