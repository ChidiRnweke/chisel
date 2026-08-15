import { describe, test, expect } from "bun:test";
import { TestStructureService } from "chisel/checker/services/shared/test_structure";
import { Layer } from "chisel/checker/models/layer";
import { parsedProject } from "../../fakes/parsed_file";

function check(path: string, source: string): string[] {
  const project = parsedProject({ path, source, layer: Layer.TESTS });
  return new TestStructureService().check(project).map(v => v.ruleId);
}

describe("test-structure — scope", () => {
  test("a colocated spec is checked, not skipped for living outside tests/", () => {
    // The previous scope was "the path contains tests/", which silently
    // exempted every colocated spec in the repo.
    expect(check("src/lib/server/services/notes.spec.ts", `
      test("returns the note it was given", () => {
        vi.mock("./db");
      });
    `)).toEqual(["test-structure:mocking-banned"]);
  });

  test("a spec beside its subject is a valid location", () => {
    expect(check("src/lib/server/services/notes.spec.ts", `
      test("returns the note it was given", () => {
        expect(1).toBe(1);
      });
    `)).toEqual([]);
  });

  test("a spec under a tests root is a valid location", () => {
    expect(check("tests/unit/notes.spec.ts", `
      test("returns the note it was given", () => {
        expect(1).toBe(1);
      });
    `)).toEqual([]);
  });

  test("a spec in neither place is reported", () => {
    expect(check("scripts/notes.spec.ts", `
      test("returns the note it was given", () => {
        expect(1).toBe(1);
      });
    `)).toEqual(["test-structure:test-file-location"]);
  });
});

describe("test-structure — naming", () => {
  test("a name that only restates a symbol is reported", () => {
    expect(check("src/lib/notes.spec.ts", `
      test("save", () => {
        expect(1).toBe(1);
      });
    `)).toEqual(["test-structure:test-naming"]);
  });

  test("a call to a function merely ending in it is not a test declaration", () => {
    // The line-regex this replaced matched the tail of `split('\\n')` and
    // `admit('user-1')`, then reported their arguments as bad test names.
    expect(check("src/lib/notes.spec.ts", `
      test("returns one line per entry", () => {
        const lines = source.split("\\n");
        expect(admission.admit("user-1")).toEqual({ allowed: true, lines });
      });
    `)).toEqual([]);
  });
});

describe("test-structure — assertion counting", () => {
  test("a test whose body contains a block is counted correctly", () => {
    // The regex this replaced ended the body at the first `}`, so the object
    // literal hid the second assertion.
    expect(check("src/lib/notes.spec.ts", `
      test("returns both fields it was given", () => {
        const note = { id: 1, title: "t" };
        expect(note.id).toBe(1);
        expect(note.title).toBe("t");
      });
    `)).toEqual(["test-structure:one-assert-per-test"]);
  });

  test("one assertion collapsing several values passes", () => {
    expect(check("src/lib/notes.spec.ts", `
      test("returns both fields it was given", () => {
        const note = { id: 1, title: "t" };
        expect(note).toEqual({ id: 1, title: "t" });
      });
    `)).toEqual([]);
  });

  test("an end-to-end spec may assert at every step", () => {
    expect(check("tests/e2e/notes.e2e.ts", `
      test("a note survives a reload", () => {
        expect(1).toBe(1);
        expect(2).toBe(2);
      });
    `)).toEqual([]);
  });
});

describe("test-structure — test doubles", () => {
  test("a fake with no declared interface is reported", () => {
    expect(check("src/lib/testing/fakes/notes.ts",
      "export class FakeNotes { list() { return []; } }",
    )).toEqual(["test-structure:untyped-fake"]);
  });

  test("a fake declaring the interface it stands in for passes", () => {
    expect(check("src/lib/testing/fakes/notes.ts",
      "export class InMemoryNotes implements INotes { list() { return []; } }",
    )).toEqual([]);
  });

  test("as unknown as is reported as the type error it silences", () => {
    expect(check("src/lib/notes.spec.ts", `
      test("builds the controller from a partial fake", () => {
        const deps = {} as unknown as NotesDependencies;
        expect(deps).toBeDefined();
      });
    `)).toEqual(["test-structure:unsafe-dependency-cast"]);
  });

  test("an assertion about calls is reported", () => {
    expect(check("src/lib/notes.spec.ts", `
      test("saves the note it was given", () => {
        expect(save).toHaveBeenCalledWith(note);
      });
    `)).toEqual(["test-structure:interaction-assertion"]);
  });
});

describe("test-structure — skips", () => {
  test("a bare skip is reported", () => {
    expect(check("src/lib/notes.spec.ts", `
      test.skip("returns the note", () => {
        expect(1).toBe(1);
      });
    `)).toEqual(["test-structure:skip-without-reason"]);
  });

  test("a skip explained by a reason argument passes", () => {
    expect(check("src/lib/notes.spec.ts", `
      test.skip(needsDatabase, "the dev database must seed two notes first", () => {
        expect(1).toBe(1);
      });
    `)).toEqual([]);
  });

  test("a skip explained by a comment above it passes", () => {
    expect(check("src/lib/notes.spec.ts", `
      // Blocked on the upstream search index rebuild, see issue 412.
      test.skip("returns ranked notes", () => {
        expect(1).toBe(1);
      });
    `)).toEqual([]);
  });
});
