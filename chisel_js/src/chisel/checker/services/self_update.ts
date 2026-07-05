import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { get } from "node:https";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type SelfUpdateManager = "auto" | "npm" | "bun";

export interface SelfUpdateResult {
  readonly command: string[];
  readonly returnCode: number;
}

export interface VersionNotice {
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly command: string;
  readonly message: string;
}

export interface ISelfUpdater {
  update(manager?: SelfUpdateManager, dryRun?: boolean): SelfUpdateResult;
  commandFor(manager?: SelfUpdateManager): string[];
  versionNotice(): Promise<VersionNotice | undefined>;
}

export class SelfUpdater {
  constructor(
    private readonly packageName = "@chidirnweke/chisel-js",
    private readonly displayName = "Chisel JS",
    private readonly registryUrl = "https://registry.npmjs.org/@chidirnweke%2Fchisel-js/latest",
    private readonly cacheTtlMs = 86_400_000,
    private readonly cacheDir?: string,
    private readonly latestFetcher?: () => Promise<string>,
    private readonly currentVersion?: string,
  ) {}

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

  async versionNotice(): Promise<VersionNotice | undefined> {
    const current = this.localVersion();
    const latest = await this.cachedLatestVersion();
    if (!current || !latest) return undefined;
    if (!this.isNewer(latest, current)) return undefined;
    const command = "chisel-js update self";
    return {
      currentVersion: current,
      latestVersion: latest,
      command,
      message: `${this.displayName} ${latest} is available. Update with: ${command}`,
    };
  }

  private resolveManager(manager: SelfUpdateManager): Exclude<SelfUpdateManager, "auto"> {
    if (manager !== "auto") return manager;
    const npmExecPath = process.env.npm_execpath ?? "";
    if (npmExecPath.includes("bun") || process.env.BUN_INSTALL) return "bun";
    return "npm";
  }

  private localVersion(): string {
    if (this.currentVersion) return this.currentVersion;
    for (const path of this.packageJsonCandidates()) {
      try {
        if (!existsSync(path)) continue;
        const data = JSON.parse(readFileSync(path, "utf-8"));
        return String(data.version ?? "");
      } catch {
        continue;
      }
    }
    return "";
  }

  private async cachedLatestVersion(): Promise<string> {
    const cacheFile = this.cacheFile();
    const cached = this.readCache(cacheFile);
    if (cached) return cached;
    try {
      const latest = await this.fetchLatestVersion();
      this.writeCache(cacheFile, latest);
      return latest;
    } catch {
      return "";
    }
  }

  private readCache(cacheFile: string): string {
    try {
      const data = JSON.parse(readFileSync(cacheFile, "utf-8"));
      const checkedAt = Number(data.checkedAt ?? 0);
      if (Date.now() - checkedAt > this.cacheTtlMs) return "";
      return String(data.latestVersion ?? "");
    } catch {
      return "";
    }
  }

  private writeCache(cacheFile: string, latest: string): void {
    try {
      mkdirSync(dirname(cacheFile), { recursive: true });
      writeFileSync(cacheFile, JSON.stringify({
        checkedAt: Date.now(),
        latestVersion: latest,
      }), "utf-8");
    } catch {
      return;
    }
  }

  private cacheFile(): string {
    if (this.cacheDir) return join(this.cacheDir, "version.json");
    const root = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
    return join(root, "chisel-js", "version.json");
  }

  private async fetchLatestVersion(): Promise<string> {
    if (this.latestFetcher) return this.latestFetcher();
    return new Promise(resolve => {
      get(this.registryUrl, response => {
        if (response.statusCode !== 200) {
          response.resume();
          resolve("");
          return;
        }
        let body = "";
        response.setEncoding("utf8");
        response.on("data", chunk => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            const data = JSON.parse(body) as { version?: string };
            resolve(String(data.version ?? ""));
          } catch {
            resolve("");
          }
        });
      }).on("error", () => {
        resolve("");
      });
    });
  }

  private packageJsonCandidates(): string[] {
    const moduleDir = dirname(fileURLToPath(import.meta.url));
    return [
      join(moduleDir, "../package.json"),
      join(moduleDir, "../../package.json"),
      join(moduleDir, "../../../../package.json"),
    ];
  }

  private isNewer(latest: string, current: string): boolean {
    const latestParts = this.versionParts(latest);
    const currentParts = this.versionParts(current);
    const length = Math.max(latestParts.length, currentParts.length);
    for (let index = 0; index < length; index++) {
      const latestPart = latestParts[index] ?? 0;
      const currentPart = currentParts[index] ?? 0;
      if (latestPart > currentPart) return true;
      if (latestPart < currentPart) return false;
    }
    return false;
  }

  private versionParts(version: string): number[] {
    return version.split(".").map(part => {
      const match = part.match(/^\d+/);
      if (!match) return 0;
      return Number(match[0]);
    });
  }
}
