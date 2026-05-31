import type { Severity } from "./severity";
import type { Violation } from "./violation";

export interface CheckResult {
  readonly violations: readonly Violation[];
  readonly errors: number;
  readonly warnings: number;
  readonly info: number;
  readonly filesChecked: number;
  readonly hasErrors: boolean;
}

export function createCheckResult(
  violations: Violation[],
  filesChecked: number
): CheckResult {
  const errors = violations.filter((v) => v.severity === "error").length;
  const warnings = violations.filter((v) => v.severity === "warning").length;
  const info = violations.filter((v) => v.severity === "info").length;
  return Object.freeze({
    violations: Object.freeze([...violations]),
    errors,
    warnings,
    info,
    filesChecked,
    hasErrors: errors > 0,
  });
}
