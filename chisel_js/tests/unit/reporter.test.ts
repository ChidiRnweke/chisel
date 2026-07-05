import { describe, test, expect } from "bun:test";
import { Reporter } from "chisel/checker/reporter";
import { createCheckResult } from "chisel/checker/models/result";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

function result() {
  return createCheckResult([
    createViolation({
      file: "src/a.svelte",
      line: 1,
      severity: Severity.ERROR,
      ruleId: "structural:console-log-banned",
      message: "console.log is banned.",
    }),
    createViolation({
      file: "src/b.svelte",
      line: 2,
      severity: Severity.ERROR,
      ruleId: "structural:console-log-banned",
      message: "console.log is banned.",
    }),
    createViolation({
      file: "tests/a.test.ts",
      line: 3,
      severity: Severity.WARNING,
      ruleId: "test-structure:one-assert-per-test",
      message: "Tests must have one expect.",
    }),
  ], 3);
}

describe("Reporter", () => {
  test("reportJson uses message refs", () => {
    const data = JSON.parse(new Reporter().reportJson(result()));

    expect(data.violations[0].messageRef).toBe("[1]");
    expect(data.violations[1].messageRef).toBe("[1]");
    expect(data.violations[2].messageRef).toBe("[2]");
    expect(data.violations[0].message).toBeUndefined();
    expect(data.messages).toEqual([
      {
        ref: "[1]",
        skillName: "building-sveltekit-frontend",
        message: "console.log is banned.",
      },
      {
        ref: "[2]",
        skillName: "qa",
        message: "Tests must have one expect.",
      },
    ]);
  });
});
