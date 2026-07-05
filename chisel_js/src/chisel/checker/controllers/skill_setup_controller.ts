import { SkillTarget, type SkillSetupResult } from "chisel/checker/models/agent_skill";
import type { ISkillInstaller } from "chisel/checker/services/agent_skills";

export class SkillSetupController {
  constructor(private readonly installer: ISkillInstaller) {}

  setup(
    projectPath: string,
    target: SkillTarget,
    options: {
      readonly skillNames?: string[];
      readonly overwrite?: boolean;
      readonly dryRun?: boolean;
    } = {},
  ): SkillSetupResult {
    return {
      target,
      targetDir: this.installer.targetDir(target),
      results: this.installer.install(projectPath, target, options),
    };
  }
}
