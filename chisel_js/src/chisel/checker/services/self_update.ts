import { spawnSync } from "node:child_process";

export type SelfUpdateManager = "auto" | "npm" | "bun";

export interface SelfUpdateResult {
  readonly command: string[];
  readonly returnCode: number;
}

export interface ISelfUpdater {
  update(manager?: SelfUpdateManager, dryRun?: boolean): SelfUpdateResult;
  commandFor(manager?: SelfUpdateManager): string[];
}

export class SelfUpdater {
  constructor(private readonly packageName = "@chidirnweke/chisel-js") {}

  update(manager: SelfUpdateManager = "auto", dryRun = false): SelfUpdateResult {
    const command = this.commandFor(manager);
    if (dryRun) return { command, returnCode: 0 };
    const completed = spawnSync(command[0], command.slice(1), { stdio: "inherit" });
    return { command, returnCode: completed.status ?? 1 };
  }

  commandFor(manager: SelfUpdateManager = "auto"): string[] {
    const resolved = this.resolveManager(manager);
    if (resolved === "bun") return ["bun", "add", "-g", this.packageName];
    return ["npm", "install", "-g", this.packageName];
  }

  private resolveManager(manager: SelfUpdateManager): Exclude<SelfUpdateManager, "auto"> {
    if (manager !== "auto") return manager;
    const npmExecPath = process.env.npm_execpath ?? "";
    if (npmExecPath.includes("bun") || process.env.BUN_INSTALL) return "bun";
    return "npm";
  }
}
