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
  });

  test("reports colour rule for arbitrary values", () => {
    const v = checkSvc(ColourEnforcementService, '<div class="bg-[#123]">x</div>', "src/Page.svelte", "svelte");
    expect(v[0].ruleId).toContain("colour:");
  });

  test("detects dynamic class construction", () => {
    const v = checkSvc(ColourEnforcementService, '<div class={`bg-${colour}`}>x</div>', "src/Page.svelte", "svelte");
    expect(v.some(x => x.ruleId === "colour:dynamic-class-banned")).toBe(true);
  });

  test("classifies text-[10px] as typography, never as colour", () => {
    const v = checkSvc(ColourEnforcementService, '<div class="text-[10px]">x</div>', "src/Page.svelte", "svelte");
    expect({
      typography: v.some(x => x.ruleId === "typography:arbitrary-value-banned"),
      colour: v.some(x => x.ruleId === "colour:arbitrary-value-banned"),
    }).toEqual({ typography: true, colour: false });
  });

  test("classifies w-[400px] as spacing, never as colour", () => {
    const v = checkSvc(ColourEnforcementService, '<div class="w-[400px]">x</div>', "src/Page.svelte", "svelte");
    expect({
      spacing: v.some(x => x.ruleId === "spacing:arbitrary-value-banned"),
      colour: v.some(x => x.ruleId === "colour:arbitrary-value-banned"),
    }).toEqual({ spacing: true, colour: false });
  });

  test("classifies min-h-[80vh] as spacing", () => {
    const v = checkSvc(ColourEnforcementService, '<div class="min-h-[80vh]">x</div>', "src/Page.svelte", "svelte");
    expect(v.some(x => x.ruleId === "spacing:arbitrary-value-banned")).toBe(true);
  });

  test("classifies text-[#fff] as colour", () => {
    const v = checkSvc(ColourEnforcementService, '<div class="text-[#fff]">x</div>', "src/Page.svelte", "svelte");
    expect(v.some(x => x.ruleId === "colour:arbitrary-value-banned")).toBe(true);
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
  });

  test("reports promise-all-warning for Promise.all", () => {
    const v = checkSvc(ConcurrencyService, "export const load = async () => { await Promise.all([a(), b()]) }", "src/routes/+page.server.ts");
    expect(v[0].ruleId).toBe("concurrency:promise-all-warning");
  });
});

describe("ErrorFlowService", () => {
  test("detects raw HTTP status in non-error file", () => {
    const v = checkSvc(ErrorFlowService, "const err = { status: 404 }");
    expect(v.length).toBe(1);
  });

  test("reports raw-http-status for status codes in non-error file", () => {
    const v = checkSvc(ErrorFlowService, "const err = { status: 404 }");
    expect(v[0].ruleId).toBe("error-flow:raw-http-status");
  });

  test("allows json(payload, { status }) in API routes under src/routes/api/", () => {
    const v = checkSvc(
      ErrorFlowService,
      "export const POST = ({ request }) => json({ ok: true }, { status: 200 });",
      "src/routes/api/chat/+server.ts",
    );
    expect(v.length).toBe(0);
  });

  test("still flags bare status in API routes when not via json()", () => {
    const v = checkSvc(
      ErrorFlowService,
      "const send = () => { throw { status: 500 }; }",
      "src/routes/api/chat/+server.ts",
    );
    expect({ count: v.length, ruleId: v[0]?.ruleId }).toEqual({ count: 1, ruleId: "error-flow:raw-http-status" });
  });

  test("flags raw HTTP status in +page.server.ts", () => {
    const bare = checkSvc(
      ErrorFlowService,
      "const err = { statusCode: 401 };",
      "src/routes/+page.server.ts",
    );
    expect({ count: bare.length, ruleId: bare[0]?.ruleId }).toEqual({ count: 1, ruleId: "error-flow:raw-http-status" });
  });
});
