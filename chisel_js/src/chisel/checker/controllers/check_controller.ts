import type { CheckResult } from "chisel/checker/models/result";
import type { CheckerConfig } from "chisel/checker/config";
import type { IImportGraph } from "chisel/checker/repositories/protocols";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { RuleInfo } from "chisel/checker/rule_metadata";
import type { SuppressionService } from "chisel/checker/services/shared/suppression";
import type { Violation } from "chisel/checker/models/violation";
import { ImportGraphError } from "chisel/checker/errors";
import { Layer } from "chisel/checker/models/layer";
import { Severity } from "chisel/checker/models/severity";
import { createCheckResult } from "chisel/checker/models/result";
import { createFileInfo } from "chisel/checker/models/file_info";
import { createProjectInfo } from "chisel/checker/models/project_info";
import { createViolation } from "chisel/checker/models/violation";
import { defaultConfig } from "chisel/checker/config";
import { ExceptionRegistry } from "chisel/checker/repositories/exception_registry";
import { FileDiscovery } from "chisel/checker/repositories/file_discovery";
import { FileParser, astOf } from "chisel/checker/repositories/file_parser";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const UNPARSEABLE_RULE: RuleInfo = {
  id: "checker:unparseable-file",
  category: "checker",
  description: "A file that does not parse, so rules reading its syntax skipped it",
  fixGuidance: "Fix the syntax error the message names. Until then the file is checked by "
    + "import and path rules only, and a violation inside it cannot be reported.",
};

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
    const rules = [UNPARSEABLE_RULE, ...this.services.flatMap(service => service.describeRules())];
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
    const unparseable: Violation[] = [];
    const files = discovered.files.map(file => {
      const withSource = createFileInfo({
        ...file,
        source: readFileSync(join(projectPath, file.path), "utf-8"),
      });
      const outcome = this.parser.parse(withSource);
      if (outcome.kind !== "parsed") {
        unparseable.push(createViolation({
          file: file.path,
          line: 1,
          severity: Severity.WARNING,
          ruleId: "checker:unparseable-file",
          message: outcome.kind === "partial"
            ? `The markup does not compile, so rules that read markup skipped this file: ${outcome.reason}`
            : `The file does not parse, so every rule that reads its syntax skipped it: ${outcome.reason}`,
        }));
      }
      return createFileInfo({ ...withSource, ast: astOf(outcome) });
    });
    const stylesheets = discovered.stylesheets.map(sheet => ({
      path: sheet.path,
      source: readFileSync(join(projectPath, sheet.path), "utf-8"),
    }));
    const project = createProjectInfo({ ...discovered, files, stylesheets });

    const violations: Violation[] = [...unparseable, ...this._buildGraph(project)];
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
      // chisel-ignore fail-loudly:silent-catch -- The failure is returned as an import-graph:build-failed warning in the run's own output.
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
    const sources = new Map([
      ...project.files.map(file => [file.path, file.source] as const),
      ...project.stylesheets.map(sheet => [sheet.path, sheet.source] as const),
    ]);
    const known = this.describeAllRules().map(rule => rule.id);
    const tests = new Set(project.files.filter(file => file.layer === Layer.TESTS).map(file => file.path));
    return this.suppression.check(violations, sources, known, tests);
  }
}
