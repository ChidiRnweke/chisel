import { describe, test, expect } from "bun:test";
import { Violation, createViolation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";

describe("Violation", () => {
  test("creates a violation with all fields", () => {
    const v = createViolation({
      file: "src/foo.py",
      line: 10,
      severity: Severity.ERROR,
      ruleId: "structural:print-banned",
      message: "print() is banned",
    });
    expect(v.file).toBe("src/foo.py");
    expect(v.line).toBe(10);
    expect(v.severity).toBe(Severity.ERROR);
    expect(v.ruleId).toBe("structural:print-banned");
    expect(v.message).toBe("print() is banned");
  });

  test("violations are immutable", () => {
    const v = createViolation({
      file: "src/foo.py",
      line: 1,
      severity: Severity.WARNING,
      ruleId: "test",
      message: "test",
    });
    const frozen = Object.isFrozen(v);
    expect(frozen).toBe(true);
  });
});
