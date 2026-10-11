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
        expect(1).toBe(1);
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

  test("a spec beside a same-named script is colocated", () => {
    const project = parsedProject({
      path: "scripts/deploy.spec.ts",
      source: `test("deploys the build", () => { expect(1).toBe(1); });`,
      layer: Layer.TESTS,
    });
    const withSubject = { ...project, files: [...project.files, { ...project.files[0]!, path: "scripts/deploy.ts", layer: Layer.UNKNOWN }] };
    expect(new TestStructureService().check(withSubject).map(v => v.ruleId)).toEqual([]);
  });

  test("a spec in a script folder with no subject beside it is reported", () => {
    expect(check("scripts/deploy.spec.ts", `
      test("deploys the build", () => { expect(1).toBe(1); });
    `)).toEqual(["test-structure:test-file-location"]);
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

describe("test-structure — assertions", () => {
  test("a test that asserts nothing is reported", () => {
    expect(check("src/lib/notes.spec.ts", `
      test("returns the note it was given", () => {
        const note = { id: 1, title: "t" };
        render(note);
      });
    `)).toEqual(["test-structure:no-assertion"]);
  });

  test("one behaviour may assert each of its outcomes", () => {
    expect(check("src/lib/notes.spec.ts", `
      test("returns both fields it was given", () => {
        const note = { id: 1, title: "t" };
        expect(note.id).toBe(1);
        expect(note.title).toBe("t");
      });
    `)).toEqual([]);
  });

  test("a polled assertion counts", () => {
    expect(check("src/lib/notes.spec.ts", `
      test("shows the note once it loads", async () => {
        await expect.poll(() => loaded()).toBe(true);
      });
    `)).toEqual([]);
  });

  test("an end-to-end spec may assert through its page helpers", () => {
    expect(check("tests/e2e/notes.e2e.ts", `
      test("a note survives a reload", async () => {
        await notesPage.reloadAndFind("t");
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

  test("casting one value through unknown is not reported", () => {
    // A branded id, or a corrupt input fed to a parser on purpose: the reader
    // sees the whole value being cast.
    expect(check("src/lib/notes.spec.ts", `
      test("rejects a corrupt payload", () => {
        expect(() => parse("not a payload" as unknown as Payload)).toThrow();
      });
    `)).toEqual([]);
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
