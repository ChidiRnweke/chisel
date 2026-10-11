import { describe, test, expect } from "bun:test";
import { StructuralSvelteService } from "chisel/checker/services/svelte/structural";
import { Layer } from "chisel/checker/models/layer";
import { parsedProject } from "../../fakes/parsed_file";

function inlineStyles(source: string): number[] {
  return new StructuralSvelteService()
    .check(parsedProject({ path: "src/lib/components/notes/card.svelte", source, layer: Layer.COMPONENTS }))
    .filter(v => v.ruleId === "structural:inline-style-banned")
    .map(v => v.line);
}

describe("structural — inline styles", () => {
  test("a style: directive is an inline style", () => {
    expect(inlineStyles('<div class="a" style:height="{h}px"></div>\n')).toEqual([1]);
  });

  test("a style attribute on a later line is reported at the element", () => {
    expect(inlineStyles('<p>x</p>\n<div\n  class="a"\n  style="left: {x}%"\n></div>\n')).toEqual([2]);
  });

  test("an element styled with classes passes", () => {
    expect(inlineStyles('<div class="h-4 w-4"></div>\n')).toEqual([]);
  });
});
