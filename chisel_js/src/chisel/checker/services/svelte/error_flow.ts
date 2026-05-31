import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

export class ErrorFlowService {
  readonly ruleIdPrefix = "error-flow";

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!file.source) continue;
      violations.push(...this._checkRawHttpStatus(file));
    }
    return violations;
  }

  private _checkRawHttpStatus(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (file.path.includes("error_handlers") || file.path.endsWith("+error.svelte")) continue;
      if (/status:\s*\d{3}/.test(lines[i]) || /statusCode:\s*\d{3}/.test(lines[i])) {
        violations.push(createViolation({
          file: file.path, line: i + 1, severity: Severity.ERROR,
          ruleId: "error-flow:raw-http-status",
          message: "Raw HTTP status codes must not leak past the service layer. Use throw error(...) for unrecoverable or return fail(...) for form errors.",
        }));
      }
    }
    return violations;
  }

  describeRules() {
    return [
      { id: "error-flow:raw-http-status", category: "error-flow",
        description: "Raw HTTP status code outside error handler",
        fixGuidance: "Use throw error(status, ...) for unrecoverable errors (renders +error.svelte) or return fail(status, ...) for recoverable form errors." },
    ];
  }
}
