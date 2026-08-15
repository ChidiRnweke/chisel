import { describe, test, expect } from "bun:test";
import { ApiEndpointsService } from "chisel/checker/services/svelte/api_endpoints";
import { Layer } from "chisel/checker/models/layer";
import { parsedProject } from "../../fakes/parsed_file";

/** Rule ids fired against a one-file project at the given path. */
function check(path: string, source: string, layer: Layer = Layer.ROUTES): string[] {
  const service = new ApiEndpointsService();
  return service.check(parsedProject({ path, source, layer })).map(v => v.ruleId);
}

/**
 * The only rule this service owns, and until now the only one with no unit test
 * — it was reachable solely through BFF mode, which no fixture exercised.
 *
 * It is a line scan rather than an AST match, which is worth knowing: the
 * boundaries below are the boundaries of a regex, not of the type system.
 */
describe("api-endpoints: RequestHandler outside the API tree", () => {
  test("a handler under src/routes/api/ is where handlers belong", () => {
    expect(check(
      "src/routes/api/todos/+server.ts",
      "import type { RequestHandler } from '@sveltejs/kit';\nexport const GET: RequestHandler = async () => new Response();\n",
    )).toEqual([]);
  });

  test("a handler outside the API tree is reported at its line", () => {
    const service = new ApiEndpointsService();
    const violations = service.check(parsedProject({
      path: "src/routes/todos/+server.ts",
      layer: Layer.ROUTES,
      source: "// a page-adjacent endpoint\nexport const GET = async () => new Response();\n",
    }));

    expect(violations.map(v => `${v.ruleId} @ ${v.file}:${v.line}`)).toEqual([
      "api:request-handler-outside-api @ src/routes/todos/+server.ts:2",
    ]);
  });

  test("every HTTP verb the rule names is caught, not just GET", () => {
    const verbs = ["GET", "POST", "PUT", "DELETE", "PATCH"];
    const caught = verbs.filter(verb =>
      check("src/routes/todos/+server.ts", `export const ${verb} = async () => new Response();`).length > 0);

    expect(caught).toEqual(verbs);
  });

  test("a type-only RequestHandler import is still an export declaration to the scan", () => {
    // Documents the regex's reach: `export .*RequestHandler` matches a re-export
    // of the type too. Narrowing it is a behaviour change, so it is pinned here
    // rather than left to be discovered.
    expect(check(
      "src/lib/server/handlers.ts",
      "export type { RequestHandler } from '@sveltejs/kit';\n",
      Layer.SERVICES,
    )).toEqual(["api:request-handler-outside-api"]);
  });

  test("test files are exempt, because a spec may name a handler it exercises", () => {
    expect(check(
      "tests/unit/routes.spec.ts",
      "export const GET = async () => new Response();",
      Layer.TESTS,
    )).toEqual([]);
  });

  test("a Svelte component is never scanned, whatever it contains", () => {
    expect(check(
      "src/lib/components/todos/todo-card.svelte",
      "<script lang='ts'>export const GET = 1;</script>",
      Layer.COMPONENTS,
    )).toEqual([]);
  });

  test("the id prefix and the emitted rule id deliberately differ", () => {
    // `ruleIdPrefix` is "api-endpoints" — which is the *category*, and what the
    // rules listing groups by — while the id a user sees is "api:...". They are
    // not the same string, and unifying them would rename a public rule id.
    const service = new ApiEndpointsService();

    expect({
      prefix: service.ruleIdPrefix,
      ids: service.describeRules().map(r => r.id),
      categories: service.describeRules().map(r => r.category),
    }).toEqual({
      prefix: "api-endpoints",
      ids: ["api:request-handler-outside-api"],
      categories: ["api-endpoints"],
    });
  });
});
