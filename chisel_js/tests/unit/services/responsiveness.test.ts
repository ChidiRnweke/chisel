import { describe, test, expect } from "bun:test";
import { ResponsivenessService } from "chisel/checker/services/svelte/responsiveness";
import { createFileInfo } from "chisel/checker/models/file_info";
import { Layer } from "chisel/checker/models/layer";
import { createProjectInfo } from "chisel/checker/models/project_info";

function check(source: string, path: string) {
  const svc = new ResponsivenessService();
  const file = createFileInfo({ path, layer: Layer.UNKNOWN, language: "svelte", source });
  const project = createProjectInfo({ rootPath: "/test", files: [file] });
  return svc.check(project);
}

describe("ResponsivenessService", () => {
  test("no-breakpoint-classes flags layout/page but not leaf icon components", () => {
    const layout = check('<div class="grid"><div>x</div></div>', "src/components/layout/Header.svelte");
    const page = check('<div class="grid"><div>x</div></div>', "src/routes/+page.svelte");
    const leaf = check('<span class="text-sm">?</span>', "src/components/domain/StatusIcon.svelte");

    expect({
      layout: layout.some(v => v.ruleId === "responsiveness:no-breakpoint-classes"),
      page: page.some(v => v.ruleId === "responsiveness:no-breakpoint-classes"),
      leaf: leaf.some(v => v.ruleId === "responsiveness:no-breakpoint-classes"),
    }).toEqual({ layout: true, page: true, leaf: false });
  });

  test("absolute-no-breakpoint only on layout-level components", () => {
    const layout = check('<div class="absolute top-0">x</div>', "src/components/layout/Header.svelte");
    const domain = check('<div class="absolute top-0">x</div>', "src/components/domain/Panel.svelte");

    expect({
      layout: layout.some(v => v.ruleId === "responsiveness:absolute-no-breakpoint"),
      domain: domain.some(v => v.ruleId === "responsiveness:absolute-no-breakpoint"),
    }).toEqual({ layout: true, domain: false });
  });

  test("fixed-width-banned still triggers on +page.svelte root", () => {
    const page = check('<div class="w-[400px]"><main></main></div>', "src/routes/+page.svelte");
    expect(page.some(v => v.ruleId === "responsiveness:fixed-width-banned")).toBe(true);
  });
});