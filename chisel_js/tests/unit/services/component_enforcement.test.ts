import { describe, test, expect } from "bun:test";
import { ComponentEnforcementService } from "chisel/checker/services/svelte/component_enforcement";
import { createFileInfo } from "chisel/checker/models/file_info";
import { Layer } from "chisel/checker/models/layer";
import { createProjectInfo } from "chisel/checker/models/project_info";

function checkSvelte(source: string, path = "src/routes/Page.svelte") {
  const svc = new ComponentEnforcementService();
  const file = createFileInfo({ path, layer: Layer.ROUTES, language: "svelte", source });
  const project = createProjectInfo({ rootPath: "/test", files: [file] });
  return svc.check(project);
}

describe("ComponentEnforcementService", () => {
  test("detects raw button in svelte file", () => {
    const v = checkSvelte("<button>Click</button>");
    expect(v.some(x => x.ruleId.includes("html-button"))).toBe(true);
  });

  test("detects raw textarea in svelte file", () => {
    const v = checkSvelte("<textarea></textarea>");
    expect(v.some(x => x.ruleId.includes("html-textarea"))).toBe(true);
  });

  test("detects raw select in svelte file", () => {
    const v = checkSvelte("<select><option>1</option></select>");
    expect(v.some(x => x.ruleId.includes("html-select"))).toBe(true);
  });

  test("detects raw dialog in svelte file", () => {
    const v = checkSvelte("<dialog>content</dialog>");
    expect(v.some(x => x.ruleId.includes("html-dialog"))).toBe(true);
  });

  test("detects raw form in svelte file", () => {
    const v = checkSvelte("<form><input /></form>");
    expect(v.some(x => x.ruleId.includes("html-form"))).toBe(true);
  });

  test("does not flag div, span, p elements", () => {
    const v = checkSvelte("<div><span>hello</span><p>world</p></div>");
    expect(v.length).toBe(0);
  });
});
