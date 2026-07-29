import type { CheckResult } from "chisel/checker/models/result";
import type { CheckerConfig } from "chisel/checker/config";
import type { IImportGraph } from "chisel/checker/repositories/protocols";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { RuleInfo } from "chisel/checker/rule_metadata";
import type { SuppressionService } from "chisel/checker/services/shared/suppression";
import type { Violation } from "chisel/checker/models/violation";
import { ImportGraphError } from "chisel/checker/errors";
import { Severity } from "chisel/checker/models/severity";
import { createCheckResult } from "chisel/checker/models/result";
import { createFileInfo } from "chisel/checker/models/file_info";
import { createProjectInfo } from "chisel/checker/models/project_info";
import { createViolation } from "chisel/checker/models/violation";
import { defaultConfig } from "chisel/checker/config";
import { ExceptionRegistry } from "chisel/checker/repositories/exception_registry";
import { FileDiscovery } from "chisel/checker/repositories/file_discovery";
import { FileParser } from "chisel/checker/repositories/file_parser";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface CheckerService {
  readonly ruleIdPrefix: string;
  check(project: ProjectInfo): Violation[];
  describeRules(): RuleInfo[];
}

export interface CheckControllerDeps {
  readonly services: CheckerService[];
  readonly config?: CheckerConfig;
  readonly importGraph?: IImportGraph;
  readonly suppression?: SuppressionService;
  readonly discovery?: FileDiscovery;
  readonly exceptions?: ExceptionRegistry;
  readonly parser?: FileParser;
}

export class CheckController {
  readonly services: CheckerService[];
  private readonly config: CheckerConfig;
  private readonly importGraph?: IImportGraph;
  private readonly suppression?: SuppressionService;
  private readonly discovery: FileDiscovery;
  private readonly exceptions: ExceptionRegistry;
  private readonly parser: FileParser;

  /**
   * Collaborators are injected rather than constructed inline. The Python
   * sibling builds its `FileDiscovery`, `FileReader` and `ExceptionRegistry`
   * inside `check()`, which is precisely why its controller test cannot fake
   * them and covers almost nothing.
   */
  constructor(deps: CheckControllerDeps | CheckerService[]) {
    const resolved: CheckControllerDeps = Array.isArray(deps) ? { services: deps } : deps;
    this.services = resolved.services;
    this.config = resolved.config ?? defaultConfig();
    this.importGraph = resolved.importGraph;
    this.suppression = resolved.suppression;
    this.discovery = resolved.discovery ?? new FileDiscovery();
    this.exceptions = resolved.exceptions ?? new ExceptionRegistry();
    this.parser = resolved.parser ?? new FileParser();
  }

  /**
   * Every rule the configured checker can emit.
   *
   * Includes the suppression service's own rule, which is not in `services`.
   * The Python sibling iterates only its service list, so
   * `suppression:missing-reason` never appears in `chisel rules` or `explain` —
   * a rule users can trip over but cannot look up.
   */
  describeAllRules(): RuleInfo[] {
    const rules = this.services.flatMap(service => service.describeRules());
    if (this.suppression !== undefined) rules.push(...this.suppression.describeRules());
    return rules;
  }

  async check(projectPath: string): Promise<CheckResult> {
    const discovered = await this.discovery.discover(projectPath, {
      mode: this.config.mode,
      ignore: this.config.ignore,
    });

    // Read and parse each file exactly once, then hand the parsed tree to every
    // rule — the shape `chisel_py`'s controller uses to populate
    // `FileInfo.ast_tree`. Rules that match nodes need no parse of their own.
    const files = discovered.files.map(file => {
      let withSource = file;
      try {
        withSource = createFileInfo({
          ...file,
          source: readFileSync(join(projectPath, file.path), "utf-8"),
        });
      } catch {
        return file;
      }
      return createFileInfo({ ...withSource, ast: this.parser.parse(withSource) });
    });
    const project = createProjectInfo({ ...discovered, files });

    const violations: Violation[] = [...this._buildGraph(project)];
    for (const service of this.services) {
      violations.push(...service.check(project));
    }

    // Exceptions first, then suppressions — an exempted violation should not
    // also produce a missing-reason diagnostic for a comment on its line.
    const kept = this._applyExceptions(projectPath, violations);
    const surviving = this._applySuppressions(kept, project);

    return createCheckResult(surviving, files.length);
  }

  private _buildGraph(project: ProjectInfo): Violation[] {
    if (this.importGraph === undefined) return [];
    try {
      this.importGraph.build(project);
    } catch (exc) {
      const message = exc instanceof ImportGraphError ? exc.message : String(exc);
      return [createViolation({
        file: "<import-graph>",
        line: 0,
        severity: Severity.WARNING,
        ruleId: "import-graph:build-failed",
        message: `${message} Layer boundary rules were skipped.`,
      })];
    }

    return this.importGraph.warnings.map(warning => createViolation({
      file: "<import-graph>",
      line: 0,
      severity: Severity.WARNING,
      ruleId: "import-graph:degraded",
      message: warning,
    }));
  }

  private _applyExceptions(projectPath: string, violations: Violation[]): Violation[] {
    this.exceptions.load(projectPath);
    return this.exceptions.filter(violations);
  }

  private _applySuppressions(violations: Violation[], project: ProjectInfo): Violation[] {
    if (this.suppression === undefined) return violations;
    const sources = new Map(project.files.map(file => [file.path, file.source]));
    return this.suppression.check(violations, sources);
  }
}
