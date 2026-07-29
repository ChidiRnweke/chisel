import type { IImportGraph } from "chisel/checker/repositories/protocols";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { RuleInfo } from "chisel/checker/rule_metadata";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";
import { UNRESTRICTED_LAYERS, isServerContext, isServerOnlyModule } from "chisel/checker/models/layer";

/**
 * Reports a server-only module being imported from somewhere the client bundle
 * can reach.
 *
 * SvelteKit already fails the build when `$lib/server` is reachable from client
 * code, so this rule is not the whole of the protection — it earns its place by
 * covering what the framework check does not: the `.server.ts` naming
 * convention outside `$lib/server`, and the distinction between a
 * `+page.server.ts` and the universal `+page.ts` sitting beside it. It also
 * reports at lint time with the layers named, rather than at build time.
 */
export class ServerLayerLeakService {
  readonly ruleIdPrefix = "server-layer-leak";

  constructor(private readonly graph: IImportGraph) {}

  check(project: ProjectInfo): Violation[] {
    const layers = new Map(project.files.map(f => [f.path, f.layer]));
    const violations: Violation[] = [];

    for (const edge of this.graph.allImports) {
      if (!edge.resolved || !edge.isInternal) continue;

      // A type-only import is erased before bundling. It is still layer
      // coupling — which import-boundary reports — but nothing leaks.
      if (edge.isTypeOnly) continue;

      if (!isServerOnlyModule(edge.imported)) continue;
      if (isServerContext(edge.importer)) continue;

      const importerLayer = layers.get(edge.importer);
      if (importerLayer === undefined) continue;
      // A test or a standalone script is not part of the client bundle.
      if (UNRESTRICTED_LAYERS.has(importerLayer)) continue;

      violations.push(createViolation({
        file: edge.importer,
        line: edge.lineNumber,
        severity: Severity.ERROR,
        ruleId: `${this.ruleIdPrefix}:client-reachable-import`,
        message:
          `${edge.imported} is server-only, but ${edge.importer} (${importerLayer}) is `
          + `reachable from the client bundle. Move this work into a +page.server.ts, a `
          + `*.remote.ts, or a module under $lib/server — or import only the type.`,
      }));
    }

    return violations;
  }

  describeRules(): RuleInfo[] {
    return [{
      id: "server-layer-leak:client-reachable-import",
      category: this.ruleIdPrefix,
      description: "A client-reachable module imported a server-only module.",
      fixGuidance:
        "Server-only code lives under $lib/server or in a *.server.ts / *.remote.ts file, "
        + "and may only be imported from other server-only modules. A universal +page.ts is "
        + "not server-only, even next to a +page.server.ts. Import types with `import type`.",
    }];
  }
}
