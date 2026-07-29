import type { CheckerMode } from "chisel/checker/models/mode";
import type { ImportEdge } from "chisel/checker/models/import_edge";
import type { IImportGraph } from "chisel/checker/repositories/protocols";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { RuleInfo } from "chisel/checker/rule_metadata";
import type { Violation } from "chisel/checker/models/violation";
import { CheckerMode as Mode } from "chisel/checker/models/mode";
import { Layer, isServerContext } from "chisel/checker/models/layer";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

/**
 * Which internal layers each layer may not import.
 *
 * Three-valued, mirroring `import_boundary.py`'s `_BANNED_INTERNAL_LAYERS`:
 *  - `null` — may import nothing internal at all (the pure layers).
 *  - a set — those target layers are banned.
 *  - **absent from the map** — unrestricted.
 *
 * That last case inverts the Python sibling, where an absent layer is treated
 * as pure. It has to: Python's tests live outside the checked package, but a
 * SvelteKit project's `*.spec.ts` files sit in `src/` and must be free to
 * import every layer they exercise.
 */
const BANNED_INTERNAL: ReadonlyMap<Layer, ReadonlySet<Layer> | null> = new Map([
  [Layer.MODELS, null],
  [Layer.ERRORS, null],
  [Layer.CONFIG, null],

  [Layer.UTILS, new Set([
    Layer.SERVICES, Layer.REPOSITORIES, Layer.CONTROLLERS, Layer.FACTORY,
    Layer.ROUTES, Layer.REMOTE, Layer.HOOKS, Layer.STORES, Layer.CLIENT,
    Layer.COMPONENTS, Layer.CONFIG,
  ])],

  // `SERVICES` and `CONTROLLERS` list themselves: one service never imports
  // another, one controller never chains to another. `REPOSITORIES` does not —
  // per Python's table, a repository may compose another (a transaction wrapper
  // over a concrete store).
  [Layer.SERVICES, new Set([
    Layer.SERVICES, Layer.CONTROLLERS, Layer.FACTORY, Layer.ROUTES, Layer.REMOTE,
    Layer.HOOKS, Layer.CONFIG, Layer.STORES, Layer.CLIENT, Layer.COMPONENTS,
  ])],

  [Layer.REPOSITORIES, new Set([
    Layer.SERVICES, Layer.CONTROLLERS, Layer.FACTORY, Layer.ROUTES, Layer.REMOTE,
    Layer.HOOKS, Layer.CONFIG, Layer.STORES, Layer.CLIENT, Layer.COMPONENTS,
  ])],

  [Layer.CONTROLLERS, new Set([
    Layer.CONTROLLERS, Layer.REPOSITORIES, Layer.FACTORY, Layer.ROUTES, Layer.REMOTE,
    Layer.HOOKS, Layer.CONFIG, Layer.STORES, Layer.CLIENT, Layer.COMPONENTS,
  ])],

  // The composition root is the one place allowed to know every concrete type.
  // Its constraint is "no logic", enforced separately in structural.ts.
  [Layer.FACTORY, new Set<Layer>()],

  [Layer.ROUTES, new Set([Layer.SERVICES, Layer.REPOSITORIES, Layer.CONTROLLERS])],
  [Layer.REMOTE, new Set([Layer.SERVICES, Layer.REPOSITORIES, Layer.CONTROLLERS])],
  [Layer.HOOKS, new Set([Layer.SERVICES, Layer.REPOSITORIES, Layer.CONTROLLERS])],

  // `remote` is absent from all three client-side rows on purpose: calling a
  // remote function from a component, store, or client adapter is exactly what
  // remote functions are for. They are the sanctioned way for client code to
  // reach the server without importing any of it.
  [Layer.STORES, new Set([
    Layer.SERVICES, Layer.REPOSITORIES, Layer.CONTROLLERS, Layer.FACTORY,
    Layer.ROUTES, Layer.CONFIG,
  ])],

  [Layer.CLIENT, new Set([
    Layer.SERVICES, Layer.REPOSITORIES, Layer.CONTROLLERS, Layer.FACTORY,
    Layer.CONFIG, Layer.ROUTES, Layer.HOOKS,
  ])],

  [Layer.COMPONENTS, new Set([
    Layer.SERVICES, Layer.REPOSITORIES, Layer.CONTROLLERS, Layer.FACTORY,
    Layer.CONFIG, Layer.ROUTES, Layer.HOOKS,
  ])],
]);

/** Third-party packages that only certain layers may import. */
const PACKAGE_RULES: readonly {
  readonly match: (specifier: string) => boolean;
  readonly allowed: ReadonlySet<Layer>;
  readonly rule: string;
  readonly message: string;
  readonly modes?: ReadonlySet<CheckerMode>;
}[] = [
  {
    match: s => s === "drizzle-orm" || s.startsWith("drizzle-orm/"),
    allowed: new Set([Layer.REPOSITORIES]),
    rule: "orm-leak",
    message: "ORM types never leave the repository layer. Query inside a repository "
      + "and return a domain model from $lib/models.",
  },
  {
    match: s => s === "@sveltejs/kit" || s.startsWith("@sveltejs/kit/"),
    allowed: new Set([Layer.ROUTES, Layer.REMOTE, Layer.HOOKS, Layer.FACTORY, Layer.COMPONENTS, Layer.CLIENT, Layer.STORES]),
    rule: "framework-leak",
    message: "This layer must have no framework knowledge. Keep @sveltejs/kit in "
      + "routes, remote functions, and hooks.",
  },
  {
    match: s => s === "openapi-fetch",
    allowed: new Set([Layer.CONFIG, Layer.FACTORY]),
    rule: "api-client-location",
    message: "The API client is constructed once, in the factory. Import the client "
      + "type elsewhere, never the constructor.",
    modes: new Set([Mode.BFF]),
  },
];

/**
 * Specifiers that are server-only by SvelteKit's own rules. Importing one from
 * a client-reachable module is a build error in SvelteKit; catching it here
 * reports it earlier, with the layer named.
 */
const SERVER_ONLY_SPECIFIERS: readonly { readonly match: (s: string) => boolean; readonly what: string }[] = [
  { match: s => s === "$env/static/private" || s === "$env/dynamic/private", what: "Private environment variables" },
  { match: s => s === "$app/server" || s.startsWith("$app/server/"), what: "$app/server" },
];

export class ImportBoundaryService {
  readonly ruleIdPrefix = "import-boundary";

  constructor(
    private readonly graph: IImportGraph,
    private readonly mode: CheckerMode = Mode.STANDALONE,
  ) {}

  check(project: ProjectInfo): Violation[] {
    const layers = new Map(project.files.map(f => [f.path, f.layer]));
    const violations: Violation[] = [];

    for (const edge of this.graph.allImports) {
      violations.push(...this._checkEdge(edge, layers));
    }
    return violations;
  }

  private _checkEdge(edge: ImportEdge, layers: ReadonlyMap<string, Layer>): Violation[] {
    const importerLayer = layers.get(edge.importer);
    if (importerLayer === undefined) return [];

    if (!edge.resolved) return [this._unresolved(edge)];

    return edge.isInternal
      ? this._checkInternal(edge, importerLayer, layers)
      : this._checkExternal(edge, importerLayer);
  }

  private _checkInternal(
    edge: ImportEdge,
    importerLayer: Layer,
    layers: ReadonlyMap<string, Layer>,
  ): Violation[] {
    const importedLayer = layers.get(edge.imported);
    if (importedLayer === undefined) return [];

    const banned = BANNED_INTERNAL.get(importerLayer);
    if (banned === undefined) return [];

    // A barrel aggregates its own layer, exactly as `__init__.py` does for a
    // Python package. It declares a public surface rather than coupling two
    // siblings, and is the only same-level import allowed anywhere.
    if (importedLayer === importerLayer && isBarrel(edge.importer)) {
      return [];
    }

    if (banned === null) {
      // `null` means nothing internal *at all*, including this layer's own
      // files. Python's table says the same, but `import_boundary.py:172`
      // returns early on a same-layer edge and so never enforces it.
      return [this._violation(edge, "layer-no-internal-imports",
        importedLayer === importerLayer
          ? `${importerLayer} is pure data with no dependencies — not even on other `
            + `${importerLayer} (${edge.imported}). One file per domain, each `
            + `self-contained: a type belongs with the model that owns it, so NoteId `
            + `lives in notes.ts beside Note. A shared kernel like shared.ts is the `
            + `thing to remove — distribute those types to their domains. Consumers `
            + `reach the layer through its index.ts barrel.`
          : `The ${importerLayer} layer imports nothing internal. `
            + `It must not depend on ${importedLayer} (${edge.imported}).`)];
    }

    if (!banned.has(importedLayer)) return [];

    return [this._violation(edge, "banned-layer-import",
      `${importerLayer} must not import ${importedLayer} (${edge.imported}). `
      + `${fixFor(importerLayer, importedLayer)}`)];
  }

  private _checkExternal(edge: ImportEdge, importerLayer: Layer): Violation[] {
    // Layers absent from the matrix are unrestricted, and that has to include
    // their third-party imports: a migration script under `scripts/` and a
    // `*.spec.ts` both legitimately reach for the ORM directly.
    if (!BANNED_INTERNAL.has(importerLayer)) return [];

    const violations: Violation[] = [];

    for (const rule of PACKAGE_RULES) {
      if (rule.modes !== undefined && !rule.modes.has(this.mode)) continue;
      if (!rule.match(edge.specifier)) continue;
      if (rule.allowed.has(importerLayer)) continue;
      violations.push(this._violation(edge, rule.rule,
        `"${edge.specifier}" is not importable from the ${importerLayer} layer. ${rule.message}`));
    }

    for (const server of SERVER_ONLY_SPECIFIERS) {
      if (!server.match(edge.specifier)) continue;
      if (isServerContext(edge.importer) || importerLayer === Layer.CONFIG) continue;
      violations.push(this._violation(edge, "server-only-specifier",
        `${server.what} ("${edge.specifier}") may only be imported from server-only modules. `
        + `${edge.importer} is reachable from the client bundle.`));
    }

    return violations;
  }

  private _unresolved(edge: ImportEdge): Violation {
    return this._violation(edge, "unresolved-import",
      `"${edge.specifier}" resolves to no file in this project. `
      + `A dangling import is invisible to every layer rule — fix the path, or `
      + `run \`svelte-kit sync\` if the alias comes from .svelte-kit/tsconfig.json.`);
  }

  private _violation(edge: ImportEdge, suffix: string, message: string): Violation {
    return createViolation({
      file: edge.importer,
      line: edge.lineNumber,
      severity: Severity.ERROR,
      ruleId: `${this.ruleIdPrefix}:${suffix}`,
      message,
    });
  }

  describeRules(): RuleInfo[] {
    const category = this.ruleIdPrefix;
    return [
      {
        id: "import-boundary:layer-no-internal-imports",
        category,
        description: "A pure layer (models, errors, config) imported another internal layer — "
          + "including another file of its own layer.",
        fixGuidance: "models, errors and config sit at the bottom of the dependency graph. "
          + "Importing upward: move the shared type down into models. Importing sideways: "
          + "one model file per domain, self-contained — the ID type lives with the model "
          + "that owns it. A shared.ts kernel of branded IDs is the anti-pattern, not the "
          + "fix; distribute those types to their domains. An index.ts barrel is the "
          + "layer's surface for consumers, and cannot resolve a file-to-file dependency "
          + "inside the layer.",
      },
      {
        id: "import-boundary:banned-layer-import",
        category,
        description: "An import crossed a layer boundary in a banned direction.",
        fixGuidance: "Dependencies point one way: components/stores/client -> routes/remote -> "
          + "factory -> controllers -> services -> repositories. Import the interface, "
          + "or get the value from the layer above.",
      },
      {
        id: "import-boundary:orm-leak",
        category,
        description: "Drizzle was imported outside the repository layer.",
        fixGuidance: "ORM types never leave the repository layer. Query inside a repository "
          + "and return a domain model.",
      },
      {
        id: "import-boundary:framework-leak",
        category,
        description: "@sveltejs/kit was imported by a layer that must stay framework-agnostic.",
        fixGuidance: "Services, repositories, controllers and stores know nothing about "
          + "SvelteKit. Handle framework concerns in the route or remote function.",
      },
      {
        id: "import-boundary:server-only-specifier",
        category,
        description: "$app/server or a private $env entry point was imported from a "
          + "client-reachable module.",
        fixGuidance: "Move the import into a *.server.ts, a *.remote.ts, or a module under "
          + "$lib/server.",
      },
      {
        id: "import-boundary:api-client-location",
        category,
        description: "The generated API client was constructed outside the factory (BFF mode).",
        fixGuidance: "Construct the client once in the factory and inject it. Import only its "
          + "type elsewhere.",
      },
      {
        id: "import-boundary:unresolved-import",
        category,
        description: "An import specifier resolved to no file in the project.",
        fixGuidance: "Fix the path. A dangling import is invisible to every layer rule, so it "
          + "hides architectural violations as well as being broken.",
      },
    ];
  }
}

/**
 * A barrel: any `index.ts` / `index.js`, at any depth.
 *
 * The Python analogue is `__init__.py`, which aggregates at every package
 * level rather than only at the top — so `models/agent/index.ts` re-exporting
 * `models/agent/runs.ts` is as legitimate as `models/index.ts` doing the same.
 *
 * Deliberately not narrowed to re-export statements only. `export * from './x'`
 * and `import { A } from './x'; export { A };` mean the same thing, and
 * flagging the second would be a distinction without a difference.
 */
function isBarrel(path: string): boolean {
  return /(^|\/)index\.(ts|js)$/.test(path);
}

function fixFor(importer: Layer, imported: Layer): string {
  // Same-layer cases first: they are the specific advice, and would otherwise be
  // swallowed by the generic "go through the factory" guidance below.
  if (importer === Layer.SERVICES && imported === Layer.SERVICES) {
    return "One service never imports another. If you need a shared type, it is domain "
      + "data — move it to $lib/models. Service-local data is fine, but no other "
      + "service may reach for it. If you need the behaviour, orchestrate both "
      + "services from a controller.";
  }
  if (importer === Layer.CONTROLLERS && imported === Layer.CONTROLLERS) {
    return "Controllers do not chain. Compose the services they need instead, and put "
      + "any shared type in $lib/models.";
  }
  if (imported === Layer.REPOSITORIES) {
    return "Depend on the repository interface and let the factory inject the implementation.";
  }
  if (imported === Layer.SERVICES || imported === Layer.CONTROLLERS) {
    return "Go through the factory: routes and remote functions are the only entry points.";
  }
  if (imported === Layer.FACTORY) {
    return "Only routes and remote functions build from the factory.";
  }
  return "Move the dependency to a layer that is allowed to hold it.";
}
