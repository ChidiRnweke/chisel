import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { RuleInfo } from "chisel/checker/rule_metadata";
import type { Violation } from "chisel/checker/models/violation";
import { Layer } from "chisel/checker/models/layer";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

/**
 * Folder names that name a layer when they sit directly under `$lib/server/`.
 * `db` is part of the repository layer: the schema is the repositories' own
 * data definition, not a peer they would have to import across a boundary.
 *
 * `factories` is wiring, not a layer in the import-direction sense, but it
 * earns a place here: once an app has more than a handful of factory modules,
 * leaving them flat at the server root means the directory listing stops
 * reading as architecture. Grouping them is allowed — not required.
 */
const SERVER_LAYER_FOLDERS = new Set([
  "repositories",
  "db",
  "services",
  "controllers",
  "factories",
]);

/** Files allowed directly under `$lib/server/`, rather than in a layer folder. */
const SERVER_ROOT_FILE_RE = /^src\/lib\/server\/([^/]*[Ff]actory|application|config|index)\.(ts|js)$/;

/**
 * Server-side layers that must live under `$lib/server/`, and where a universal
 * copy of each is found.
 */
const MISPLACED_LAYER_DIRS: ReadonlyArray<readonly [RegExp, string, string]> = [
  [/^src\/lib\/services\//, "src/lib/services/", "src/lib/server/services/"],
  [/^src\/lib\/controllers\//, "src/lib/controllers/", "src/lib/server/controllers/"],
  [/^src\/lib\/repositories\//, "src/lib/repositories/", "src/lib/server/repositories/"],
  [/^src\/lib\/(factories|factory)\//, "src/lib/factories/", "src/lib/server/"],
];

/**
 * Reports layers that are in the wrong place.
 *
 * `$lib/server/` is a runtime boundary SvelteKit enforces itself — it refuses
 * to bundle that subtree for the client. Putting the server-side layers there
 * means a component importing a service is a *build* error, not merely a lint
 * finding. A service at `src/lib/services/` gets none of that protection.
 *
 * Both rules report **once per directory**. A misplaced layer is one decision
 * to reverse, not one finding per file; reporting per file would bury every
 * other violation in the run.
 */
export class LayoutService {
  readonly ruleIdPrefix = "structure";

  check(project: ProjectInfo): Violation[] {
    return [
      ...this._misplacedLayers(project),
      ...this._unknownServerFolders(project),
      ...this._unclassified(project),
    ];
  }

  /**
   * Strays under `src/lib/` that matched no canonical location. Files under
   * `$lib/server/` are excluded — `unknown-server-folder` already reports those,
   * once per folder rather than once per file.
   */
  private _unclassified(project: ProjectInfo): Violation[] {
    return project.files
      .filter(file => !file.classified && !file.path.startsWith("src/lib/server/"))
      .map(file => createViolation({
        file: file.path,
        line: 1,
        severity: Severity.WARNING,
        ruleId: `${this.ruleIdPrefix}:unclassified-module`,
        message:
          `${file.path} matches no layer. It has been treated as ${file.layer} for `
          + `boundary checks. Move it into a canonical location so its rules are explicit.`,
      }));
  }

  private _misplacedLayers(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];

    for (const [pattern, from, to] of MISPLACED_LAYER_DIRS) {
      const first = project.files.find(file => pattern.test(file.path));
      if (first === undefined) continue;

      violations.push(createViolation({
        file: first.path,
        line: 1,
        severity: Severity.ERROR,
        ruleId: `${this.ruleIdPrefix}:layer-outside-server`,
        message:
          `${from} holds a server-side layer at a universal path. Move it to ${to}. `
          + `Under $lib/server SvelteKit refuses to bundle it for the client, so a `
          + `component importing it fails the build instead of shipping your data `
          + `layer to the browser.`,
      }));
    }

    return violations;
  }

  private _unknownServerFolders(project: ProjectInfo): Violation[] {
    const offenders = new Map<string, string>();

    for (const file of project.files) {
      if (!file.path.startsWith("src/lib/server/")) continue;
      if (SERVER_ROOT_FILE_RE.test(file.path)) continue;
      // Tests sit beside the code they cover; they are not a stray layer.
      if (file.layer === Layer.TESTS) continue;

      const rest = file.path.slice("src/lib/server/".length);
      const slash = rest.indexOf("/");
      const folder = slash === -1 ? undefined : rest.slice(0, slash);

      // A loose file directly under server/ that is not one of the allowed root
      // files is reported against its own path.
      const key = folder ?? rest;
      if (folder !== undefined && SERVER_LAYER_FOLDERS.has(folder)) continue;
      if (!offenders.has(key)) offenders.set(key, file.path);
    }

    return [...offenders].map(([name, path]) => createViolation({
      file: path,
      line: 1,
      severity: Severity.ERROR,
      ruleId: `${this.ruleIdPrefix}:unknown-server-folder`,
      message:
        `"${name}" is not a layer. $lib/server/ may contain only `
        + `${[...SERVER_LAYER_FOLDERS].sort().join("/, ")}/, plus config.ts and the `
        + `factory. Code that adapts an external capability — an AI client, a PDF `
        + `generator, a mail sender — is a service: it wraps one concern and returns `
        + `domain models. Repositories are persistence.`,
    }));
  }

  describeRules(): RuleInfo[] {
    return [
      {
        id: "structure:layer-outside-server",
        category: this.ruleIdPrefix,
        description: "A server-side layer sits at a universal path instead of under $lib/server/.",
        fixGuidance:
          "Move services, controllers, repositories and the factory under $lib/server/. "
          + "SvelteKit then makes a client import of them a build error, which is "
          + "stronger than anything a linter can offer. Reported once per directory.",
      },
      {
        id: "structure:unknown-server-folder",
        category: this.ruleIdPrefix,
        description: "A folder under $lib/server/ does not name a layer.",
        fixGuidance:
          "$lib/server/ holds db/, repositories/, services/, controllers/, factories/, "
          + "config.ts and the factory. An adapter for an external capability is a "
          + "service, not a repository — repositories are persistence. Wiring modules "
          + "may stay at the root or be grouped under factories/. Reported once per folder.",
      },
      {
        id: "structure:unclassified-module",
        category: this.ruleIdPrefix,
        description: "A src/lib/ module matches no canonical layer location.",
        fixGuidance:
          "Give it a home. An ad-hoc folder gets no boundary rules of its own, so it "
          + "silently opts out of the architecture it lives in.",
      },
    ];
  }
}
