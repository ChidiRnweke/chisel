import { describe, test, expect } from "bun:test";
import { CheckResult, createCheckResult } from "chisel/checker/models/result";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

describe("CheckResult", () => {
  test("counts violations by severity", () => {
    const violations = [
      createViolation({ file: "a.py", line: 1, severity: Severity.ERROR, ruleId: "r1", message: "e" }),
      createViolation({ file: "b.py", line: 1, severity: Severity.ERROR, ruleId: "r2", message: "e" }),
      createViolation({ file: "c.py", line: 1, severity: Severity.WARNING, ruleId: "r3", message: "w" }),
    ];
    const result = createCheckResult(violations, 10);
    expect({
      errors: result.errors,
      warnings: result.warnings,
      info: result.info,
      filesChecked: result.filesChecked,
    }).toEqual({ errors: 2, warnings: 1, info: 0, filesChecked: 10 });
  });

  test("hasErrors returns true when errors present", () => {
    const violations = [
      createViolation({ file: "a.py", line: 1, severity: Severity.ERROR, ruleId: "r1", message: "e" }),
    ];
    const result = createCheckResult(violations, 1);
    expect(result.hasErrors).toBe(true);
  });

  test("hasErrors returns false when no errors", () => {
    const result = createCheckResult([], 0);
    expect(result.hasErrors).toBe(false);
  });
});
