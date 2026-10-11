import ts from "typescript";
import { join } from "node:path";
import type { CheckerMode } from "chisel/checker/models/mode";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { RuleInfo } from "chisel/checker/rule_metadata";
import type { Violation } from "chisel/checker/models/violation";
import type { ArchitectureRule, SemanticLayer } from "chisel/checker/services/architecture/semantic_analyzer";
import { ConfigError } from "chisel/checker/errors";
import { Layer, isBrowserService } from "chisel/checker/models/layer";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";
import { classifyFile } from "chisel/checker/repositories/file_discovery";
import { analyzeArchitecture } from "chisel/checker/services/architecture/semantic_analyzer";

/** Facts the semantic rules need that the tree cannot tell them. */
export interface SemanticOptions {
  readonly mode: CheckerMode;
  /** tsconfig path, relative to the project root. */
  readonly tsconfig: string;
  /** Process entry points beyond hooks, routes and remote functions. */
  readonly entryPoints: readonly string[];
  /** Folder whose modules turn controller operations into agent tools. */
  readonly agentTools?: string;
}

const TEST_FILE_RE = /\.(?:spec|test|e2e)\.ts$|\.d\.ts$/;

/**
 * The rules that need the type checker: who a call reaches, what an operation
 * returns, what a service keeps between calls. See `semantic_analyzer.ts`.
 */
export class SemanticArchitectureService {
  readonly ruleIdPrefix = "architecture";

  constructor(private readonly options: SemanticOptions) {}

  check(project: ProjectInfo): Violation[] {
    const files: Record<string, string> = {};
    for (const file of project.files) {
      if (!file.path.startsWith("src/") || file.language === "js" || TEST_FILE_RE.test(file.path)) continue;
      files[file.path] = file.source;
    }
    if (Object.keys(files).length === 0) return [];

    const findings = analyzeArchitecture(
      files,
      project.rootPath,
      this._compilerOptions(project.rootPath),
      path => semanticLayerOf(path, this.options),
      path => classifyFile(path, this.options.mode).layer === Layer.TESTS,
      isBrowserService,
    );
    return findings.map(finding => createViolation({
      file: finding.file,
      line: finding.line,
      severity: Severity.ERROR,
      ruleId: `${this.ruleIdPrefix}:${finding.rule}`,
      message: finding.provenance.length === 0
        ? finding.message
        : `${finding.message} Via ${finding.provenance.join(" -> ")}.`,
    }));
  }

  /** The project's compiler options, so aliases resolve exactly as the build does. */
  private _compilerOptions(rootPath: string): ts.CompilerOptions {
    const path = join(rootPath, this.options.tsconfig);
    if (!ts.sys.fileExists(path)) return {};
    const file = ts.readConfigFile(path, ts.sys.readFile);
    if (file.error !== undefined) {
      throw new ConfigError(ts.flattenDiagnosticMessageText(file.error.messageText, "\n"));
    }
    const parsed = ts.parseJsonConfigFileContent(file.config, ts.sys, rootPath);
    if (parsed.errors.length > 0) {
      throw new ConfigError(parsed.errors
        .map(error => ts.flattenDiagnosticMessageText(error.messageText, "\n"))
        .join("\n"));
    }
    return parsed.options;
  }

  describeRules(): RuleInfo[] {
    const rule = (id: ArchitectureRule, description: string, fixGuidance: string): RuleInfo => ({
      id: `${this.ruleIdPrefix}:${id}`,
      category: this.ruleIdPrefix,
      description,
      fixGuidance,
    });
    return [
      rule("indirect-dependency",
        "Prohibited behaviour reached through an alias, barrel, namespace import, wrapper or "
        + "injected function port; or an entry point calling a service, repository or store",
        "Put the application operation in a controller and inject the narrow capability there. "
        + "An entry point parses its input and calls controller operations."),
      rule("public-service-helper",
        "An exported service function or callable, or a public service member outside its "
        + "implemented contract",
        "Expose one cohesive class capability through its interface; keep helpers private. A "
        + "test does not justify a public helper."),
      rule("service-interface",
        "A public service class without explicit interface contracts, including alias and "
        + "default exports",
        "Declare the capability callers need and `implements` it."),
      rule("concrete-dependency",
        "A concrete implementation used as a dependency type, including through aliases, "
        + "utility types and inferred factory results",
        "Depend on the declared contract. `Pick<ConcreteService, …>` is still the concrete class, "
        + "and a factory's public results need interface annotations; `satisfies` keeps the "
        + "inferred concrete type."),
      rule("controller-orchestration",
        "A controller invoking another controller, through an interface, alias, getter or callback",
        "Coordinate the underlying services in the owning controller. Shared data types belong "
        + "in models."),
      rule("controller-repository",
        "A controller calling a repository, directly or through an injected port typed as one",
        "Put a service between them. The service owns the reads and writes and the rules around "
        + "them."),
      rule("controller-collaborator",
        "A controller result exposing a service, transport, repository or writable store",
        "Return operation results or readonly state views, never the collaborators that produced "
        + "them."),
      rule("retained-service-state",
        "Mutable service fields, module state or captured state that survive an operation",
        "Keep values local to the operation. State that must outlive it is a database record on "
        + "the server and a store in the browser."),
      rule("store-workflow",
        "A store invoking a capability or network transport, directly or through a traced callback",
        "A store applies controlled updates. Let a controller do the work and write the result."),
      rule("factory-workflow",
        "A factory executing a capability, including inside a callback it returns",
        "Construct and connect dependencies only. Execution belongs to a controller, called by "
        + "an entry point."),
      rule("tool-operation",
        "An agent tool calling a service, repository or store instead of a controller operation",
        "Wrap the one public controller operation the tool stands for. When none exists, give "
        + "the controller an ordinary operation any entry point could call."),
      rule("unresolved-source",
        "Source or a local module the analyzer cannot inspect",
        "Repair the syntax or the module path. An incomplete scan is not a passing one."),
    ];
  }
}

/** What the layer of a path depends on beyond its location. */
export type SemanticLayerFacts = Pick<SemanticOptions, "mode" | "entryPoints" | "agentTools">;

/**
 * Chisel's layer model, in the analyzer's terms. Agent tools and configured
 * process entry points are entry points; so are server routes and the server
 * hooks. The composition root is a factory.
 */
export function semanticLayerOf(path: string, options: SemanticLayerFacts): SemanticLayer {
  const agentTools = options.agentTools;
  if (agentTools !== undefined && path.startsWith(agentTools)) return "tool-factory";
  if (options.entryPoints.includes(path)) return "entry";
  switch (classifyFile(path, options.mode).layer) {
    case Layer.SERVICES: return "services";
    case Layer.CONTROLLERS: return "controllers";
    case Layer.STORES: return "stores";
    case Layer.FACTORY: return "factories";
    case Layer.REPOSITORIES: return "repositories";
    case Layer.REMOTE: return "remote";
    case Layer.COMPONENTS: return "components";
    case Layer.MODELS: return "models";
    case Layer.ROUTES: return "entry";
    case Layer.HOOKS: return /^src\/hooks\.server\.(ts|js)$/.test(path) ? "entry" : "other";
    default: return "other";
  }
}
