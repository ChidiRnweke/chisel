import { describe, test, expect, beforeAll } from "bun:test";
import type { CheckResult } from "chisel/checker/models/result";
import { CheckerFactory } from "chisel/checker/factory";
import { defaultConfig } from "chisel/checker/config";
import { CheckerMode } from "chisel/checker/models/mode";
import { join } from "node:path";

const FIXTURE = join(import.meta.dir, "../../fixtures/bff-app");

let result: CheckResult;

/** Every violation as "rule @ file:line", which is what a user actually reads. */
function findings(): string[] {
  return result.violations
    .map(v => `${v.ruleId} @ ${v.file}:${v.line}`)
    .sort();
}

beforeAll(async () => {
  const controller = CheckerFactory.createController({
    config: defaultConfig(CheckerMode.BFF),
  });
  result = await controller.check(FIXTURE);
});

/**
 * The BFF topology, end to end.
 *
 * Its two mode-specific behaviours had only ever been exercised through
 * hand-fed edges: `ApiEndpointsService` is registered only under BFF, and
 * `import-boundary:api-client-location` fires only under BFF. Unit tests pin
 * what each does; this pins that the factory actually composes them when the
 * mode says so — and that the standalone-only rule stays out.
 */
describe("acceptance: BFF specimen", () => {
  test("exactly the planted violations, at the lines they sit on", () => {
    expect(findings()).toEqual([
      // A handler beside a page rather than under src/routes/api/.
      "api:request-handler-outside-api @ src/routes/todos/+server.ts:3",
      // A store constructing its own client: only config and the factory may.
      "import-boundary:api-client-location @ src/lib/stores/todos.svelte.ts:4",
    ]);
  });

  test("the handler under src/routes/api/ is left alone", () => {
    const inApiTree = result.violations.filter(v => v.file.startsWith("src/routes/api/"));
    expect(inApiTree).toEqual([]);
  });

  test("the API client built in the config layer is the sanctioned one", () => {
    // src/lib/api/** classifies as config under BFF, which is both what makes
    // this construction legal and what keeps it out of unclassified-module.
    const clientFile = result.violations.filter(v => v.file === "src/lib/api/client.ts");
    expect(clientFile).toEqual([]);
  });

  test("no rule prefers a remote function, because a BFF has none", () => {
    // RouteStyleService is not registered in BFF mode. A BFF's API routes are
    // the point of the topology, not a smell to warn about.
    const routeStyle = result.violations.filter(v => v.ruleId.startsWith("route-style:"));
    expect(routeStyle).toEqual([]);
  });
});
