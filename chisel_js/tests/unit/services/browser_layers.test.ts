import { describe, test, expect } from "bun:test";
import { ImportBoundaryService } from "chisel/checker/services/architecture/import_boundary";
import { classifyFile } from "chisel/checker/repositories/file_discovery";
import { createProjectInfo } from "chisel/checker/models/project_info";
import { Layer } from "chisel/checker/models/layer";
import { FakeImportGraph, edge } from "../../fakes/fake_import_graph";
import { parsedFile } from "../../fakes/parsed_file";
import { semanticLayerOf } from "chisel/checker/services/architecture/semantic";

/**
 * The browser has the same layers as the server: services, repositories,
 * controllers and factories, plus stores and components. These cases pin the
 * edges that makes legal, and the neighbours that stay banned.
 */
function ruleIds(
  files: Record<string, string>,
  edges: ReturnType<typeof edge>[],
): string[] {
  const graph = new FakeImportGraph();
  graph.setEdges(edges);
  const project = createProjectInfo({
    rootPath: "/app",
    files: Object.entries(files).map(([path, source]) =>
      parsedFile({ path, source, layer: classifyFile(path).layer })),
  });
  return new ImportBoundaryService(graph).check(project).map(v => v.ruleId);
}

describe("browser layers — classification", () => {
  test("browser services, repositories and shared layers keep their layer", () => {
    expect(Object.fromEntries([
      "src/lib/client/services/workspace/sync.ts",
      "src/lib/client/repositories/workspace/records.ts",
      "src/lib/services/notes/creation.ts",
      "src/lib/controllers/workspace/session.ts",
      "src/lib/factories/workspace/session.ts",
      "src/lib/remote/skills/manifest-reader.server.ts",
      "src/lib/infrastructure/notes/schema.ts",
      "src/lib/server/infrastructure/telemetry/tracer.ts",
    ].map(path => [path, classifyFile(path).layer]))).toEqual({
      "src/lib/client/services/workspace/sync.ts": Layer.SERVICES,
      "src/lib/client/repositories/workspace/records.ts": Layer.REPOSITORIES,
      "src/lib/services/notes/creation.ts": Layer.SERVICES,
      "src/lib/controllers/workspace/session.ts": Layer.CONTROLLERS,
      "src/lib/factories/workspace/session.ts": Layer.FACTORY,
      "src/lib/remote/skills/manifest-reader.server.ts": Layer.REMOTE,
      "src/lib/infrastructure/notes/schema.ts": Layer.UTILS,
      "src/lib/server/infrastructure/telemetry/tracer.ts": Layer.UTILS,
    });
  });
});

describe("browser layers — components", () => {
  test("a component may call a browser controller", () => {
    expect(ruleIds(
      { "src/lib/components/a.svelte": "", "src/lib/controllers/w/session.ts": "" },
      [edge({ importer: "src/lib/components/a.svelte", imported: "src/lib/controllers/w/session.ts" })],
    )).toEqual([]);
  });

  test("a component may take its controller from a browser factory", () => {
    expect(ruleIds(
      { "src/lib/components/a.svelte": "", "src/lib/factories/w/session.ts": "" },
      [edge({ importer: "src/lib/components/a.svelte", imported: "src/lib/factories/w/session.ts" })],
    )).toEqual([]);
  });

  test("a component may not import a server controller", () => {
    expect(ruleIds(
      { "src/lib/components/a.svelte": "", "src/lib/server/controllers/notes.ts": "" },
      [edge({ importer: "src/lib/components/a.svelte", imported: "src/lib/server/controllers/notes.ts" })],
    )).toEqual(["import-boundary:banned-layer-import"]);
  });

  test("a component may not import a shared service", () => {
    expect(ruleIds(
      { "src/lib/components/a.svelte": "", "src/lib/services/notes/creation.ts": "" },
      [edge({ importer: "src/lib/components/a.svelte", imported: "src/lib/services/notes/creation.ts" })],
    )).toEqual(["import-boundary:banned-layer-import"]);
  });
});

describe("browser layers — services and controllers", () => {
  test("a browser service may call a remote function", () => {
    expect(ruleIds(
      { "src/lib/client/services/w/sync.ts": "", "src/lib/remote/w/sync.remote.ts": "" },
      [edge({ importer: "src/lib/client/services/w/sync.ts", imported: "src/lib/remote/w/sync.remote.ts" })],
    )).toEqual([]);
  });

  test("a shared service may not call a remote function", () => {
    expect(ruleIds(
      { "src/lib/services/notes/creation.ts": "", "src/lib/remote/w/sync.remote.ts": "" },
      [edge({ importer: "src/lib/services/notes/creation.ts", imported: "src/lib/remote/w/sync.remote.ts" })],
    )).toEqual(["import-boundary:banned-layer-import"]);
  });

  test("a browser controller may record its outcome in a store", () => {
    expect(ruleIds(
      { "src/lib/controllers/w/session.ts": "", "src/lib/stores/w/state.svelte.ts": "" },
      [edge({ importer: "src/lib/controllers/w/session.ts", imported: "src/lib/stores/w/state.svelte.ts" })],
    )).toEqual([]);
  });

  test("a browser controller may not call another controller", () => {
    expect(ruleIds(
      { "src/lib/controllers/w/session.ts": "", "src/lib/controllers/p/actions.ts": "" },
      [edge({ importer: "src/lib/controllers/w/session.ts", imported: "src/lib/controllers/p/actions.ts" })],
    )).toEqual(["import-boundary:banned-layer-import"]);
  });
});

describe("browser layers — controller contracts", () => {
  const controller = "src/lib/controllers/w/session.ts";
  const controllerSource = [
    "export interface WorkspaceSession { start(): Promise<void> }",
    "export type SessionState = { kind: 'ready' } | { kind: 'offline' };",
    "export class LocalWorkspaceSession implements WorkspaceSession { async start() {} }",
    "export type SessionClass = LocalWorkspaceSession;",
  ].join("\n");

  function importing(names: string): string[] {
    const importer = "src/lib/client/w/panel-state.ts";
    return ruleIds(
      {
        [importer]: `import type { ${names} } from "$lib/controllers/w/session";\n`,
        [controller]: controllerSource,
      },
      [edge({
        importer,
        imported: controller,
        specifier: "$lib/controllers/w/session",
        isTypeOnly: true,
      })],
    );
  }

  test("a type-only import of an interface and a data union is a contract", () => {
    expect(importing("WorkspaceSession, SessionState")).toEqual([]);
  });

  test("a type-only import of the class is coupling to an implementation", () => {
    expect(importing("LocalWorkspaceSession")).toEqual(["import-boundary:banned-layer-import"]);
  });

  test("an alias of the class is not a contract either", () => {
    expect(importing("SessionClass")).toEqual(["import-boundary:banned-layer-import"]);
  });
});

describe("semantic layers — configured facts", () => {
  const facts = {
    mode: "sveltekit-standalone" as const,
    entryPoints: ["src/worker.ts"],
    agentTools: "src/lib/server/factories/agent/tools/",
  };

  test("agent tools, configured entry points, routes and server hooks are entry points", () => {
    expect(Object.fromEntries([
      "src/lib/server/factories/agent/tools/notes.ts",
      "src/worker.ts",
      "src/routes/api/x/+server.ts",
      "src/hooks.server.ts",
      "src/hooks.client.ts",
      "src/lib/server/application.ts",
    ].map(path => [path, semanticLayerOf(path, facts)]))).toEqual({
      "src/lib/server/factories/agent/tools/notes.ts": "tool-factory",
      "src/worker.ts": "entry",
      "src/routes/api/x/+server.ts": "entry",
      "src/hooks.server.ts": "entry",
      "src/hooks.client.ts": "other",
      "src/lib/server/application.ts": "factories",
    });
  });
});
