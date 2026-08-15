import { describe, test, expect } from "bun:test";
import type { CheckerService } from "chisel/checker/controllers/check_controller";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { CheckController } from "chisel/checker/controllers/check_controller";
import { ImportGraph } from "chisel/checker/repositories/import_graph";
import { SuppressionService } from "chisel/checker/services/shared/suppression";
import { ImportGraphError } from "chisel/checker/errors";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";
import { defaultConfig } from "chisel/checker/config";
import { FakeImportGraph } from "../../fakes/fake_import_graph";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function withProject(files: Record<string, string>, fn: (root: string) => Promise<void>): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), "chisel-controller-"));
  const done = (async () => {
    for (const [path, content] of Object.entries(files)) {
      const full = join(root, path);
      mkdirSync(join(full, ".."), { recursive: true });
      writeFileSync(full, content);
    }
    await fn(root);
  })();
  return done.finally(() => rmSync(root, { recursive: true, force: true }));
}

/** A service that reports one violation per discovered file. */
class StubService implements CheckerService {
  readonly ruleIdPrefix = "stub";
  constructor(private readonly ruleId = "stub:always") {}

  check(project: ProjectInfo): Violation[] {
    return project.files.map(file => createViolation({
      file: file.path,
      line: 1,
      severity: Severity.ERROR,
      ruleId: this.ruleId,
      message: "stub",
    }));
  }

  describeRules() {
    return [{ id: this.ruleId, category: "stub", description: "d", fixGuidance: "f" }];
  }
}

describe("CheckController", () => {
  test("runs every service over the discovered files", async () => {
    await withProject({ "src/lib/utils.ts": "export const a = 1;\n" }, async root => {
      const controller = new CheckController({ services: [new StubService(), new StubService("stub:other")] });
      const result = await controller.check(root);
      expect({
        ruleIds: result.violations.map(v => v.ruleId).sort(),
        filesChecked: result.filesChecked,
      }).toEqual({ ruleIds: ["stub:always", "stub:other"], filesChecked: 1 });
    });
  });

  test("reads file source before handing files to services", async () => {
    await withProject({ "src/lib/utils.ts": "export const a = 1;\n" }, async root => {
      let seen = "";
      const spy: CheckerService = {
        ruleIdPrefix: "spy",
        check(project) { seen = project.files[0]?.source ?? ""; return []; },
        describeRules: () => [],
      };
      await new CheckController({ services: [spy] }).check(root);
      expect(seen).toBe("export const a = 1;\n");
    });
  });

  test("applies the exceptions registry", async () => {
    await withProject({
      "src/lib/utils.ts": "export const a = 1;\n",
      "chisel-exceptions.json": JSON.stringify({
        exceptions: [{ files: ["src/lib/*"], rules: ["stub:always"], reason: "test" }],
      }),
    }, async root => {
      const result = await new CheckController({ services: [new StubService()] }).check(root);
      expect(result.violations).toEqual([]);
    });
  });

  test("applies suppressions after exceptions", async () => {
    await withProject({
      "src/lib/utils.ts": "// chisel-ignore stub:always -- deliberate\nexport const a = 1;\n",
    }, async root => {
      const controller = new CheckController({
        services: [new StubService()],
        suppression: new SuppressionService(),
      });
      expect((await controller.check(root)).violations).toEqual([]);
    });
  });

  test("an exempted violation produces no missing-reason diagnostic", async () => {
    // Exceptions run first precisely so a rule silenced in the registry cannot
    // also be reported for lacking an inline reason.
    await withProject({
      "src/lib/utils.ts": "export const a = 1; // chisel-ignore stub:always\n",
      "chisel-exceptions.json": JSON.stringify({
        exceptions: [{ files: ["src/lib/*"], rules: ["stub:always"], reason: "test" }],
      }),
    }, async root => {
      const controller = new CheckController({
        services: [new StubService()],
        suppression: new SuppressionService(),
      });
      expect((await controller.check(root)).violations).toEqual([]);
    });
  });

  test("builds the import graph before running services", async () => {
    await withProject({ "src/lib/utils.ts": "export const a = 1;\n" }, async root => {
      let builtFirst = false;
      const graph = new FakeImportGraph();
      const probe: CheckerService = {
        ruleIdPrefix: "probe",
        check() { builtFirst = graph.allImports !== undefined; return []; },
        describeRules: () => [],
      };
      await new CheckController({ services: [probe], importGraph: graph }).check(root);
      expect(builtFirst).toBe(true);
    });
  });

  test("a graph build failure degrades to a warning instead of aborting the run", async () => {
    await withProject({ "src/lib/utils.ts": "export const a = 1;\n" }, async root => {
      const exploding = {
        build() { throw new ImportGraphError("boom"); },
        allImports: [],
        unresolved: [],
        warnings: [],
      };
      const result = await new CheckController({
        services: [new StubService()],
        importGraph: exploding,
      }).check(root);

      // The build failure is reported, and the other services still ran.
      expect(result.violations.map(v => v.ruleId).sort())
        .toEqual(["import-graph:build-failed", "stub:always"]);
    });
  });

  test("reports modules that match no canonical layer", async () => {
    // Owned by LayoutService, not the controller — the controller's job is
    // composition, and a rule it emitted itself could not be described by
    // `describeAllRules` or suppressed like any other.
    await withProject({ "src/lib/navigation/url.ts": "export const a = 1;\n" }, async root => {
      const { LayoutService } = await import("chisel/checker/services/architecture/layout");
      const result = await new CheckController({ services: [new LayoutService()] }).check(root);
      expect(result.violations.map(v => `${v.ruleId}:${v.severity}`))
        .toEqual(["structure:unclassified-module:warning"]);
    });
  });

  test("honours the ignore list from config", async () => {
    await withProject({
      "src/lib/utils.ts": "export const a = 1;\n",
      "src/lib/components/vendor/x.svelte": "<div>x</div>\n",
    }, async root => {
      const controller = new CheckController({
        services: [new StubService()],
        config: { ...defaultConfig(), ignore: ["src/lib/components/vendor/**"] },
      });
      const files = (await controller.check(root)).violations.map(v => v.file);
      expect(files).toEqual(["src/lib/utils.ts"]);
    });
  });

  test("describeAllRules includes the suppression rule, which is not a service", async () => {
    const controller = new CheckController({
      services: [new StubService()],
      suppression: new SuppressionService(),
    });
    expect(controller.describeAllRules().map(r => r.id).sort())
      .toEqual(["stub:always", "suppression:missing-reason"]);
  });

  test("real graph and real services compose end to end", async () => {
    await withProject({
      "tsconfig.json": '{"compilerOptions":{"baseUrl":".","paths":{"$lib/*":["src/lib/*"]}}}',
      "src/lib/models/a.ts": 'import { helper } from "$lib/utils";\nexport const a = helper;\n',
      "src/lib/utils.ts": "export const helper = 1;\n",
    }, async root => {
      const { ImportBoundaryService } = await import("chisel/checker/services/architecture/import_boundary");
      const graph = new ImportGraph();
      const result = await new CheckController({
        services: [new ImportBoundaryService(graph)],
        importGraph: graph,
      }).check(root);

      expect(result.violations.map(v => `${v.ruleId}@${v.file}:${v.line}`))
        .toEqual(["import-boundary:layer-no-internal-imports@src/lib/models/a.ts:1"]);
    });
  });
});
