export enum SkillTarget {
  CODEX = "codex",
  CLAUDE = "claude",
  OPENCODE = "opencode",
}

export interface SkillInstallResult {
  readonly name: string;
  readonly source: string;
  readonly destination: string;
  readonly status: string;
  readonly reason: string;
}

export interface SkillSetupResult {
  readonly target: SkillTarget;
  readonly targetDir: string;
  readonly results: SkillInstallResult[];
}
