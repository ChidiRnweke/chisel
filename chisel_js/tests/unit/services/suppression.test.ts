import { describe, test, expect } from "bun:test";
import type { Violation } from "chisel/checker/models/violation";
import { SuppressionService } from "chisel/checker/services/shared/suppression";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

const FILE = "src/lib/services/notes/management.ts";

function violation(line: number, ruleId = "structural:raw-fetch"): Violation {
  return createViolation({
    file: FILE,
    line,
    severity: Severity.ERROR,
    ruleId,
    message: "nope",
  });
}

function run(source: string, violations: Violation[]): Violation[] {
  return new SuppressionService().check(violations, new Map([[FILE, source]]));
}

function ruleIds(violations: Violation[]): string[] {
  return violations.map(v => v.ruleId);
}

describe("suppression — line scope", () => {
  test("a trailing directive with a reason suppresses the violation", () => {
    const source = [
      "const a = 1;",
      "await fetch(url); // chisel-ignore structural:raw-fetch -- health probe, no domain model",
    ].join("\n");
    expect(run(source, [violation(2)])).toEqual([]);
  });

  test("a directive on the line above also suppresses", () => {
    // Most violating lines have no room for a trailing comment, so the line
    // above has to work or the feature is unusable.
    const source = [
      "// chisel-ignore structural:raw-fetch -- health probe",
      "await fetch(url);",
    ].join("\n");
    expect(run(source, [violation(2)])).toEqual([]);
  });

  test("a directive two lines above does not reach", () => {
    const source = [
      "// chisel-ignore structural:raw-fetch -- health probe",
      "const a = 1;",
      "await fetch(url);",
    ].join("\n");
    expect(ruleIds(run(source, [violation(3)]))).toEqual(["structural:raw-fetch"]);
  });

  test("an em dash works as the separator", () => {
    const source = "await fetch(url); // chisel-ignore structural:raw-fetch — health probe";
    expect(run(source, [violation(1)])).toEqual([]);
  });

  test("a directive for a different rule does not suppress", () => {
    const source = "await fetch(url); // chisel-ignore complexity:page-loc -- unrelated";
    expect(ruleIds(run(source, [violation(1)]))).toEqual(["structural:raw-fetch"]);
  });

  test("several rule ids may share one directive", () => {
    const source = "x(); // chisel-ignore structural:raw-fetch, colour:dynamic-class -- generated";
    expect(run(source, [violation(1), violation(1, "colour:dynamic-class")])).toEqual([]);
  });

  test("a markup directive works and its closing --> is not read as the reason", () => {
    const source = '<img src="a"> <!-- chisel-ignore component-enforcement:html-img-avatar-banned -- external CDN -->';
    expect(run(source, [violation(1, "component-enforcement:html-img-avatar-banned")])).toEqual([]);
  });
});

describe("suppression — the reason requirement", () => {
  test("a reasonless directive suppresses nothing and is reported", () => {
    const source = "await fetch(url); // chisel-ignore structural:raw-fetch";
    expect(ruleIds(run(source, [violation(1)]))).toEqual([
      "structural:raw-fetch",
      "suppression:missing-reason",
    ]);
  });

  test("a bare separator with no text is still no reason", () => {
    const source = "await fetch(url); // chisel-ignore structural:raw-fetch --";
    expect(ruleIds(run(source, [violation(1)]))).toContain("suppression:missing-reason");
  });

  test("missing-reason is reported once per line, not once per violation", () => {
    const source = "x(); // chisel-ignore structural:raw-fetch, colour:dynamic-class";
    const out = run(source, [violation(1), violation(1, "colour:dynamic-class")]);
    expect(out.filter(v => v.ruleId === "suppression:missing-reason").length).toBe(1);
  });

  test("the report names the rule and shows the required form", () => {
    const source = "await fetch(url); // chisel-ignore structural:raw-fetch";
    const reported = run(source, [violation(1)])
      .find(v => v.ruleId === "suppression:missing-reason");
    expect({
      namesRule: reported?.message.includes("structural:raw-fetch"),
      showsForm: reported?.message.includes("--"),
    }).toEqual({ namesRule: true, showsForm: true });
  });
});

describe("suppression — file scope", () => {
  test("a header directive with a reason covers the whole file", () => {
    const source = [
      "// chisel-ignore-file structural:raw-fetch -- vendored transport layer",
      "",
      "await fetch(a);",
      "await fetch(b);",
    ].join("\n");
    expect(run(source, [violation(3), violation(4)])).toEqual([]);
  });

  test("a reasonless header directive suppresses nothing", () => {
    // The Python sibling inverts this test: file scope fires only for a
    // reasonless header and then claims a reason was present.
    const source = ["// chisel-ignore-file structural:raw-fetch", "await fetch(a);"].join("\n");
    expect(ruleIds(run(source, [violation(2)]))).toEqual([
      "structural:raw-fetch",
      "suppression:missing-reason",
    ]);
  });

  test("a header directive below the header window does not apply", () => {
    const source = [
      "1", "2", "3", "4", "5",
      "// chisel-ignore-file structural:raw-fetch -- too late",
      "await fetch(a);",
    ].join("\n");
    expect(ruleIds(run(source, [violation(7)]))).toEqual(["structural:raw-fetch"]);
  });

  test("a line-scoped directive in the header does not become file-scoped", () => {
    const source = [
      "// chisel-ignore structural:raw-fetch -- only this line",
      "await fetch(a);",
      "await fetch(b);",
    ].join("\n");
    expect(ruleIds(run(source, [violation(2), violation(3)])))
      .toEqual(["structural:raw-fetch"]);
  });
});

describe("suppression — rule matching", () => {
  test("a category prefix suppresses its rules", () => {
    const source = "await fetch(url); // chisel-ignore structural -- whole category, reviewed";
    expect(run(source, [violation(1)])).toEqual([]);
  });

  test("a prefix only matches at a colon boundary", () => {
    // Python's bare startswith would let `structural` suppress this.
    const source = "x(); // chisel-ignore structural -- reviewed";
    expect(ruleIds(run(source, [violation(1, "structural-extra:thing")])))
      .toEqual(["structural-extra:thing"]);
  });
});

describe("suppression — edge cases", () => {
  test("a file with no source is left alone", () => {
    const out = new SuppressionService().check([violation(1)], new Map());
    expect(ruleIds(out)).toEqual(["structural:raw-fetch"]);
  });

  test("a violation past the end of the file is left alone", () => {
    expect(ruleIds(run("const a = 1;", [violation(99)]))).toEqual(["structural:raw-fetch"]);
  });

  test("text merely mentioning the keyword is not a directive", () => {
    const source = "// we should chisel-ignore this one day\nawait fetch(url);";
    expect(ruleIds(run(source, [violation(2)]))).toEqual(["structural:raw-fetch"]);
  });
});
