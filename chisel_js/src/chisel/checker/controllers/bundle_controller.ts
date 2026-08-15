import type { CheckResult } from "chisel/checker/models/result";
import type { RuleInfo } from "chisel/checker/rule_metadata";
import { BundleBudgetService } from "chisel/checker/services/build/bundle_budget";
import { ExceptionRegistry } from "chisel/checker/repositories/exception_registry";
import { createCheckResult } from "chisel/checker/models/result";

export interface BundleCheckResult {
  readonly result: CheckResult;
  readonly vendorChunksTolerated: number;
}

/**
 * The bundle budget, kept out of `check`.
 *
 * `check` reads source and runs on a clean checkout; this reads what the
 * bundler emitted, which exists only after a production build. Folding it into
 * `check` would mean a rule that silently does nothing almost every time it
 * runs — the worst kind, because its silence looks like a pass.
 */
export class BundleController {
  constructor(
    private readonly service: BundleBudgetService = new BundleBudgetService(),
    private readonly exceptions: ExceptionRegistry = new ExceptionRegistry(),
  ) {}

  /** @throws BuildOutputMissingError when the project has not been built. */
  analyse(projectPath: string): BundleCheckResult {
    const report = this.service.analyse(projectPath);
    this.exceptions.load(projectPath);
    const surviving = this.exceptions.filter([...report.violations]);

    return {
      result: createCheckResult(surviving, report.chunksInspected),
      vendorChunksTolerated: report.vendorChunksTolerated,
    };
  }

  describeAllRules(): RuleInfo[] {
    return this.service.describeRules();
  }
}
