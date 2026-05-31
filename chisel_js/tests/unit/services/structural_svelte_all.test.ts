import { describe, test, expect } from "bun:test";
import { StructuralSvelteService } from "chisel/checker/services/svelte/structural";
import { createFileInfo } from "chisel/checker/models/file_info";
import { Layer } from "chisel/checker/models/layer";
import { createProjectInfo } from "chisel/checker/models/project_info";

function check(source: string, path = "src/lib/test.ts", layer = Layer.UNKNOWN, lang: "ts" | "svelte" = "ts") {
  const svc = new StructuralSvelteService();
  const file = createFileInfo({ path, layer, language: lang, source });
  const project = createProjectInfo({ rootPath: "/test", files: [file] });
  return svc.check(project);
}

function hasRule(violations: any[], ruleId: string) {
  return violations.some((v: any) => v.ruleId === ruleId);
}

describe("StructuralSvelteService - General Bans", () => {
  test("detects setTimeout in $lib file", () => {
    const v = check("setTimeout(() => {}, 1000)", "src/lib/foo.ts");
    expect(hasRule(v, "structural:timers-banned")).toBe(true);
  });

  test("detects inline style in svelte file", () => {
    const v = check('<div style="color:red">hi</div>', "src/routes/+page.svelte", Layer.ROUTES, "svelte");
    expect(hasRule(v, "structural:inline-style-banned")).toBe(true);
  });

  test("detects style block in svelte file", () => {
    const v = check("<style>h1{color:red}</style>", "src/routes/+page.svelte", Layer.ROUTES, "svelte");
    expect(hasRule(v, "structural:style-block-banned")).toBe(true);
  });

  test("detects $app/stores import", () => {
    const v = check("import { page } from '$app/stores'");
    expect(hasRule(v, "structural:app-stores-banned")).toBe(true);
  });

  test("detects writable() Svelte 4 store", () => {
    const v = check("import { writable } from 'svelte/store'; const x = writable(0)");
    expect(hasRule(v, "structural:writable-banned")).toBe(true);
  });

  test("detects $effect without return", () => {
    const v = check("<script>$effect(() => { console.log('hi') })</script>", "src/routes/+page.svelte", Layer.ROUTES, "svelte");
    expect(hasRule(v, "structural:effect-no-cleanup")).toBe(true);
  });

  test("detects onMount without browser API", () => {
    const v = check("<script>onMount(() => { fetch('/data') })</script>", "src/routes/+page.svelte", Layer.ROUTES, "svelte");
    expect(hasRule(v, "structural:onmount-no-browser-api")).toBe(true);
  });
});
