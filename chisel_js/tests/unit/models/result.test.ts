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
    expect(result.errors).toBe(2);
    expect(result.warnings).toBe(1);
    expect(result.info).toBe(0);
    expect(result.filesChecked).toBe(10);
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
