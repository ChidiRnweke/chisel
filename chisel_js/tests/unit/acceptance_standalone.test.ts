import { describe, test, expect, beforeAll } from "bun:test";
import type { CheckResult } from "chisel/checker/models/result";
import { CheckerFactory } from "chisel/checker/factory";
import { defaultConfig } from "chisel/checker/config";
import { CheckerMode } from "chisel/checker/models/mode";
import { join } from "node:path";

const FIXTURE = join(import.meta.dir, "../fixtures/standalone-app");

let result: CheckResult;

/** Every violation as "rule @ file:line", which is what a user actually reads. */
function findings(prefix: string): string[] {
  return result.violations
    .filter(v => v.ruleId.startsWith(prefix))
    .map(v => `${v.ruleId} @ ${v.file}:${v.line}`)
    .sort();
}

beforeAll(async () => {
  const controller = CheckerFactory.createController({
    config: defaultConfig(CheckerMode.STANDALONE),
  });
  result = await controller.check(FIXTURE);
});

/**
 * The specimen tree is the acceptance fixture for the refactor: each planted
 * anti-pattern must produce exactly the violation it stands for, at the line it
 * actually sits on. Asserting the full set rather than individual presence is
 * deliberate — it catches new false positives as well as lost coverage.
 */
describe("acceptance: standalone SSR specimen", () => {
  test("layer boundary violations", () => {
    expect(findings("import-boundary:banned-layer-import")).toEqual([
      // A component must not reach a repository, nor a service.
      "import-boundary:banned-layer-import @ src/lib/components/app/note-card.svelte:3",
      "import-boundary:banned-layer-import @ src/lib/components/app/note-card.svelte:5",
      // A store must not reach a controller.
      "import-boundary:banned-layer-import @ src/lib/stores/notes.svelte.ts:2",
      "import-boundary:banned-layer-import @ src/routes/offline/+page.ts:3",
    ]);
  });

  test("models are pure data, even of each other", () => {
    expect(findings("import-boundary:layer-no-internal-imports")).toEqual([
      "import-boundary:layer-no-internal-imports @ src/lib/models/domain.ts:2",
    ]);
  });

  test("server-side layers at a universal path, reported once per directory", () => {
    // Not once per file: a misplaced layer is one decision to reverse.
    expect(findings("structure:layer-outside-server")).toEqual([
      "structure:layer-outside-server @ src/lib/factories/production-controller-factory.ts:1",
      "structure:layer-outside-server @ src/lib/services/notes/search.ts:1",
    ]);
  });

  test("a folder under $lib/server that is not a layer", () => {
    expect(findings("structure:unknown-server-folder")).toEqual([
      "structure:unknown-server-folder @ src/lib/server/domain/openai-client.ts:1",
    ]);
  });

  test("an API route that should be a remote function", () => {
    // The auth callback beside it is genuinely HTTP and must stay silent.
    expect(findings("route-style:")).toEqual([
      "route-style:prefer-remote-function @ src/routes/api/notes/+server.ts:1",
    ]);
  });

  test("a hardcoded palette colour", () => {
    expect(findings("colour:")).toEqual([
      "colour:palette-class-banned @ src/lib/components/app/note-badge.svelte:6",
    ]);
  });

  test("the dangling alias the old regex engine passed silently", () => {
    expect(findings("import-boundary:unresolved-import")).toEqual([
      "import-boundary:unresolved-import @ src/lib/services/notes/search.ts:2",
    ]);
  });

  test("ORM outside the repository layer", () => {
    expect(findings("import-boundary:orm-leak")).toEqual([
      "import-boundary:orm-leak @ src/lib/services/notes/stats.ts:2",
    ]);
  });

  test("server code reachable from the client bundle", () => {
    expect(findings("server-layer-leak")).toEqual([
      "server-layer-leak:client-reachable-import @ src/lib/components/app/note-card.svelte:3",
      "server-layer-leak:client-reachable-import @ src/lib/components/app/note-card.svelte:5",
      // A composition root at a universal path.
      "server-layer-leak:client-reachable-import @ src/lib/factories/production-controller-factory.ts:3",
      "server-layer-leak:client-reachable-import @ src/lib/stores/notes.svelte.ts:2",
      // The universal +page.ts, not its +page.server.ts sibling.
      "server-layer-leak:client-reachable-import @ src/routes/offline/+page.ts:3",
    ]);
  });

  test("ad-hoc folders and marker-less layer members are surfaced", () => {
    expect(findings("structure:unclassified-module")).toEqual([
      // A generic bucket is reported twice, saying two different things: it
      // matches no layer, and its name will let it collect anything.
      "structure:unclassified-module @ src/lib/misc/scratch.ts:1",
      "structure:unclassified-module @ src/lib/navigation/safe-return-url.ts:1",
      "structure:unclassified-module @ src/lib/remote/resource-queries.ts:1",
    ]);
  });

  test("wiring grouped under server/factories is a layer, not a stray folder", () => {
    // The rule used to forbid this layout outright, so a repo that grouped its
    // wiring needed a permanent exception. Only the shape of the module is
    // reported now, never the folder.
    expect(findings("structure:unknown-server-folder")).toEqual([
      "structure:unknown-server-folder @ src/lib/server/domain/openai-client.ts:1",
    ]);
  });

  test("topology: the tree's shape beyond who imports whom", () => {
    expect(findings("topology:")).toEqual([
      "topology:composition-root-concrete-import @ src/lib/server/application.ts:2",
      "topology:composition-root-construction @ src/lib/server/application.ts:11",
      "topology:composition-root-placeholder @ src/lib/server/application.ts:13",
      "topology:deep-feature-import @ src/lib/components/app/note-list.svelte:5",
      "topology:factory-shape @ src/lib/server/factories/broken-factory.ts:1",
      "topology:generic-bucket-directory @ src/lib/misc/scratch.ts:1",
      "topology:layer-barrel-import @ src/lib/components/app/note-list.svelte:3",
    ]);
  });

  test("test quality beyond what the import graph can see", () => {
    expect(findings("test-structure:")).toEqual([
      "test-structure:interaction-assertion @ src/lib/server/services/notes/management.spec.ts:18",
      "test-structure:unsafe-dependency-cast @ src/lib/server/services/notes/management.spec.ts:12",
      "test-structure:untyped-fake @ src/lib/server/services/notes/management.spec.ts:4",
    ]);
  });

  test("configuration and documentation that no longer describe the tree", () => {
    expect(findings("coherence:")).toEqual([
      "coherence:broken-doc-path @ README.md:44",
      "coherence:empty-test-glob @ vitest.config.ts:4",
    ]);
  });

  test("no graph rule reports at the old hardcoded line 1", () => {
    const graphRules = result.violations.filter(v =>
      v.ruleId.startsWith("import-boundary:") || v.ruleId.startsWith("server-layer-leak:"),
    );
    expect({
      reportedSome: graphRules.length > 0,
      atLineOne: graphRules.filter(v => v.line === 1).map(v => v.ruleId),
    }).toEqual({ reportedSome: true, atLineOne: [] });
  });
});

describe("acceptance: what must NOT be reported", () => {
  test("a type-only import of a server module is not a leak", () => {
    const leaks = result.violations.filter(v =>
      v.file === "src/lib/components/app/note-title.svelte",
    );
    expect(leaks).toEqual([]);
  });

  test("lib/hooks is not confused with the framework hooks layer", () => {
    expect(result.violations.filter(v => v.file === "src/lib/hooks/is-mobile.svelte.ts"))
      .toEqual([]);
  });

  test("a client adapter named *-repository is not treated as a repository", () => {
    expect(result.violations.filter(v =>
      v.file === "src/lib/client/note-sync/indexeddb-note-sync-repository.ts",
    )).toEqual([]);
  });

  test("the conformant server spine is clean", () => {
    const clean = [
      "src/lib/server/app-factory.ts",
      "src/lib/server/repositories/postgres-notes.ts",
      "src/lib/server/db/schema.ts",
      "src/lib/server/services/notes/management.ts",
      "src/lib/server/controllers/notes/controller.ts",
      "src/routes/notes/+page.server.ts",
      "src/routes/auth/callback/+server.ts",
      "src/lib/remote/notes.remote.ts",
      "src/hooks.server.ts",
    ];
    const graphRules = result.violations
      .filter(v => v.ruleId.startsWith("import-boundary:") || v.ruleId.startsWith("server-layer-leak:"))
      .filter(v => clean.includes(v.file));
    expect(graphRules).toEqual([]);
  });

  test("no responsiveness rule exists any more", () => {
    expect(result.violations.filter(v => v.ruleId.startsWith("responsiveness:"))).toEqual([]);
  });

  /**
   * False positives measured against a real SvelteKit app, each now a permanent
   * specimen. Every one came from a rule matching text instead of nodes.
   */
  test("interface method signatures are not non-static factory methods", () => {
    // 20 findings on the specimen repo, all from an `export interface
    // ControllerFactory { workspace(): C }` sitting beside the factory.
    expect(result.violations.filter(v => v.ruleId === "structural:factory-static-only"))
      .toEqual([]);
  });

  test("a local readable() helper is not the Svelte 4 store API", () => {
    // The old regex matched the bare word, so a string formatter named
    // `readable` had every call site reported.
    expect(result.violations.filter(v => v.ruleId === "structural:writable-banned"))
      .toEqual([]);
  });

  test("a multi-line json(payload, { status }) keeps its exemption", () => {
    // The exemption used to be evaluated line-locally, so spreading the call
    // across lines defeated it.
    expect(result.violations.filter(v =>
      v.ruleId === "error-flow:raw-http-status"
      && v.file === "src/routes/api/health/+server.ts",
    )).toEqual([]);
  });
});

describe("acceptance: mode affects the active rule set", () => {
  test("BFF-only rules are absent in standalone mode", () => {
    const standalone = CheckerFactory.createController({
      config: defaultConfig(CheckerMode.STANDALONE),
    });
    const rules = standalone.describeAllRules();
    const ids = rules.map(r => r.id);
    expect({
      apiEndpointRules: rules.filter(r => r.category === "api-endpoints"),
      hasBoundary: ids.includes("import-boundary:banned-layer-import"),
      hasLeak: ids.includes("server-layer-leak:client-reachable-import"),
      hasSuppression: ids.includes("suppression:missing-reason"),
    }).toEqual({
      apiEndpointRules: [],
      hasBoundary: true,
      hasLeak: true,
      hasSuppression: true,
    });
  });

  test("BFF mode adds the api-endpoints rules back", () => {
    const bff = CheckerFactory.createController({ config: defaultConfig(CheckerMode.BFF) });
    const categories = bff.describeAllRules().map(r => r.category);
    expect(categories).toContain("api-endpoints");
  });

  test("the design system rules run in both modes", () => {
    for (const mode of [CheckerMode.STANDALONE, CheckerMode.BFF]) {
      const ids = CheckerFactory.createController({ config: defaultConfig(mode) })
        .describeAllRules().map(r => r.id);
      expect({
        hasButtonRule: ids.includes("component-enforcement:html-button-banned"),
        hasColourRules: ids.some(id => id.startsWith("colour:")),
      }).toEqual({ hasButtonRule: true, hasColourRules: true });
    }
  });
});
