import { describe, test, expect } from "bun:test";
import { ColourEnforcementService } from "chisel/checker/services/svelte/colour_enforcement";
import { ComplexityService } from "chisel/checker/services/svelte/complexity";
import { ConcurrencyService } from "chisel/checker/services/svelte/concurrency";
import { ErrorFlowService } from "chisel/checker/services/svelte/error_flow";
import { ApiEndpointsService } from "chisel/checker/services/svelte/api_endpoints";
import { createFileInfo } from "chisel/checker/models/file_info";
import { Layer } from "chisel/checker/models/layer";
import { createProjectInfo } from "chisel/checker/models/project_info";

function checkSvc(Svc: any, source: string, path = "src/test.ts", lang: "ts" | "svelte" = "ts") {
  const svc = new Svc();
  const file = createFileInfo({ path, layer: Layer.UNKNOWN, language: lang, source });
  const project = createProjectInfo({ rootPath: "/test", files: [file] });
  return svc.check(project);
}

describe("ColourEnforcementService", () => {
  test("detects arbitrary Tailwind values", () => {
    const v = checkSvc(ColourEnforcementService, '<div class="bg-[#123]">x</div>', "src/Page.svelte", "svelte");
    expect(v.length).toBeGreaterThanOrEqual(1);
    expect(v[0].ruleId).toContain("colour:");
  });

  test("detects dynamic class construction", () => {
    const v = checkSvc(ColourEnforcementService, '<div class={`bg-${colour}`}>x</div>', "src/Page.svelte", "svelte");
    expect(v.some(x => x.ruleId === "colour:dynamic-class-banned")).toBe(true);
  });
});

describe("ComplexityService", () => {
  test("warns on +page.svelte over 80 lines", () => {
    const manyLines = Array(90).fill("<div>x</div>").join("\n");
    const v = checkSvc(ComplexityService, manyLines, "src/routes/+page.svelte", "svelte");
    expect(v.filter(x => x.ruleId === "complexity:page-loc-warning").length).toBe(1);
  });
});

describe("ConcurrencyService", () => {
  test("detects Promise.all in loader", () => {
    const v = checkSvc(ConcurrencyService, "export const load = async () => { await Promise.all([a(), b()]) }", "src/routes/+page.server.ts");
    expect(v.length).toBe(1);
    expect(v[0].ruleId).toBe("concurrency:promise-all-warning");
  });
});

describe("ErrorFlowService", () => {
  test("detects raw HTTP status in non-error file", () => {
    const v = checkSvc(ErrorFlowService, "const err = { status: 404 }");
    expect(v.length).toBe(1);
    expect(v[0].ruleId).toBe("error-flow:raw-http-status");
  });
});

describe("ApiEndpointsService", () => {
  test("detects RequestHandler export outside api/", () => {
    const v = checkSvc(ApiEndpointsService, "export const GET = () => new Response('ok')", "src/routes/endpoint.ts");
    expect(v.length).toBe(1);
    expect(v[0].ruleId).toBe("api:request-handler-outside-api");
  });
});
