import { describe, test, expect } from "bun:test";
import type { Violation } from "chisel/checker/models/violation";
import { ServerLayerLeakService } from "chisel/checker/services/architecture/server_layer_leak";
import { FakeImportGraph, edge } from "../../fakes/fake_import_graph";
import { createFileInfo } from "chisel/checker/models/file_info";
import { createProjectInfo } from "chisel/checker/models/project_info";
import { Layer } from "chisel/checker/models/layer";

function check(
  files: Record<string, Layer>,
  edges: ReturnType<typeof edge>[],
): Violation[] {
  const graph = new FakeImportGraph();
  graph.setEdges(edges);
  const project = createProjectInfo({
    rootPath: "/app",
    files: Object.entries(files).map(([path, layer]) =>
      createFileInfo({ path, layer, language: path.endsWith(".svelte") ? "svelte" : "ts" }),
    ),
  });
  return new ServerLayerLeakService(graph).check(project);
}

describe("server-layer-leak", () => {
  test("a component importing from $lib/server is a leak", () => {
    const v = check(
      {
        "src/lib/components/a.svelte": Layer.COMPONENTS,
        "src/lib/server/repositories/pg.ts": Layer.REPOSITORIES,
      },
      [edge({ importer: "src/lib/components/a.svelte", imported: "src/lib/server/repositories/pg.ts" })],
    );
    expect(v.map(x => x.ruleId)).toEqual(["server-layer-leak:client-reachable-import"]);
    expect(v[0]!.message).toContain("reachable from the client bundle");
  });

  test("a server module importing another server module is fine", () => {
    const v = check(
      {
        "src/lib/server/app-factory.ts": Layer.FACTORY,
        "src/lib/server/repositories/pg.ts": Layer.REPOSITORIES,
      },
      [edge({ importer: "src/lib/server/app-factory.ts", imported: "src/lib/server/repositories/pg.ts" })],
    );
    expect(v).toEqual([]);
  });

  test("a +page.server.ts may import from $lib/server", () => {
    const v = check(
      {
        "src/routes/notes/+page.server.ts": Layer.ROUTES,
        "src/lib/server/app-factory.ts": Layer.FACTORY,
      },
      [edge({ importer: "src/routes/notes/+page.server.ts", imported: "src/lib/server/app-factory.ts" })],
    );
    expect(v).toEqual([]);
  });

  test("the universal +page.ts beside it may not — the distinction the rule exists for", () => {
    const v = check(
      {
        "src/routes/offline/+page.ts": Layer.COMPONENTS,
        "src/lib/server/app-factory.ts": Layer.FACTORY,
      },
      [edge({ importer: "src/routes/offline/+page.ts", imported: "src/lib/server/app-factory.ts" })],
    );
    expect(v.map(x => x.ruleId)).toEqual(["server-layer-leak:client-reachable-import"]);
  });

  test("a *.remote.ts is a server context", () => {
    const v = check(
      {
        "src/lib/remote/notes.remote.ts": Layer.REMOTE,
        "src/lib/server/app-factory.ts": Layer.FACTORY,
      },
      [edge({ importer: "src/lib/remote/notes.remote.ts", imported: "src/lib/server/app-factory.ts" })],
    );
    expect(v).toEqual([]);
  });

  test("hooks.server.ts is a server context", () => {
    const v = check(
      { "src/hooks.server.ts": Layer.HOOKS, "src/lib/server/app-factory.ts": Layer.FACTORY },
      [edge({ importer: "src/hooks.server.ts", imported: "src/lib/server/app-factory.ts" })],
    );
    expect(v).toEqual([]);
  });

  test("a *.server.ts outside $lib/server is server-only too", () => {
    const v = check(
      { "src/lib/client/sync.ts": Layer.CLIENT, "src/lib/telemetry.server.ts": Layer.CLIENT },
      [edge({ importer: "src/lib/client/sync.ts", imported: "src/lib/telemetry.server.ts" })],
    );
    expect(v.map(x => x.ruleId)).toEqual(["server-layer-leak:client-reachable-import"]);
  });

  test("a type-only import of a server module is not a leak", () => {
    // `import type` is erased before bundling, so nothing reaches the client.
    // import-boundary still reports the coupling; this rule must not double up.
    const v = check(
      {
        "src/lib/components/a.svelte": Layer.COMPONENTS,
        "src/lib/server/db/schema.ts": Layer.REPOSITORIES,
      },
      [edge({
        importer: "src/lib/components/a.svelte",
        imported: "src/lib/server/db/schema.ts",
        isTypeOnly: true,
      })],
    );
    expect(v).toEqual([]);
  });

  test("external and unresolved edges are ignored", () => {
    const v = check(
      { "src/lib/components/a.svelte": Layer.COMPONENTS },
      [
        edge({ importer: "src/lib/components/a.svelte", imported: "drizzle-orm", isInternal: false }),
        edge({ importer: "src/lib/components/a.svelte", imported: "$lib/server/gone", resolved: false }),
      ],
    );
    expect(v).toEqual([]);
  });

  test("a composition root at a universal path leaks", () => {
    const v = check(
      {
        "src/lib/factories/production-controller-factory.ts": Layer.FACTORY,
        "src/lib/server/repositories/pg.ts": Layer.REPOSITORIES,
      },
      [edge({
        importer: "src/lib/factories/production-controller-factory.ts",
        imported: "src/lib/server/repositories/pg.ts",
        lineNumber: 3,
      })],
    );
    expect(v.length).toBe(1);
    expect(v[0]!.line).toBe(3);
  });
});
