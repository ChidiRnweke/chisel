import type { CheckResult } from "chisel/checker/models/result";
import type { FileInfo } from "chisel/checker/models/file_info";
import type { Violation } from "chisel/checker/models/violation";
import type { RuleInfo } from "chisel/checker/rule_metadata";
import { createCheckResult } from "chisel/checker/models/result";
import { createFileInfo } from "chisel/checker/models/file_info";
import { ExceptionRegistry } from "chisel/checker/repositories/exception_registry";
import { FileDiscovery } from "chisel/checker/repositories/file_discovery";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface CheckerService {
  readonly ruleIdPrefix: string;
  check(project: { rootPath: string; files: { path: string; source: string; layer: string; language: string }[] }): Violation[];
  describeRules(): RuleInfo[];
}

export class CheckController {
  constructor(readonly services: CheckerService[]) {}

  async check(projectPath: string): Promise<CheckResult> {
    const discovery = new FileDiscovery();
    const project = await discovery.discover(projectPath);
    
    const filesWithSource = project.files.map(f => {
      try {
        const source = readFileSync(join(projectPath, f.path), "utf-8");
        return createFileInfo({ ...f, source });
      } catch {
        return f;
      }
    });
    
    const violations: Violation[] = [];
    for (const service of this.services) {
      violations.push(...service.check({ ...project, files: filesWithSource }));
    }

    return createCheckResult(this.applyExceptions(projectPath, violations), filesWithSource.length);
  }

  private applyExceptions(projectPath: string, violations: Violation[]): Violation[] {
    const registry = new ExceptionRegistry();
    registry.load(projectPath);
    return registry.filter(violations);
  }
}
