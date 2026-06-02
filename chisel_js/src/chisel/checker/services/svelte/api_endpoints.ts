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
    violations.push(...this._checkApiRouteRatio(project));
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

  private _checkApiRouteRatio(project: ProjectInfo) {
    const violations: Violation[] = [];
    const apiRoutes = project.files.filter(f => f.path.includes("routes/api/")).length;
    const pageRoutes = project.files.filter(f => f.path.endsWith("+page.svelte")).length;
    if (pageRoutes > 0 && apiRoutes / pageRoutes > 0.2) {
      violations.push(createViolation({
        file: "project", line: 1, severity: Severity.WARNING,
        ruleId: "api:route-count-ratio",
        message: `API route count (${apiRoutes}) exceeds 20% of total page route count (${pageRoutes}). Prefer loaders and form actions over API routes.`,
      }));
    }
    return violations;
  }

  describeRules() {
    return [
      { id: "api:request-handler-outside-api", category: "api-endpoints",
        description: "RequestHandler export outside src/routes/api/", fixGuidance: "Use loaders and form actions instead of raw API endpoints." },
      { id: "api:route-count-ratio", category: "api-endpoints",
        description: "API route count exceeds 20% of page routes", fixGuidance: "Prefer loaders and form actions over API routes." },
    ];
  }
}
