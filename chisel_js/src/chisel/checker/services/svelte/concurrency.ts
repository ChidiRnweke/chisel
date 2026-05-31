import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

export class ConcurrencyService {
  readonly ruleIdPrefix = "concurrency";

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!file.source) continue;
      const name = file.path;
      if (name.endsWith("+page.server.ts") || name.endsWith("+layout.server.ts")) {
        violations.push(...this._checkPromiseAll(file));
      }
    }
    return violations;
  }

  private _checkPromiseAll(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/Promise\.all\s*\(/.test(lines[i])) {
        violations.push(createViolation({
          file: file.path, line: i + 1, severity: Severity.WARNING,
          ruleId: "concurrency:promise-all-warning",
          message: "Promise.all across multiple services should only be used inside controllers, not directly in loaders.",
        }));
      }
    }
    return violations;
  }

  describeRules() {
    return [
      { id: "concurrency:promise-all-warning", category: "concurrency",
        description: "Promise.all used directly in a loader",
        fixGuidance: "Move Promise.all into a controller method. Single-service controllers are an anti-pattern — call service directly from loader via factory." },
    ];
  }
}
