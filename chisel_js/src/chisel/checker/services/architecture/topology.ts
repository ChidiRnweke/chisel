import ts from "typescript";
import type { FileInfo } from "chisel/checker/models/file_info";
import type { IImportGraph } from "chisel/checker/repositories/protocols";
import type { ImportEdge } from "chisel/checker/models/import_edge";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { RuleInfo } from "chisel/checker/rule_metadata";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";
import { scriptsOf } from "chisel/checker/repositories/file_parser";

/**
 * Layer roots whose bare specifier means "the whole layer".
 *
 * Importing `$lib/models/notes` names a domain; importing `$lib/models` names
 * a layer, and the graph degenerates into everything-through-one-hub. Note
 * that a *domain* barrel is the sanctioned entry point — `import_boundary`
 * says so explicitly — so only the layer root itself is listed here.
 */
const LAYER_ROOTS: readonly string[] = [
  "$lib/models",
  "$lib/server/repositories",
  "$lib/server/services",
  "$lib/server/controllers",
  "$lib/components",
  "$lib/client",
  "$lib/stores",
];

/**
 * Directory names that describe nothing, and so collect anything.
 *
 * Deliberately short. `shared/` and `layout/` name a real presentation role in
 * plenty of codebases; `misc/` never does. `utils/` is absent because
 * `classifyFile` already gives it a layer of its own.
 */
const GENERIC_BUCKETS: ReadonlySet<string> = new Set([
  "misc",
  "common",
  "helpers",
  "pages",
  "panels",
]);

/** Where a component feature's public entry point lives. */
const COMPONENT_ROOT = "src/lib/components/";

/** The composition root: the one file that assembles the object graph. */
const COMPOSITION_ROOT_RE = /^src\/lib\/server\/application\.(?:ts|js)$/;

/** Wiring modules, wherever a project groups them. */
const FACTORY_MODULE_RE = /^src\/lib\/server\/factories\/.*-factory\.(?:ts|js)$/;

/** Placeholders used to break a cycle in the wiring rather than restructure it. */
const PLACEHOLDER_IDENTIFIER_RE = /^LateValue$/;

function lineOf(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

/** The feature a path under `src/lib/components/` belongs to, if any. */
function componentFeatureOf(path: string): string | undefined {
  if (!path.startsWith(COMPONENT_ROOT)) return undefined;
  const rest = path.slice(COMPONENT_ROOT.length);
  const slash = rest.indexOf("/");
  return slash === -1 ? undefined : rest.slice(0, slash);
}

/**
 * Rules about the shape of the tree, beyond who may import whom.
 *
 * Everything repo-specific is derived rather than configured: a feature is a
 * component folder that publishes an `index.ts`, and the composition root is
 * the `application.ts` chisel already treats as the factory layer. A checker
 * that needs a list of your feature names before it can run is a checker
 * nobody configures correctly.
 */
export class TopologyService {
  readonly ruleIdPrefix = "topology";

  constructor(private readonly importGraph: IImportGraph) {}

  check(project: ProjectInfo): Violation[] {
    const features = this._componentFeatures(project);

    return [
      ...this._genericBuckets(project),
      ...this._barrelImports(),
      ...this._deepFeatureImports(features),
      ...this._compositionRoot(project),
      ...this._factoryShapes(project),
    ];
  }

  /** Component folders that publish an entry point, and so have a contract. */
  private _componentFeatures(project: ProjectInfo): ReadonlySet<string> {
    const features = new Set<string>();
    for (const file of project.files) {
      const feature = componentFeatureOf(file.path);
      if (feature === undefined) continue;
      if (file.path === `${COMPONENT_ROOT}${feature}/index.ts`) features.add(feature);
    }
    return features;
  }

  /** Reported once per directory: the bucket is one decision, not one per file. */
  private _genericBuckets(project: ProjectInfo): Violation[] {
    const offenders = new Map<string, string>();

    for (const file of project.files) {
      if (!file.path.startsWith("src/")) continue;
      const segments = file.path.split("/").slice(0, -1);
      for (let i = 0; i < segments.length; i++) {
        const name = segments[i]!;
        if (!GENERIC_BUCKETS.has(name)) continue;
        const directory = segments.slice(0, i + 1).join("/");
        if (!offenders.has(directory)) offenders.set(directory, file.path);
      }
    }

    return [...offenders].map(([directory, path]) => createViolation({
      file: path,
      line: 1,
      severity: Severity.ERROR,
      ruleId: `${this.ruleIdPrefix}:generic-bucket-directory`,
      message:
        `${directory}/ names no concept, so it will collect anything. Nobody owns it and `
        + `nothing can be said about what belongs in it. Name the directory after what the `
        + `code does — or move each file to the feature that owns it. Reported once per `
        + `directory.`,
    }));
  }

  private _barrelImports(): Violation[] {
    const violations: Violation[] = [];

    for (const edge of this.importGraph.allImports) {
      if (!LAYER_ROOTS.includes(edge.specifier)) continue;
      violations.push(this._edgeViolation(edge, "layer-barrel-import",
        `Importing "${edge.specifier}" pulls in the whole layer rather than one domain. `
        + `A layer-wide barrel erases the boundary it is supposed to express: every `
        + `consumer depends on everything, and the graph collapses into one hub. Import `
        + `the domain you need — ${edge.specifier}/<domain>.`));
    }

    return violations;
  }

  private _deepFeatureImports(features: ReadonlySet<string>): Violation[] {
    const violations: Violation[] = [];

    for (const edge of this.importGraph.allImports) {
      const match = edge.specifier.match(/^\$lib\/components\/([^/]+)\/(.+)$/);
      if (match === null) continue;

      const feature = match[1]!;
      if (!features.has(feature)) continue;
      // Inside the feature, its own layout is its business.
      if (componentFeatureOf(edge.importer) === feature) continue;

      violations.push(this._edgeViolation(edge, "deep-feature-import",
        `"${edge.specifier}" reaches past the ${feature} feature's entry point into its `
        + `internals. The index.ts is the contract; everything behind it is free to move. `
        + `Import from $lib/components/${feature} and export what callers need from there.`));
    }

    return violations;
  }

  private _compositionRoot(project: ProjectInfo): Violation[] {
    const root = project.files.find(file => COMPOSITION_ROOT_RE.test(file.path));
    if (root === undefined) return [];

    return [
      ...this._compositionRootImports(root),
      ...this._compositionRootSource(root),
    ];
  }

  /**
   * The wiring depends on contracts, not implementations. A type-only import
   * of a concrete class is fine — it is erased, and naming a return type is
   * not the same as reaching for the class.
   */
  private _compositionRootImports(root: FileInfo): Violation[] {
    const violations: Violation[] = [];

    for (const edge of this.importGraph.allImports) {
      if (edge.importer !== root.path) continue;
      if (edge.isTypeOnly) continue;
      if (!/\/(?:repositories|services)\//.test(edge.imported)) continue;

      violations.push(this._edgeViolation(edge, "composition-root-concrete-import",
        `The composition root imports the concrete ${edge.imported}. It should receive `
        + `implementations from a factory and know only their interfaces — once the wiring `
        + `may reach for concretes ad hoc, every layering rule has an exception here.`));
    }

    return violations;
  }

  /**
   * Two properties of the wiring file itself: it constructs only factories, and
   * it closes cycles by restructuring rather than by parking a placeholder.
   */
  private _compositionRootSource(root: FileInfo): Violation[] {
    const violations: Violation[] = [];

    for (const { sf, offset } of scriptsOf(root.ast)) {
      const at = (node: ts.Node): number => lineOf(root.source, offset + node.getStart(sf));

      const visit = (node: ts.Node): void => {
        if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
          const name = node.expression.text;
          if (!name.endsWith("Factory")) {
            violations.push(createViolation({
              file: root.path,
              line: at(node),
              severity: Severity.ERROR,
              ruleId: `${this.ruleIdPrefix}:composition-root-construction`,
              message:
                `The composition root constructs ${name} directly. It should call a factory `
                + `and let that decide what to build; assembling objects here is how the `
                + `wiring slowly becomes the place that knows every concrete type.`,
            }));
          }
        }

        const isPlaceholderCast = ts.isAsExpression(node)
          && ts.isAsExpression(node.expression)
          && node.expression.type.kind === ts.SyntaxKind.UnknownKeyword
          && (node.expression.expression.kind === ts.SyntaxKind.NullKeyword
            || (ts.isIdentifier(node.expression.expression)
              && node.expression.expression.text === "undefined"));

        const isPlaceholderName = ts.isIdentifier(node)
          && PLACEHOLDER_IDENTIFIER_RE.test(node.text);

        if (isPlaceholderCast || isPlaceholderName) {
          violations.push(createViolation({
            file: root.path,
            line: at(node),
            severity: Severity.ERROR,
            ruleId: `${this.ruleIdPrefix}:composition-root-placeholder`,
            message:
              `A placeholder stands in for a real dependency here, which means two objects `
              + `in the graph need each other. Restructure so one no longer does — extract `
              + `what they share, or pass a lazy accessor with a real type. The placeholder `
              + `hides the design problem and fails at runtime instead of at build time.`,
          }));
        }

        ts.forEachChild(node, visit);
      };

      ts.forEachChild(sf, visit);
    }

    return violations;
  }

  /**
   * A convention only pays off when it is total: a `*-factory.ts` names one
   * thing to build, so it exports one thing. Types are not counted — a factory
   * naming its own dependency shape is exporting a contract, not a second
   * creator.
   */
  private _factoryShapes(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];

    for (const file of project.files) {
      if (!FACTORY_MODULE_RE.test(file.path)) continue;
      if (/\.(?:spec|test)\.(?:ts|js)$/.test(file.path)) continue;

      const exported = this._exportedValueNames(file);
      if (exported.length === 1) continue;

      violations.push(createViolation({
        file: file.path,
        line: 1,
        severity: Severity.ERROR,
        ruleId: `${this.ruleIdPrefix}:factory-shape`,
        message: exported.length === 0
          ? `A *-factory.ts exports no creator. The name promises one thing to build; `
            + `either export it or rename the file after what it actually holds.`
          : `A *-factory.ts exports ${exported.length} values (${exported.join(", ")}). `
            + `One factory module builds one thing — split it, so the filename keeps `
            + `telling the truth about what is inside.`,
      }));
    }

    return violations;
  }

  /** Exported values — functions, classes, consts. Types are erased and excluded. */
  private _exportedValueNames(file: FileInfo): string[] {
    const names: string[] = [];

    for (const { sf } of scriptsOf(file.ast)) {
      for (const statement of sf.statements) {
        const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
        const isExported = (modifiers ?? [])
          .some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
        if (!isExported) continue;

        if (ts.isVariableStatement(statement)) {
          for (const declaration of statement.declarationList.declarations) {
            if (ts.isIdentifier(declaration.name)) names.push(declaration.name.text);
          }
          continue;
        }
        if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
          if (statement.name !== undefined) names.push(statement.name.text);
        }
      }
    }

    return names;
  }

  private _edgeViolation(edge: ImportEdge, rule: string, message: string): Violation {
    return createViolation({
      file: edge.importer,
      line: edge.lineNumber,
      severity: Severity.ERROR,
      ruleId: `${this.ruleIdPrefix}:${rule}`,
      message,
    });
  }

  describeRules(): RuleInfo[] {
    return [
      {
        id: "topology:layer-barrel-import",
        category: this.ruleIdPrefix,
        description: "Import from a layer-wide barrel rather than a domain",
        fixGuidance:
          "Import the domain: $lib/models/notes, not $lib/models. A layer barrel makes "
          + "every consumer depend on everything and collapses the graph into one hub. "
          + "A domain's own index.ts remains the sanctioned entry point.",
      },
      {
        id: "topology:deep-feature-import",
        category: this.ruleIdPrefix,
        description: "Cross-feature import reaching past a feature's entry point",
        fixGuidance:
          "Import $lib/components/<feature> and export what callers need from its "
          + "index.ts. Deep imports turn every internal rename into a breaking change. "
          + "Within a feature, relative imports are fine.",
      },
      {
        id: "topology:generic-bucket-directory",
        category: this.ruleIdPrefix,
        description: "A directory named misc/, common/, helpers/, pages/ or panels/",
        fixGuidance:
          "Name the directory after what the code does, or move each file to the feature "
          + "that owns it. A directory that describes nothing collects anything. Reported "
          + "once per directory.",
      },
      {
        id: "topology:composition-root-concrete-import",
        category: this.ruleIdPrefix,
        description: "The composition root imports a concrete service or repository",
        fixGuidance:
          "Depend on the interface and let a factory supply the implementation. `import "
          + "type` is fine — it is erased. Once the wiring can reach for concretes, every "
          + "layering rule gets an exception here.",
      },
      {
        id: "topology:composition-root-construction",
        category: this.ruleIdPrefix,
        description: "The composition root constructs something other than a factory",
        fixGuidance:
          "Call a factory and let it decide what to build. Assembling objects in the "
          + "wiring is how it becomes the one file that knows every concrete type.",
      },
      {
        id: "topology:composition-root-placeholder",
        category: this.ruleIdPrefix,
        description: "Placeholder wiring (undefined as unknown as T, LateValue)",
        fixGuidance:
          "A placeholder means two objects need each other. Restructure so one does not — "
          + "extract the shared part, or pass a typed lazy accessor. The placeholder turns "
          + "a build error into a runtime one.",
      },
      {
        id: "topology:factory-shape",
        category: this.ruleIdPrefix,
        description: "A *-factory.ts does not export exactly one value",
        fixGuidance:
          "One factory module builds one thing. Split it, or rename the file after what it "
          + "actually holds. Exported types do not count — a factory may declare its own "
          + "dependency shape.",
      },
    ];
  }
}
