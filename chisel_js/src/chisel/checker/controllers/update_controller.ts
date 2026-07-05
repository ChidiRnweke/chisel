import { SkillTarget, type SkillSetupResult } from "chisel/checker/models/agent_skill";
import { SkillInstaller, type ISkillInstaller } from "chisel/checker/services/agent_skills";
import { SelfUpdater, type ISelfUpdater, type SelfUpdateManager, type SelfUpdateResult, type VersionNotice } from "chisel/checker/services/self_update";

export class UpdateController {
  constructor(
    private readonly skillInstaller: ISkillInstaller = new SkillInstaller(),
    private readonly selfUpdater: ISelfUpdater = new SelfUpdater(),
  ) {}

  updateSelf(manager: SelfUpdateManager = "auto", dryRun = false): SelfUpdateResult {
    return this.selfUpdater.update(manager, dryRun);
  }

  async versionNotice(): Promise<VersionNotice | undefined> {
    return this.selfUpdater.versionNotice();
  }

  updateSkills(
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
      targetDir: this.skillInstaller.targetDir(target),
      results: this.skillInstaller.install(projectPath, target, {
        ...options,
        overwrite: options.overwrite ?? true,
      }),
    };
  }
}
