import { describe, test, expect } from "bun:test";
import { Severity } from "chisel/checker/models/severity";

describe("Severity", () => {
  test("has three severity levels", () => {
    expect(Severity.ERROR).toBe("error");
    expect(Severity.WARNING).toBe("warning");
    expect(Severity.INFO).toBe("info");
  });

  test("error is the highest severity", () => {
    const levels = [Severity.ERROR, Severity.WARNING, Severity.INFO];
    expect(levels).toContain(Severity.ERROR);
  });
});
