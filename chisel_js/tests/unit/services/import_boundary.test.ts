import { describe, test, expect } from "bun:test";
import type { Violation } from "chisel/checker/models/violation";
import { ImportBoundaryService } from "chisel/checker/services/architecture/import_boundary";
import { FakeImportGraph, edge } from "../../fakes/fake_import_graph";
import { createFileInfo } from "chisel/checker/models/file_info";
import { createProjectInfo } from "chisel/checker/models/project_info";
import { Layer } from "chisel/checker/models/layer";
import { CheckerMode } from "chisel/checker/models/mode";

/** Run the rule over one edge, with each endpoint's layer declared. */
function check(
  files: Record<string, Layer>,
  edges: ReturnType<typeof edge>[],
  mode: CheckerMode = CheckerMode.STANDALONE,
): Violation[] {
  const graph = new FakeImportGraph();
  graph.setEdges(edges);
  const project = createProjectInfo({
    rootPath: "/app",
    files: Object.entries(files).map(([path, layer]) =>
      createFileInfo({ path, layer, language: path.endsWith(".svelte") ? "svelte" : "ts" }),
    ),
  });
  return new ImportBoundaryService(graph, mode).check(project);
}

function ruleIds(violations: Violation[]): string[] {
  return violations.map(v => v.ruleId);
}

describe("import-boundary — layer matrix", () => {
  test("a component importing a service is banned", () => {
    const v = check(
      { "src/lib/components/a.svelte": Layer.COMPONENTS, "src/lib/services/n/m.ts": Layer.SERVICES },
      [edge({ importer: "src/lib/components/a.svelte", imported: "src/lib/services/n/m.ts" })],
    );
    expect({
      ruleIds: ruleIds(v),
      explainsDirection: v[0]!.message.includes("components must not import services"),
    }).toEqual({ ruleIds: ["import-boundary:banned-layer-import"], explainsDirection: true });
  });

  test("a route importing the factory is allowed", () => {
    const v = check(
      { "src/routes/+page.server.ts": Layer.ROUTES, "src/lib/server/app-factory.ts": Layer.FACTORY },
      [edge({ importer: "src/routes/+page.server.ts", imported: "src/lib/server/app-factory.ts" })],
    );
    expect(v).toEqual([]);
  });

  test("a route importing a service directly is banned", () => {
    const v = check(
      { "src/routes/+page.server.ts": Layer.ROUTES, "src/lib/services/n/m.ts": Layer.SERVICES },
      [edge({ importer: "src/routes/+page.server.ts", imported: "src/lib/services/n/m.ts" })],
    );
    expect(ruleIds(v)).toEqual(["import-boundary:banned-layer-import"]);
  });

  test("a remote function may build from the factory", () => {
    const v = check(
      { "src/lib/remote/n.remote.ts": Layer.REMOTE, "src/lib/server/app-factory.ts": Layer.FACTORY },
      [edge({ importer: "src/lib/remote/n.remote.ts", imported: "src/lib/server/app-factory.ts" })],
    );
    expect(v).toEqual([]);
  });

  test("models may import nothing internal", () => {
    const v = check(
      { "src/lib/models/a.ts": Layer.MODELS, "src/lib/utils.ts": Layer.UTILS },
      [edge({ importer: "src/lib/models/a.ts", imported: "src/lib/utils.ts" })],
    );
    expect(ruleIds(v)).toEqual(["import-boundary:layer-no-internal-imports"]);
  });

  test("models may not import even another model", () => {
    // `null` in the table means nothing internal at all, including its own
    // layer. Python's table says the same; its same-layer early return is what
    // stops it being enforced there.
    const v = check(
      { "src/lib/models/a.ts": Layer.MODELS, "src/lib/models/b.ts": Layer.MODELS },
      [edge({ importer: "src/lib/models/a.ts", imported: "src/lib/models/b.ts" })],
    );
    expect(ruleIds(v)).toEqual(["import-boundary:layer-no-internal-imports"]);
  });

  test("a models barrel may re-export the layer", () => {
    const v = check(
      { "src/lib/models/index.ts": Layer.MODELS, "src/lib/models/b.ts": Layer.MODELS },
      [edge({ importer: "src/lib/models/index.ts", imported: "src/lib/models/b.ts" })],
    );
    expect(v).toEqual([]);
  });

  test("a nested barrel aggregates too, as __init__.py does at every level", () => {
    const v = check(
      { "src/lib/models/agent/index.ts": Layer.MODELS, "src/lib/models/agent/runs.ts": Layer.MODELS },
      [edge({ importer: "src/lib/models/agent/index.ts", imported: "src/lib/models/agent/runs.ts" })],
    );
    expect(v).toEqual([]);
  });

  test("a barrel is still bound by the cross-layer rules", () => {
    // Aggregating your own layer is the carve-out; reaching into another layer
    // is not, and an index.ts is not a way around the matrix.
    const v = check(
      { "src/lib/models/index.ts": Layer.MODELS, "src/lib/utils.ts": Layer.UTILS },
      [edge({ importer: "src/lib/models/index.ts", imported: "src/lib/utils.ts" })],
    );
    expect(ruleIds(v)).toEqual(["import-boundary:layer-no-internal-imports"]);
  });

  test("the factory may import anything concrete", () => {
    const v = check(
      {
        "src/lib/server/app-factory.ts": Layer.FACTORY,
        "src/lib/server/repositories/pg.ts": Layer.REPOSITORIES,
        "src/lib/services/n/m.ts": Layer.SERVICES,
      },
      [
        edge({ importer: "src/lib/server/app-factory.ts", imported: "src/lib/server/repositories/pg.ts" }),
        edge({ importer: "src/lib/server/app-factory.ts", imported: "src/lib/services/n/m.ts" }),
      ],
    );
    expect(v).toEqual([]);
  });

  test("a store importing a controller is banned", () => {
    const v = check(
      { "src/lib/stores/s.svelte.ts": Layer.STORES, "src/lib/controllers/n/c.ts": Layer.CONTROLLERS },
      [edge({ importer: "src/lib/stores/s.svelte.ts", imported: "src/lib/controllers/n/c.ts" })],
    );
    expect(ruleIds(v)).toEqual(["import-boundary:banned-layer-import"]);
  });

  test("tests may import every layer they exercise", () => {
    const v = check(
      { "src/lib/services/n/m.spec.ts": Layer.TESTS, "src/lib/server/repositories/pg.ts": Layer.REPOSITORIES },
      [edge({ importer: "src/lib/services/n/m.spec.ts", imported: "src/lib/server/repositories/pg.ts" })],
    );
    expect(v).toEqual([]);
  });
});

describe("import-boundary — same-layer edges", () => {
  test("one service must not import another service", () => {
    const v = check(
      { "src/lib/services/notes/m.ts": Layer.SERVICES, "src/lib/services/agent/m.ts": Layer.SERVICES },
      [edge({ importer: "src/lib/services/notes/m.ts", imported: "src/lib/services/agent/m.ts" })],
    );
    expect(ruleIds(v)).toEqual(["import-boundary:banned-layer-import"]);
  });

  test("a service may not import a sibling file either", () => {
    // No cross-module carve-out: if two files in the services layer need the
    // same type, that type is domain data and belongs in $lib/models.
    const v = check(
      { "src/lib/services/notes/management.ts": Layer.SERVICES, "src/lib/services/notes/contracts.ts": Layer.SERVICES },
      [edge({ importer: "src/lib/services/notes/management.ts", imported: "src/lib/services/notes/contracts.ts" })],
    );
    expect(ruleIds(v)).toEqual(["import-boundary:banned-layer-import"]);
  });

  test("the fix guidance points at $lib/models", () => {
    const v = check(
      { "src/lib/services/notes/m.ts": Layer.SERVICES, "src/lib/services/agent/m.ts": Layer.SERVICES },
      [edge({ importer: "src/lib/services/notes/m.ts", imported: "src/lib/services/agent/m.ts" })],
    );
    expect(v[0]!.message).toContain("$lib/models");
  });

  test("a repository may compose another repository", () => {
    // REPOSITORIES is absent from its own banned set, matching Python's table:
    // a transaction wrapper over a concrete store is legitimate.
    const v = check(
      {
        "src/lib/server/repositories/tx.ts": Layer.REPOSITORIES,
        "src/lib/server/repositories/pg-notes.ts": Layer.REPOSITORIES,
      },
      [edge({ importer: "src/lib/server/repositories/tx.ts", imported: "src/lib/server/repositories/pg-notes.ts" })],
    );
    expect(v).toEqual([]);
  });

  test("one controller must not import another", () => {
    const v = check(
      { "src/lib/controllers/notes/c.ts": Layer.CONTROLLERS, "src/lib/controllers/todos/c.ts": Layer.CONTROLLERS },
      [edge({ importer: "src/lib/controllers/notes/c.ts", imported: "src/lib/controllers/todos/c.ts" })],
    );
    expect(ruleIds(v)).toEqual(["import-boundary:banned-layer-import"]);
  });

  test("components may import other components", () => {
    const v = check(
      { "src/lib/components/a.svelte": Layer.COMPONENTS, "src/lib/components/b.svelte": Layer.COMPONENTS },
      [edge({ importer: "src/lib/components/a.svelte", imported: "src/lib/components/b.svelte" })],
    );
    expect(v).toEqual([]);
  });
});

describe("import-boundary — third-party packages", () => {
  test("drizzle outside the repository layer is an orm leak", () => {
    const v = check(
      { "src/lib/services/n/m.ts": Layer.SERVICES },
      [edge({ importer: "src/lib/services/n/m.ts", imported: "drizzle-orm", isInternal: false })],
    );
    expect(ruleIds(v)).toEqual(["import-boundary:orm-leak"]);
  });

  test("drizzle inside a repository is fine", () => {
    const v = check(
      { "src/lib/server/repositories/pg.ts": Layer.REPOSITORIES },
      [edge({ importer: "src/lib/server/repositories/pg.ts", imported: "drizzle-orm/pg-core", isInternal: false })],
    );
    expect(v).toEqual([]);
  });

  test("@sveltejs/kit in a service is a framework leak", () => {
    const v = check(
      { "src/lib/services/n/m.ts": Layer.SERVICES },
      [edge({ importer: "src/lib/services/n/m.ts", imported: "@sveltejs/kit", isInternal: false })],
    );
    expect(ruleIds(v)).toEqual(["import-boundary:framework-leak"]);
  });

  test("@sveltejs/kit in a route is fine", () => {
    const v = check(
      { "src/routes/+page.server.ts": Layer.ROUTES },
      [edge({ importer: "src/routes/+page.server.ts", imported: "@sveltejs/kit", isInternal: false })],
    );
    expect(v).toEqual([]);
  });

  test("the openapi-fetch rule applies in BFF mode only", () => {
    const files = { "src/lib/services/n/m.ts": Layer.SERVICES };
    const edges = [edge({ importer: "src/lib/services/n/m.ts", imported: "openapi-fetch", isInternal: false })];
    expect({
      bff: ruleIds(check(files, edges, CheckerMode.BFF)),
      standalone: ruleIds(check(files, edges, CheckerMode.STANDALONE)),
    }).toEqual({ bff: ["import-boundary:api-client-location"], standalone: [] });
  });

  test("the API client is constructed in config and in the factory, and nowhere else", () => {
    // The other half of the rule. Gating it by mode is only half the contract;
    // the point is that exactly two layers may name the constructor, so the
    // client is built once rather than per caller.
    const from = (path: string, layer: Layer): string[] => ruleIds(check(
      { [path]: layer },
      [edge({ importer: path, imported: "openapi-fetch", isInternal: false })],
      CheckerMode.BFF,
    ));

    expect({
      config: from("src/lib/config.ts", Layer.CONFIG),
      factory: from("src/lib/server/factories/api-factory.ts", Layer.FACTORY),
      controller: from("src/lib/server/controllers/todos/controller.ts", Layer.CONTROLLERS),
    }).toEqual({
      config: [],
      factory: [],
      controller: ["import-boundary:api-client-location"],
    });
  });

  test("the BFF rule is listed in both modes, because only its firing is gated", () => {
    // A rule that vanishes from `chisel-js rules` in one mode is a rule nobody
    // can look up the fix for. `describeRules()` is the catalogue, not the
    // active set.
    const idsIn = (mode: CheckerMode): string[] =>
      new ImportBoundaryService(new FakeImportGraph(), mode)
        .describeRules()
        .map(r => r.id)
        .filter(id => id === "import-boundary:api-client-location");

    expect({
      bff: idsIn(CheckerMode.BFF),
      standalone: idsIn(CheckerMode.STANDALONE),
    }).toEqual({
      bff: ["import-boundary:api-client-location"],
      standalone: ["import-boundary:api-client-location"],
    });
  });
});

describe("import-boundary — server-only specifiers", () => {
  test("private env in a component is reported", () => {
    const v = check(
      { "src/lib/components/a.svelte": Layer.COMPONENTS },
      [edge({ importer: "src/lib/components/a.svelte", imported: "$env/static/private", isInternal: false })],
    );
    expect(ruleIds(v)).toEqual(["import-boundary:server-only-specifier"]);
  });

  test("private env in a *.server.ts is fine", () => {
    const v = check(
      { "src/routes/+page.server.ts": Layer.ROUTES },
      [edge({ importer: "src/routes/+page.server.ts", imported: "$env/static/private", isInternal: false })],
    );
    expect(v).toEqual([]);
  });

  test("$app/server in a remote function is fine", () => {
    const v = check(
      { "src/lib/remote/n.remote.ts": Layer.REMOTE },
      [edge({ importer: "src/lib/remote/n.remote.ts", imported: "$app/server", isInternal: false })],
    );
    expect(v).toEqual([]);
  });

  test("$app/server in a universal load is reported", () => {
    const v = check(
      { "src/routes/offline/+page.ts": Layer.COMPONENTS },
      [edge({ importer: "src/routes/offline/+page.ts", imported: "$app/server", isInternal: false })],
    );
    expect(ruleIds(v)).toEqual(["import-boundary:server-only-specifier"]);
  });
});

describe("import-boundary — unresolved edges", () => {
  test("a dangling specifier is reported with its real line", () => {
    const v = check(
      { "src/lib/services/n/m.ts": Layer.SERVICES },
      [edge({
        importer: "src/lib/services/n/m.ts",
        imported: "$lib/server/search/indexer",
        specifier: "$lib/server/search/indexer",
        resolved: false,
        lineNumber: 12,
      })],
    );
    expect({ ruleIds: ruleIds(v), line: v[0]!.line })
      .toEqual({ ruleIds: ["import-boundary:unresolved-import"], line: 12 });
  });

  test("an unresolved edge is reported once, not also as a layer violation", () => {
    const v = check(
      { "src/lib/models/a.ts": Layer.MODELS },
      [edge({ importer: "src/lib/models/a.ts", imported: "./missing", resolved: false })],
    );
    expect(v.length).toBe(1);
  });
});

describe("import-boundary — reporting", () => {
  test("every violation carries the importer's real path and line", () => {
    const v = check(
      { "src/lib/components/a.svelte": Layer.COMPONENTS, "src/lib/services/n/m.ts": Layer.SERVICES },
      [edge({
        importer: "src/lib/components/a.svelte",
        imported: "src/lib/services/n/m.ts",
        lineNumber: 42,
      })],
    );
    expect({ file: v[0]!.file, line: v[0]!.line }).toEqual({
      file: "src/lib/components/a.svelte",
      line: 42,
    });
  });

  test("edges from files outside the project are ignored", () => {
    const v = check(
      { "src/lib/models/a.ts": Layer.MODELS },
      [edge({ importer: "node_modules/pkg/index.ts", imported: "src/lib/models/a.ts" })],
    );
    expect(v).toEqual([]);
  });
});
