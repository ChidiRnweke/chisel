import { describe, test, expect } from "bun:test";
import { parsedProject } from "../../fakes/parsed_file";
import { StructuralSvelteService } from "chisel/checker/services/svelte/structural";
import { createFileInfo } from "chisel/checker/models/file_info";
import { Layer } from "chisel/checker/models/layer";
import { createProjectInfo } from "chisel/checker/models/project_info";

function check(source: string, path = "src/lib/test.ts", layer: Layer = Layer.UNKNOWN, lang: "ts" | "svelte" = "ts") {
  const svc = new StructuralSvelteService();
  const project = parsedProject({ path, source, layer, language: lang });
  return svc.check(project);
}

function hasRule(violations: any[], ruleId: string) {
  return violations.some((v: any) => v.ruleId === ruleId);
}

describe("StructuralSvelteService - General Bans", () => {

  test("detects inline style in svelte file", () => {
    const v = check('<div style="color:red">hi</div>', "src/routes/+page.svelte", Layer.ROUTES, "svelte");
    expect(hasRule(v, "structural:inline-style-banned")).toBe(true);
  });

  test("detects style block in svelte file", () => {
    const v = check("<style>h1{color:red}</style>", "src/routes/+page.svelte", Layer.ROUTES, "svelte");
    expect(hasRule(v, "structural:style-block-banned")).toBe(true);
  });




});
