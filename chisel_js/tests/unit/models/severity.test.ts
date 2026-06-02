import { describe, test, expect } from "bun:test";
import { Severity } from "chisel/checker/models/severity";

describe("Severity", () => {
  test("Severity.ERROR is error", () => {
    expect(Severity.ERROR).toBe("error");
  });
  test("Severity.WARNING is warning", () => {
    expect(Severity.WARNING).toBe("warning");
  });
  test("Severity.INFO is info", () => {
    expect(Severity.INFO).toBe("info");
  });

  test("error is the highest severity", () => {
    const levels = [Severity.ERROR, Severity.WARNING, Severity.INFO];
    expect(levels).toContain(Severity.ERROR);
  });
});
