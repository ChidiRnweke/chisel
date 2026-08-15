import { describe, test, expect } from "bun:test";
import { TopologyService } from "chisel/checker/services/architecture/topology";
import { Layer } from "chisel/checker/models/layer";
import { FakeImportGraph, edge } from "../../fakes/fake_import_graph";
import { createProjectInfo } from "chisel/checker/models/project_info";
import { parsedFile } from "../../fakes/parsed_file";
import type { ImportEdge } from "chisel/checker/models/import_edge";

function check(
  files: Array<{ path: string; source?: string; layer?: Layer }>,
  edges: ImportEdge[] = [],
): string[] {
  const graph = new FakeImportGraph();
  graph.setEdges(edges);
  const project = createProjectInfo({
    rootPath: "/test",
    files: files.map(f => parsedFile({
      path: f.path,
      source: f.source ?? "export const a = 1;\n",
      layer: f.layer ?? Layer.UNKNOWN,
    })),
  });
  return new TopologyService(graph).check(project).map(v => v.ruleId);
}

describe("topology — layer barrels", () => {
  test("importing a whole layer is reported", () => {
    expect(check(
      [{ path: "src/lib/components/notes/card.svelte" }],
      [edge({
        importer: "src/lib/components/notes/card.svelte",
        imported: "src/lib/models/index.ts",
        specifier: "$lib/models",
      })],
    )).toEqual(["topology:layer-barrel-import"]);
  });

  test("importing one domain through its own barrel is the sanctioned path", () => {
    expect(check(
      [{ path: "src/lib/components/notes/card.svelte" }],
      [edge({
        importer: "src/lib/components/notes/card.svelte",
        imported: "src/lib/models/notes/index.ts",
        specifier: "$lib/models/notes",
      })],
    )).toEqual([]);
  });
});

describe("topology — feature entry points", () => {
  const featureFiles = [
    { path: "src/lib/components/notes/index.ts" },
    { path: "src/lib/components/notes/internal/editor.svelte" },
    { path: "src/lib/components/chat/panel.svelte" },
  ];

  test("reaching past another feature's entry point is reported", () => {
    expect(check(featureFiles, [edge({
      importer: "src/lib/components/chat/panel.svelte",
      imported: "src/lib/components/notes/internal/editor.svelte",
      specifier: "$lib/components/notes/internal/editor",
    })])).toEqual(["topology:deep-feature-import"]);
  });

  test("a feature reaching into its own internals is its own business", () => {
    expect(check(featureFiles, [edge({
      importer: "src/lib/components/notes/internal/editor.svelte",
      imported: "src/lib/components/notes/internal/toolbar.svelte",
      specifier: "$lib/components/notes/internal/toolbar",
    })])).toEqual([]);
  });

  test("a folder that publishes no entry point declares no contract to bypass", () => {
    // `shared/` and `layout/` are presentation roles, not features. Without an
    // index.ts there is nothing to call a public surface.
    expect(check(
      [{ path: "src/lib/components/shared/avatar.svelte" }, ...featureFiles],
      [edge({
        importer: "src/lib/components/chat/panel.svelte",
        imported: "src/lib/components/shared/avatar.svelte",
        specifier: "$lib/components/shared/avatar",
      })],
    )).toEqual([]);
  });
});

describe("topology — generic buckets", () => {
  test("a directory that names no concept is reported once", () => {
    expect(check([
      { path: "src/lib/misc/one.ts" },
      { path: "src/lib/misc/two.ts" },
    ])).toEqual(["topology:generic-bucket-directory"]);
  });

  test("shared and utils keep their place", () => {
    // `utils/` already has a layer of its own; `shared/` names a real role.
    expect(check([
      { path: "src/lib/utils/format.ts" },
      { path: "src/lib/components/shared/avatar.svelte" },
    ])).toEqual([]);
  });
});

describe("topology — composition root", () => {
  const root = "src/lib/server/application.ts";

  test("a non-type import of a concrete repository is reported", () => {
    expect(check(
      [{ path: root, layer: Layer.FACTORY }],
      [edge({
        importer: root,
        imported: "src/lib/server/repositories/notes/postgres.ts",
        specifier: "$lib/server/repositories/notes/postgres",
      })],
    )).toEqual(["topology:composition-root-concrete-import"]);
  });

  test("naming a contract as a type is not reaching for the implementation", () => {
    expect(check(
      [{ path: root, layer: Layer.FACTORY }],
      [edge({
        importer: root,
        imported: "src/lib/server/services/notes/management.ts",
        specifier: "$lib/server/services/notes/management",
        isTypeOnly: true,
      })],
    )).toEqual([]);
  });

  test("constructing something other than a factory is reported", () => {
    expect(check([{
      path: root,
      layer: Layer.FACTORY,
      source: "export const app = () => new PostgresNotes();\n",
    }])).toEqual(["topology:composition-root-construction"]);
  });

  test("constructing a factory is what the composition root is for", () => {
    expect(check([{
      path: root,
      layer: Layer.FACTORY,
      source: "export const app = () => new ProductionControllerFactory(deps);\n",
    }])).toEqual([]);
  });

  test("a placeholder standing in for a real dependency is reported", () => {
    expect(check([{
      path: root,
      layer: Layer.FACTORY,
      source: "export const app = () => ({ runner: undefined as unknown as Runner });\n",
    }])).toEqual(["topology:composition-root-placeholder"]);
  });
});

describe("topology — factory shape", () => {
  const path = "src/lib/server/factories/capabilities/notes-capability-factory.ts";

  test("a factory module exporting one creator passes", () => {
    expect(check([{
      path,
      layer: Layer.FACTORY,
      source: "export interface NotesCapability { id: string }\n"
        + "export const createNotesCapability = () => ({ id: 'n' });\n",
    }])).toEqual([]);
  });

  test("a factory module exporting two values is reported", () => {
    expect(check([{
      path,
      layer: Layer.FACTORY,
      source: "export const createNotesCapability = () => ({});\n"
        + "export const notesCatalog = { entries: [] };\n",
    }])).toEqual(["topology:factory-shape"]);
  });

  test("a factory module exporting only a type is reported", () => {
    expect(check([{
      path,
      layer: Layer.FACTORY,
      source: "export interface ControllerFactory { notes(): unknown }\n",
    }])).toEqual(["topology:factory-shape"]);
  });
});
