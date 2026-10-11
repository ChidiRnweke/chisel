import { describe, test, expect } from "bun:test";
import { StructuralSvelteService } from "chisel/checker/services/svelte/structural";
import { Layer } from "chisel/checker/models/layer";
import { parsedProject } from "../../fakes/parsed_file";

function check(source: string, path = "src/lib/server/services/notes/catalog.ts"): string[] {
  return new StructuralSvelteService()
    .check(parsedProject({ path, source, layer: Layer.SERVICES }))
    .map(v => v.ruleId)
    .filter(id => id === "structural:missing-service-interface");
}

describe("structural — service capability interfaces", () => {
  test("a public service implementing a local interface passes", () => {
    expect(check(
      "export interface NoteReader { read(): string }\n"
        + "export class NoteCatalog implements NoteReader { read() { return ''; } }\n",
    )).toEqual([]);
  });

  test("a public service without an implements clause is reported, whatever its name", () => {
    expect(check("export class NoteCatalog { read() { return ''; } }\n"))
      .toEqual(["structural:missing-service-interface"]);
  });

  test("implementing an interface declared elsewhere is reported", () => {
    // A sibling contracts.ts is a same-layer import the boundary rules ban.
    expect(check(
      "import type { NoteReader } from './contracts';\n"
        + "export class NoteCatalog implements NoteReader { read() { return ''; } }\n",
    )).toEqual(["structural:missing-service-interface"]);
  });

  test("a private helper class is not a public capability", () => {
    expect(check("class Tokenizer { split() { return []; } }\n")).toEqual([]);
  });

  test("a browser service follows the same rule", () => {
    expect(check(
      "export class SyncTransport { pull() { return []; } }\n",
      "src/lib/client/services/workspace/sync.ts",
    )).toEqual(["structural:missing-service-interface"]);
  });
});
