import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

export class ApiEndpointsService {
  readonly ruleIdPrefix = "api-endpoints";

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!file.source) continue;
      violations.push(...this._checkRequestHandler(file));
    }
    return violations;
  }

  private _checkRequestHandler(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (file.path.includes("routes/api/") || file.path.includes("tests/")) return violations;
    if (!file.path.endsWith(".ts") && !file.path.endsWith(".js")) return violations;
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/export\s+(?:const|function|async function)\s+(GET|POST|PUT|DELETE|PATCH)\b/.test(lines[i])
          || /export\s+.*RequestHandler/.test(lines[i])
          || /export const (GET|POST|PUT|DELETE|PATCH).*=/.test(lines[i])) {
        violations.push(createViolation({
          file: file.path, line: i + 1, severity: Severity.ERROR,
          ruleId: "api:request-handler-outside-api",
          message: "Raw API endpoint handlers (RequestHandler export) banned outside src/routes/api/. Use loaders and form actions instead.",
        }));
      }
    }
    return violations;
  }


  describeRules() {
    return [
      { id: "api:request-handler-outside-api", category: "api-endpoints",
        description: "RequestHandler export outside src/routes/api/", fixGuidance: "Use loaders and form actions instead of raw API endpoints." },
    ];
  }
}
