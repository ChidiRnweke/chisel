import type { FileInfo } from "chisel/checker/models/file_info";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { RuleInfo } from "chisel/checker/rule_metadata";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

/**
 * Route paths that are genuinely HTTP surfaces: something outside the app —
 * an identity provider, a webhook sender, a protocol client — chose the URL,
 * so there is no remote function to replace it with.
 */
const HTTP_SURFACE_PATH_RE = [
  /\/auth\//,
  /\/callback\//,
  /\/oauth\//,
  /\/webhooks?\//,
  /\/mcp\//,
  /\/\.well-known\//,
  /\/sitemap/,
  /\/robots/,
  /\/rss/,
  /\/feed/,
  /\/health(z|check)?\//,
];

/**
 * Bodies that need real HTTP semantics. A remote function returns a serialised
 * value; it cannot stream, redirect, or hand back a file.
 */
const HTTP_BODY_RE = [
  /ReadableStream/,
  /text\/event-stream/,
  /\bredirect\s*\(/,
  /new\s+Response\s*\(/,
  /Content-Disposition/,
  /content-type["'\s:]+(?!application\/json)/i,
];

/**
 * Prefers remote functions, loaders and form actions over hand-rolled API
 * routes.
 *
 * A `+server.ts` that returns JSON to your own UI is an HTTP endpoint you now
 * own: its own URL, its own serialisation, its own error contract, and no
 * type safety across the wire. A remote function gives the same capability with
 * the types preserved end to end.
 *
 * This is a warning, not an error. The heuristics below are good but not
 * conclusive, and a rule that blocks a build on a guess is worse than one that
 * asks a question.
 */
export class RouteStyleService {
  readonly ruleIdPrefix = "route-style";

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];

    for (const file of project.files) {
      if (!/^src\/routes\/.*\+server\.(ts|js)$/.test(file.path)) continue;
      if (this._isHttpSurface(file)) continue;

      violations.push(createViolation({
        file: file.path,
        line: 1,
        severity: Severity.WARNING,
        ruleId: `${this.ruleIdPrefix}:prefer-remote-function`,
        message:
          `${file.path} is an API route serving your own UI. A remote function in `
          + `$lib/remote/*.remote.ts does the same job with types preserved across the `
          + `wire, and no URL to keep in sync. Use a loader or form action if the data `
          + `belongs to a page. If this endpoint genuinely needs to be HTTP, say why `
          + `with \`chisel-ignore route-style:prefer-remote-function -- <reason>\`.`,
      }));
    }

    return violations;
  }

  private _isHttpSurface(file: FileInfo): boolean {
    if (HTTP_SURFACE_PATH_RE.some(re => re.test(file.path))) return true;
    return HTTP_BODY_RE.some(re => re.test(file.source));
  }

  describeRules(): RuleInfo[] {
    return [{
      id: "route-style:prefer-remote-function",
      category: this.ruleIdPrefix,
      description: "An API route serves the app's own UI instead of a remote function.",
      fixGuidance:
        "Move it to a remote function in $lib/remote/*.remote.ts, or to a loader / form "
        + "action if the data belongs to a page. Routes that are genuinely HTTP — OAuth "
        + "callbacks, webhooks, SSE streams, file downloads, protocol endpoints — are "
        + "detected and exempt.",
    }];
  }
}
