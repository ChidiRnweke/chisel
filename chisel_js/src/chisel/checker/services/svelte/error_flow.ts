import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";
import { isRouteWithStatus } from "chisel/checker/models/layer";

function isApiRouteHandlerPath(path: string): boolean {
  const normalised = path.replace(/\\/g, "/");
  if (!normalised.includes("/routes/")) return false;
  if (!normalised.endsWith("/+server.ts") && !normalised.endsWith("/+server.js")) return false;
  return normalised.includes("/routes/api/");
}

function isErrorHandlerContextual(path: string): boolean {
  const normalised = path.replace(/\\/g, "/");
  if (normalised.includes("error_handlers")) return true;
  if (normalised.endsWith("+error.svelte")) return true;
  if (normalised.endsWith("/error-handler.ts") || normalised.endsWith("/error-handler.js")) return true;
  return false;
}

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
    const normalised = file.path.replace(/\\/g, "/");
    if (normalised.startsWith("tests/")) return violations;
    if (isErrorHandlerContextual(normalised)) return violations;

    const isApiServer = isApiRouteHandlerPath(normalised);
    const isClassicRouteHandler = isRouteWithStatus(normalised) && !isApiServer;
    const isPageOrAction = normalised.endsWith("+page.server.ts")
      || normalised.endsWith("+page.server.js")
      || normalised.endsWith("+page.svelte");

    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const httpStatusRe = /\b(?:status|statusCode)\s*:\s*(\d{3})\b/;
      const match = httpStatusRe.exec(line);
      if (!match) continue;

      const statusNumber = parseInt(match[1], 10);
      if (statusNumber < 100 || statusNumber > 599) continue;

      if (isApiServer) {
        const isJsonStatus = /\bjson\s*\([^)]*,\s*\{[^}]*status\s*:/.test(line)
          || /\bjson\s*\(\s*[^,)]+\s*,\s*\{[^}]*\}\s*\)/.test(line) && /status\s*:/.test(line);
        if (isJsonStatus) continue;
        if (/return\s+json\s*\(/.test(line) && /status\s*:/.test(line)) continue;
      }

      const message = (!isClassicRouteHandler && !isPageOrAction && !isApiServer)
        ? `Raw HTTP status code ${match[0]} leaked past the service layer. Services must throw typed domain errors; HTTP status is decided only in error handlers${isApiServer ? " or returned via json(..., { status }) for API routes" : ""}.`
        : isApiServer
          ? `API route returned raw HTTP status code ${match[0]}. Prefer json(payload, { status: ${statusNumber} }) so the status is bound to the response, not leaked as a bare value.`
          : isPageOrAction
            ? `Raw HTTP status code ${match[0]} in ${normalised.split("/").pop()} — use throw error(${statusNumber}, ...) for unrecoverable errors or return fail(${statusNumber}, ...) for form errors.`
            : `Raw HTTP status code ${match[0]} must not leak past the service layer. Use throw error(...) for unrecoverable errors or return fail(...) for form errors.`;

      violations.push(createViolation({
        file: file.path, line: i + 1, severity: Severity.ERROR,
        ruleId: "error-flow:raw-http-status",
        message,
      }));
    }
    return violations;
  }

  describeRules() {
    return [
      { id: "error-flow:raw-http-status", category: "error-flow",
        description: "Raw HTTP status code outside error handler / api route",
        fixGuidance: "Pages/actions: throw error(status, ...) or return fail(status, ...). API routes under src/routes/api/**/+server.ts: return json(payload, { status }). Services: throw a typed domain error; HTTP status is decided only in error_handlers." },
    ];
  }
}