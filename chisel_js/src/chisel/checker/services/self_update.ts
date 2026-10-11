import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import type { Json } from "chisel/checker/repositories/json_file";
import { asObject, asString, parseJson, readJsonFile } from "chisel/checker/repositories/json_file";
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

type VersionLookup =
  | { readonly kind: "known"; readonly version: string }
  | { readonly kind: "failure"; readonly reason: string };

type WriteOutcome = { readonly kind: "written" } | { readonly kind: "failure"; readonly reason: string };

/** The non-empty string at `field` of a JSON object, as a version. */
function versionIn(value: Json, field: string, source: string): VersionLookup {
  const version = asString(asObject(value)?.[field]);
  return version === undefined || version === ""
    ? { kind: "failure", reason: `${source} has no "${field}"` }
    : { kind: "known", version };
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

  /**
   * An update notice, when a newer release is known. The notice is advisory: when
   * either version cannot be determined — offline, no cache, an unreadable
   * package.json — there is nothing to say, and the check must never fail the
   * command it decorates.
   */
  async versionNotice(): Promise<VersionNotice | undefined> {
    const current = this.localVersion();
    const latest = await this.cachedLatestVersion();
    if (current.kind === "failure" || latest.kind === "failure") return undefined;
    if (!this.isNewer(latest.version, current.version)) return undefined;
    const command = "chisel-js update self";
    return {
      currentVersion: current.version,
      latestVersion: latest.version,
      command,
      message: `${this.displayName} ${latest.version} is available. Update with: ${command}`,
    };
  }

  private resolveManager(manager: SelfUpdateManager): Exclude<SelfUpdateManager, "auto"> {
    if (manager !== "auto") return manager;
    const npmExecPath = process.env.npm_execpath ?? "";
    if (npmExecPath.includes("bun") || process.env.BUN_INSTALL) return "bun";
    return "npm";
  }

  private localVersion(): VersionLookup {
    if (this.currentVersion) return { kind: "known", version: this.currentVersion };
    for (const path of this.packageJsonCandidates()) {
      if (!existsSync(path)) continue;
      const read = readJsonFile(path);
      if (read.kind === "failure") return read;
      return versionIn(read.value, "version", path);
    }
    return { kind: "failure", reason: "no package.json found beside the installed CLI" };
  }

  private async cachedLatestVersion(): Promise<VersionLookup> {
    const cacheFile = this.cacheFile();
    const cached = this.readCache(cacheFile);
    if (cached.kind === "known") return cached;
    const latest = await this.fetchLatestVersion();
    // A cache that cannot be written only costs a registry request next time.
    if (latest.kind === "known") this.writeCache(cacheFile, latest.version);
    return latest;
  }

  private readCache(cacheFile: string): VersionLookup {
    if (!existsSync(cacheFile)) return { kind: "failure", reason: "no cached version" };
    const read = readJsonFile(cacheFile);
    if (read.kind === "failure") return read;
    const checkedAt = asObject(read.value)?.["checkedAt"];
    if (typeof checkedAt !== "number" || Date.now() - checkedAt > this.cacheTtlMs) {
      return { kind: "failure", reason: "the cached version is stale" };
    }
    return versionIn(read.value, "latestVersion", cacheFile);
  }

  private writeCache(cacheFile: string, latest: string): WriteOutcome {
    try {
      mkdirSync(dirname(cacheFile), { recursive: true });
      writeFileSync(cacheFile, JSON.stringify({
        checkedAt: Date.now(),
        latestVersion: latest,
      }), "utf-8");
      return { kind: "written" };
    } catch (exc) {
      return { kind: "failure", reason: String(exc) };
    }
  }

  private cacheFile(): string {
    if (this.cacheDir) return join(this.cacheDir, "version.json");
    const root = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
    return join(root, "chisel-js", "version.json");
  }

  private async fetchLatestVersion(): Promise<VersionLookup> {
    if (this.latestFetcher) {
      let version: string;
      try {
        version = await this.latestFetcher();
      } catch (exc) {
        return { kind: "failure", reason: String(exc) };
      }
      return version === ""
        ? { kind: "failure", reason: "the registry reported no version" }
        : { kind: "known", version };
    }
    return new Promise(resolve => {
      get(this.registryUrl, response => {
        if (response.statusCode !== 200) {
          response.resume();
          resolve({ kind: "failure", reason: `the registry answered ${response.statusCode}` });
          return;
        }
        let body = "";
        response.setEncoding("utf8");
        response.on("data", chunk => {
          body += chunk;
        });
        response.on("end", () => {
          const read = parseJson(body);
          resolve(read.kind === "failure" ? read : versionIn(read.value, "version", this.registryUrl));
        });
      }).on("error", error => {
        resolve({ kind: "failure", reason: String(error) });
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
