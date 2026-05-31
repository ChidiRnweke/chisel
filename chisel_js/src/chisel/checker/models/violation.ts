import type { Severity } from "./severity";

export interface Violation {
  readonly file: string;
  readonly line: number;
  readonly severity: Severity;
  readonly ruleId: string;
  readonly message: string;
}

export function createViolation(params: {
  file: string;
  line: number;
  severity: Severity;
  ruleId: string;
  message: string;
}): Violation {
  return Object.freeze({ ...params });
}
