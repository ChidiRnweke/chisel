import { describe, test, expect } from "bun:test";
import { parsedProject } from "../../fakes/parsed_file";
import type { Violation } from "chisel/checker/models/violation";
import { ColourEnforcementService } from "chisel/checker/services/svelte/colour_enforcement";
import { createFileInfo } from "chisel/checker/models/file_info";
import { createProjectInfo } from "chisel/checker/models/project_info";
import { Layer } from "chisel/checker/models/layer";

function check(markup: string, path = "src/lib/components/app/card.svelte"): Violation[] {
  const project = parsedProject({ path, source: markup, layer: Layer.COMPONENTS, language: "svelte" });
  return new ColourEnforcementService().check(project);
}

function ruleIds(markup: string): string[] {
  return check(markup).map(v => v.ruleId);
}

describe("colour: hardcoded palette classes", () => {
  test("a palette colour class is banned", () => {
    expect(ruleIds('<div class="text-red-500">x</div>'))
      .toEqual(["colour:palette-class-banned"]);
  });

  test("gradient stops are colourable prefixes too", () => {
    expect(ruleIds('<div class="from-blue-500 via-purple-500 to-pink-500">x</div>'))
      .toEqual([
        "colour:palette-class-banned",
        "colour:palette-class-banned",
        "colour:palette-class-banned",
      ]);
  });

  test("the message names a semantic replacement", () => {
    expect(check('<div class="bg-slate-800">x</div>')[0]!.message)
      .toContain("bg-background");
  });

  test("semantic tokens are the point and stay silent", () => {
    expect(ruleIds('<div class="bg-background text-muted-foreground border-border">x</div>'))
      .toEqual([]);
  });

  test("a non-colour utility that looks similar is not a palette class", () => {
    // `grid-cols-12` and `z-50` match the shape but are not colours.
    expect(ruleIds('<div class="grid-cols-12 z-50 duration-300">x</div>')).toEqual([]);
  });

  test("a hue-shaped word on a non-colourable prefix is ignored", () => {
    expect(ruleIds('<div class="delay-150 order-2">x</div>')).toEqual([]);
  });
});

describe("colour: arbitrary values are judged by the value, not the prefix", () => {
  test("a non-colour ring width is not a colour violation", () => {
    // Previously every ring-[...] was reported as a colour error.
    expect(ruleIds('<div class="ring-[2px]">x</div>')).toEqual([]);
  });

  test("a box-shadow geometry is not a colour violation", () => {
    expect(ruleIds('<div class="shadow-[0_1px_2px_black]">x</div>')).toEqual([]);
  });

  test("an arbitrary hex on a colourable prefix still is", () => {
    expect(ruleIds('<div class="bg-[#123456]">x</div>'))
      .toEqual(["colour:arbitrary-value-banned"]);
  });

  test("an arbitrary colour function still is", () => {
    expect(ruleIds('<div class="border-[rgb(1,2,3)]">x</div>'))
      .toEqual(["colour:arbitrary-value-banned"]);
  });

  test("text-[10px] remains typography, not colour", () => {
    expect(ruleIds('<div class="text-[10px]">x</div>'))
      .toEqual(["typography:arbitrary-value-banned"]);
  });

  test("variant selectors are not values", () => {
    expect(ruleIds('<div class="data-[state=open]:bg-muted group-data-[x]:flex">y</div>'))
      .toEqual([]);
  });
});

describe("colour: scope", () => {
  test("the shadcn primitives folder is exempt", () => {
    const markup = '<div class="text-red-500">x</div>';
    expect({
      firstParty: ruleIds(markup),
      vendored: check(markup, "src/lib/components/ui/button/button.svelte").map(v => v.ruleId),
    }).toEqual({ firstParty: ["colour:palette-class-banned"], vendored: [] });
  });

  test("only .svelte files are scanned", () => {
    expect(check('const c = "text-red-500";', "src/lib/utils.ts")).toEqual([]);
  });
});
