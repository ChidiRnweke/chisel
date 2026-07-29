import type { FileInfo } from "chisel/checker/models/file_info";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";
import { Layer, isRouteWithStatus } from "chisel/checker/models/layer";
import { scriptsOf } from "chisel/checker/repositories/file_parser";
import ts from "typescript";

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

interface StatusProperty {
  readonly statusNumber: number;
  readonly line: number;
  readonly text: string;
  /** True when the enclosing object literal is an argument to `json(...)`. */
  readonly insideJsonCall: boolean;
}

/**
 * Every `status: <number>` / `statusCode: <number>` property in the file, with
 * whether it sits inside a `json(...)` call — which is the shape SvelteKit API
 * routes are supposed to use, and which the rule must not report.
 */
function statusProperties(file: FileInfo): StatusProperty[] {
  const found: StatusProperty[] = [];

  for (const { sf, offset } of scriptsOf(file.ast)) {
    const visit = (node: ts.Node, insideJson: boolean): void => {
      const nowInsideJson = insideJson
        || (ts.isCallExpression(node)
          && ts.isIdentifier(node.expression)
          && node.expression.text === "json");

      if (ts.isPropertyAssignment(node)) {
        const name = ts.isIdentifier(node.name) ? node.name.text : undefined;
        if (name === "status" || name === "statusCode") {
          const value = node.initializer;
          if (ts.isNumericLiteral(value)) {
            found.push({
              statusNumber: Number(value.text),
              line: lineOf(file.source, offset + node.getStart(sf)),
              text: `${name}: ${value.text}`,
              insideJsonCall: nowInsideJson,
            });
          }
        }
      }

      ts.forEachChild(node, child => visit(child, nowInsideJson));
    };

    ts.forEachChild(sf, node => visit(node, false));
  }

  return found;
}

function lineOf(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

export class ErrorFlowService {
  readonly ruleIdPrefix = "error-flow";

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!file.source) continue;
      // Tests are exempt: a mock response, a fixture with a hardcoded status,
      // or a long arrange block is not an architectural problem. Tests keep
      // their own test-structure rules. Note this is narrower than
      // UNRESTRICTED_LAYERS, which the import rules use — an *unclassified*
      // component still gets the hygiene and design-system rules.
      if (file.layer === Layer.TESTS) continue;
      violations.push(...this._checkRawHttpStatus(file));
    }
    return violations;
  }

  private _checkRawHttpStatus(file: FileInfo) {
    const violations: Violation[] = [];
    const normalised = file.path.replace(/\\/g, "/");
    if (normalised.startsWith("tests/")) return violations;
    if (isErrorHandlerContextual(normalised)) return violations;

    const isApiServer = isApiRouteHandlerPath(normalised);
    const isClassicRouteHandler = isRouteWithStatus(normalised) && !isApiServer;
    const isPageOrAction = normalised.endsWith("+page.server.ts")
      || normalised.endsWith("+page.server.js")
      || normalised.endsWith("+page.svelte");

    // Match the `status` property on its node rather than its line. The
    // previous version evaluated the `json(payload, { status })` exemption
    // line-locally, so a perfectly correct multi-line
    // `return json(x, {\n  status: 404\n})` was reported.
    for (const found of statusProperties(file)) {
      const { statusNumber, line, text } = found;
      if (statusNumber < 100 || statusNumber > 599) continue;
      if (isApiServer && found.insideJsonCall) continue;

      const message = (!isClassicRouteHandler && !isPageOrAction && !isApiServer)
        ? `Raw HTTP status code ${text} leaked past the service layer. Services must throw typed domain errors; HTTP status is decided only in error handlers${isApiServer ? " or returned via json(..., { status }) for API routes" : ""}.`
        : isApiServer
          ? `API route returned raw HTTP status code ${text}. Prefer json(payload, { status: ${statusNumber} }) so the status is bound to the response, not leaked as a bare value.`
          : isPageOrAction
            ? `Raw HTTP status code ${text} in ${normalised.split("/").pop()} — use throw error(${statusNumber}, ...) for unrecoverable errors or return fail(${statusNumber}, ...) for form errors.`
            : `Raw HTTP status code ${text} must not leak past the service layer. Use throw error(...) for unrecoverable errors or return fail(...) for form errors.`;

      violations.push(createViolation({
        file: file.path, line, severity: Severity.ERROR,
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