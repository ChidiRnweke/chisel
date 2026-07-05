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

    expect({
      refs: data.violations.map((violation: { messageRef: string }) => violation.messageRef),
      firstMessage: data.violations[0].message,
      messages: data.messages,
    }).toEqual({
      refs: ["[1]", "[1]", "[2]"],
      firstMessage: undefined,
      messages: [
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
      ],
    });
  });

  test("reportJson flags generated files and groups by rule", () => {
    const r = createCheckResult([
      createViolation({
        file: "build/routes/_page.svelte", line: 1, severity: Severity.ERROR,
        ruleId: "structural:writable-banned", message: "writable banned.",
      }),
      createViolation({
        file: "src/lib/Live.svelte", line: 4, severity: Severity.WARNING,
        ruleId: "responsiveness:no-breakpoint-classes", message: "no breakpoint.",
      }),
      createViolation({
        file: "build/routes/_page.svelte", line: 7, severity: Severity.WARNING,
        ruleId: "responsiveness:no-breakpoint-classes", message: "no breakpoint.",
      }),
    ], 3);
    const data = JSON.parse(new Reporter().reportJson(r));

    expect({
      generatedFlags: data.violations.map((v: { generated: boolean }) => v.generated),
      grouped: data.groupedByRule.map((g: { ruleId: string; count: number; generated: number; files: number }) => ({
        ruleId: g.ruleId, count: g.count, generated: g.generated, files: g.files,
      })),
      noisy: data.noisyRules.map((n: { ruleId: string; count: number }) => ({ ruleId: n.ruleId, count: n.count })),
    }).toEqual({
      generatedFlags: [true, false, true],
      grouped: [
        { ruleId: "responsiveness:no-breakpoint-classes", count: 2, generated: 1, files: 2 },
        { ruleId: "structural:writable-banned", count: 1, generated: 1, files: 1 },
      ],
      noisy: [
        { ruleId: "responsiveness:no-breakpoint-classes", count: 2 },
        { ruleId: "structural:writable-banned", count: 1 },
      ],
    });
  });
});
