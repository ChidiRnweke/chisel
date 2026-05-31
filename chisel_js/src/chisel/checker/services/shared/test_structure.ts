import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

export class TestStructureService {
  readonly ruleIdPrefix = "test-structure";

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!file.path.includes("tests/")) continue;
      if (!file.source) continue;
      violations.push(...this._checkTestLocation(file));
      violations.push(...this._checkTestNaming(file));
      violations.push(...this._checkOneAssertPerTest(file));
      violations.push(...this._checkMockingBanned(file));
      violations.push(...this._checkSkipReason(file));
    }
    return violations;
  }

  // Test files must be under tests/unit/, tests/integration/, tests/e2e/
  private _checkTestLocation(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    const name = file.path.split("/").pop() ?? "";
    if (name.startsWith("test_") || name.endsWith(".test.ts") || name.endsWith(".spec.ts")) {
      const validRoots = ["tests/unit/", "tests/integration/", "tests/e2e/"];
      const inValidRoot = validRoots.some(r => file.path.startsWith(r));
      if (!inValidRoot) {
        violations.push(createViolation({
          file: file.path, line: 1, severity: Severity.ERROR,
          ruleId: "test-structure:test-file-location",
          message: "Test files must live under tests/unit/, tests/integration/, or tests/e2e/.",
        }));
      }
    }
    return violations;
  }

  // Test names must describe invariants
  private _checkTestNaming(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/(?:test|it)\s*\(\s*["']([^"']+)["']/);
      if (match) {
        const name = match[1];
        if (!name.includes(" ") && name.split(/(?=[A-Z])/).length < 3) {
          violations.push(createViolation({
            file: file.path, line: i + 1, severity: Severity.ERROR,
            ruleId: "test-structure:test-naming",
            message: `Test name "${name}" does not describe an invariant. Use descriptive names: test_cannot_X, test_returns_Y_when_Z.`,
          }));
        }
      }
    }
    return violations;
  }

  private _checkOneAssertPerTest(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (!file.path.includes("tests/")) return violations;
    const testFuncs = file.source.matchAll(/(?:test|it)\s*\(\s*["'][^"']+["']\s*,\s*(?:async\s*)?(?:\(\)\s*=>\s*)?\{([\s\S]*?)\}\s*\)/g);
    for (const m of testFuncs) {
      const body = m[1];
      const expectCount = (body.match(/expect\s*\(/g) ?? []).length;
      if (expectCount > 1) {
        const idx = m.index!;
        const lineNum = file.source.substring(0, idx).split("\n").length;
        violations.push(createViolation({
          file: file.path, line: lineNum, severity: Severity.ERROR,
          ruleId: "test-structure:one-assert-per-test",
          message: `Test has ${expectCount} assert/expect statements (exactly 1 required). Split into separate test functions.`,
        }));
      }
    }
    return violations;
  }

  private _checkMockingBanned(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (!file.path.includes("tests/")) return violations;
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/\b(jest\.mock|vi\.mock|spyOn|jest\.fn|vi\.fn)\b/.test(lines[i])) {
        violations.push(createViolation({
          file: file.path, line: i + 1, severity: Severity.ERROR,
          ruleId: "test-structure:mocking-banned",
          message: "Mocking libraries (jest.mock, vi.mock, spyOn) are banned. Write a fake that implements the full Protocol/interface instead.",
        }));
      }
    }
    return violations;
  }

  private _checkSkipReason(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (!file.path.includes("tests/")) return violations;
    const skips = file.source.matchAll(/test\.skip\s*\(/g);
    for (const m of skips) {
      const idx = m.index!;
      const lineNum = file.source.substring(0, idx).split("\n").length;
      const line = file.source.split("\n")[lineNum - 1];
      if (!line.includes("reason")) {
        violations.push(createViolation({
          file: file.path, line: lineNum, severity: Severity.ERROR,
          ruleId: "test-structure:skip-without-reason",
          message: "test.skip must include a reason explaining why this test is skipped and when it should be re-enabled.",
        }));
      }
    }
    return violations;
  }

  describeRules() {
    return [
      { id: "test-structure:test-file-location", category: "test-structure",
        description: "Test file outside tests/unit/, tests/integration/, or tests/e2e/",
        fixGuidance: "Move into the correct directory." },
      { id: "test-structure:test-naming", category: "test-structure",
        description: "Test name does not describe an invariant",
        fixGuidance: "Name the test after the invariant it proves: test_cannot_X, test_returns_Y_when_Z." },
      { id: "test-structure:one-assert-per-test", category: "test-structure", description: "More than one assert/expect in a test", fixGuidance: "Split into separate test functions, one per assertion. Name each after the invariant it proves." },
      { id: "test-structure:mocking-banned", category: "test-structure", description: "Mocking library usage (jest.mock, vi.mock, spyOn)", fixGuidance: "Write a fake that implements the full Protocol/interface. Put it in tests/fakes/." },
      { id: "test-structure:skip-without-reason", category: "test-structure", description: "test.skip without reason", fixGuidance: "Add a reason string explaining why this test is skipped and when it should be re-enabled." },
    ];
  }
}
