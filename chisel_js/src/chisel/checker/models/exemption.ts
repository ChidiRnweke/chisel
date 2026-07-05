export interface Exemption {
  readonly filePatterns: readonly string[];
  readonly ruleIds: readonly string[];
  readonly reason: string;
}

export function createExemption(params: {
  filePatterns: string[];
  ruleIds: string[];
  reason: string;
}): Exemption {
  return Object.freeze({ ...params });
}
