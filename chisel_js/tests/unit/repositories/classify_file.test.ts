import { describe, test, expect } from "bun:test";
import { classifyFile } from "chisel/checker/repositories/file_discovery";
import { Layer } from "chisel/checker/models/layer";

function layerOf(path: string, mode?: "sveltekit-standalone" | "sveltekit-bff"): string {
  return classifyFile(path, mode).layer;
}

/** Map each path to its layer, so a whole group asserts in one comparison. */
function layers(paths: string[]): Record<string, string> {
  return Object.fromEntries(paths.map(p => [p, layerOf(p)]));
}

describe("classifyFile — canonical locations", () => {
  test("framework hooks files are the hooks layer", () => {
    expect(layers(["src/hooks.server.ts", "src/hooks.ts"])).toEqual({
      "src/hooks.server.ts": Layer.HOOKS,
      "src/hooks.ts": Layer.HOOKS,
    });
  });

  test("server route loaders and endpoints are routes", () => {
    expect(layers([
      "src/routes/(app)/+page.server.ts",
      "src/routes/(app)/+layout.server.ts",
      "src/routes/api/attachments/+server.ts",
    ])).toEqual({
      "src/routes/(app)/+page.server.ts": Layer.ROUTES,
      "src/routes/(app)/+layout.server.ts": Layer.ROUTES,
      "src/routes/api/attachments/+server.ts": Layer.ROUTES,
    });
  });

  test("$lib/server/<name>/ is layer <name>", () => {
    expect(layers([
      "src/lib/server/repositories/postgres-notes.ts",
      "src/lib/server/db/schema.ts",
      "src/lib/server/services/notes.ts",
      "src/lib/server/controllers/notes.ts",
      "src/lib/server/config.ts",
    ])).toEqual({
      // db is part of the repository layer: the schema is its own data
      // definition, not a peer it would import across a boundary.
      "src/lib/server/repositories/postgres-notes.ts": Layer.REPOSITORIES,
      "src/lib/server/db/schema.ts": Layer.REPOSITORIES,
      "src/lib/server/services/notes.ts": Layer.SERVICES,
      "src/lib/server/controllers/notes.ts": Layer.CONTROLLERS,
      "src/lib/server/config.ts": Layer.CONFIG,
    });
  });

  test("a folder under server/ that is not a layer gets no layer", () => {
    // Guessing one is what previously relabelled server/domain/ (services) as
    // repositories. structure:unknown-server-folder reports it instead.
    expect(classifyFile("src/lib/server/domain/openai-client.ts"))
      .toEqual({ layer: Layer.UNKNOWN, classified: false });
  });

  test("composition roots under $lib/server are the factory layer", () => {
    expect(layers([
      "src/lib/server/app-factory.ts",
      "src/lib/server/production-factory.ts",
      "src/lib/server/ServerFactory.ts",
      "src/lib/server/application.ts",
    ])).toEqual({
      "src/lib/server/app-factory.ts": Layer.FACTORY,
      "src/lib/server/production-factory.ts": Layer.FACTORY,
      "src/lib/server/ServerFactory.ts": Layer.FACTORY,
      "src/lib/server/application.ts": Layer.FACTORY,
    });
  });

  test("universal lib folders map to their layer", () => {
    expect(layers([
      "src/lib/services/notes/management.ts",
      "src/lib/controllers/notes/controller.ts",
      "src/lib/models/domain.ts",
      "src/lib/errors.ts",
      "src/lib/stores/chat.svelte.ts",
      "src/lib/components/app/todo-card.svelte",
      "src/lib/utils.ts",
      "src/lib/config.ts",
      "src/env.ts",
    ])).toEqual({
      "src/lib/services/notes/management.ts": Layer.SERVICES,
      "src/lib/controllers/notes/controller.ts": Layer.CONTROLLERS,
      "src/lib/models/domain.ts": Layer.MODELS,
      "src/lib/errors.ts": Layer.ERRORS,
      "src/lib/stores/chat.svelte.ts": Layer.STORES,
      "src/lib/components/app/todo-card.svelte": Layer.COMPONENTS,
      "src/lib/utils.ts": Layer.UTILS,
      "src/lib/config.ts": Layer.CONFIG,
      "src/env.ts": Layer.CONFIG,
    });
  });

  test("tests are recognised by folder, suffix, and the evals tree", () => {
    expect(layers([
      "tests/unit/foo.ts",
      "src/lib/services/notes/management.spec.ts",
      "src/evals/cases/memory.ts",
    ])).toEqual({
      "tests/unit/foo.ts": Layer.TESTS,
      "src/lib/services/notes/management.spec.ts": Layer.TESTS,
      "src/evals/cases/memory.ts": Layer.TESTS,
    });
  });

  test("paths outside src stay unknown", () => {
    expect(layers(["vite.config.ts", "scripts/build.ts"])).toEqual({
      "vite.config.ts": Layer.UNKNOWN,
      "scripts/build.ts": Layer.UNKNOWN,
    });
  });
});

describe("classifyFile — the name collisions the old engine failed", () => {
  test("a lib/hooks folder is client, not the framework hooks layer", () => {
    expect(layers(["src/lib/hooks/is-mobile.svelte.ts", "src/hooks.server.ts"])).toEqual({
      "src/lib/hooks/is-mobile.svelte.ts": Layer.CLIENT,
      "src/hooks.server.ts": Layer.HOOKS,
    });
  });

  test("a client adapter named *-repository is client, not repositories", () => {
    expect(layerOf("src/lib/client/note-sync/indexeddb-note-sync-repository.ts"))
      .toBe(Layer.CLIENT);
  });

  test("stores are their own layer, not routes", () => {
    expect(layerOf("src/lib/stores/workbench.svelte.ts")).toBe(Layer.STORES);
  });

  test("the .remote.ts marker beats the folder it sits in", () => {
    expect(layerOf("src/lib/remote/notes.remote.ts")).toBe(Layer.REMOTE);
  });

  test("a file in lib/remote without the marker is not the remote layer", () => {
    expect(classifyFile("src/lib/remote/resource-queries.ts"))
      .toEqual({ layer: Layer.CLIENT, classified: false });
  });

  test("a universal +page.ts is not a server route", () => {
    expect(layers(["src/routes/offline/+page.ts", "src/routes/offline/+page.svelte"])).toEqual({
      "src/routes/offline/+page.ts": Layer.COMPONENTS,
      "src/routes/offline/+page.svelte": Layer.COMPONENTS,
    });
  });

  test("a factories/ folder at a universal path is still the factory layer", () => {
    // Classification is by role, not by whether the placement is correct. The
    // wrongness of a composition root at a universal path is server-layer-leak's
    // job to report, not something to hide by misclassifying the file.
    expect(classifyFile("src/lib/factories/production-controller-factory.ts"))
      .toEqual({ layer: Layer.FACTORY, classified: true });
  });
});

describe("classifyFile — unclassified strays", () => {
  test("an ad-hoc lib folder is client-reachable and flagged", () => {
    expect(classifyFile("src/lib/navigation/safe-return-url.ts"))
      .toEqual({ layer: Layer.CLIENT, classified: false });
  });

  test("a loose file under $lib/server gets no layer", () => {
    expect(classifyFile("src/lib/server/telemetry.ts"))
      .toEqual({ layer: Layer.UNKNOWN, classified: false });
  });

  test("canonical locations are never flagged", () => {
    expect(classifyFile("src/lib/services/notes/management.ts").classified).toBe(true);
  });
});

describe("classifyFile — mode-conditional matchers", () => {
  test("the generated API client is config in BFF mode only", () => {
    expect({
      bff: layerOf("src/lib/api/client.ts", "sveltekit-bff"),
      standalone: layerOf("src/lib/api/client.ts", "sveltekit-standalone"),
    }).toEqual({ bff: Layer.CONFIG, standalone: Layer.CLIENT });
  });
});
