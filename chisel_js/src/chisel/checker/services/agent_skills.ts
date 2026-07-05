import { SkillTarget, type SkillInstallResult } from "chisel/checker/models/agent_skill";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const TARGET_DIRS: Record<SkillTarget, string> = {
  [SkillTarget.CODEX]: ".agents/skills",
  [SkillTarget.CLAUDE]: ".claude/skills",
  [SkillTarget.OPENCODE]: ".opencode/skills",
};

export interface ISkillInstaller {
  availableSkills(): string[];
  install(
    projectPath: string,
    target: SkillTarget,
    options?: {
      readonly skillNames?: string[];
      readonly overwrite?: boolean;
      readonly dryRun?: boolean;
    },
  ): SkillInstallResult[];
  targetDir(target: SkillTarget): string;
}

export class SkillInstaller {
  constructor(private readonly sourceDir?: string) {}

  availableSkills(): string[] {
    return this.skillDirs().map(path => path.name);
  }

  install(
    projectPath: string,
    target: SkillTarget,
    options: {
      readonly skillNames?: string[];
      readonly overwrite?: boolean;
      readonly dryRun?: boolean;
    } = {},
  ): SkillInstallResult[] {
    const root = resolve(projectPath);
    const selected = new Set(options.skillNames ?? []);
    const available = new Map(this.skillDirs().map(path => [path.name, path.path]));
    const results: SkillInstallResult[] = [];

    for (const missing of [...selected].filter(name => !available.has(name)).sort()) {
      const destination = join(root, TARGET_DIRS[target], missing);
      results.push({
        name: missing,
        source: "",
        destination,
        status: "skipped_missing",
        reason: "No bundled skill with this name exists.",
      });
    }

    for (const [name, source] of [...available.entries()].sort()) {
      if (selected.size && !selected.has(name)) continue;
      this.validateSkill(source, name);
      const destination = join(root, TARGET_DIRS[target], name);
      if (existsSync(destination) && !options.overwrite) {
        results.push({
          name,
          source,
          destination,
          status: "skipped_exists",
          reason: "Destination already exists. Pass --overwrite to replace it.",
        });
        continue;
      }
      if (options.dryRun) {
        results.push({
          name,
          source,
          destination,
          status: "would_install",
          reason: "Dry run; no files were written.",
        });
        continue;
      }
      this.copySkill(source, destination, options.overwrite ?? false);
      results.push({
        name,
        source,
        destination,
        status: "installed",
        reason: "Installed skill.",
      });
    }

    return results;
  }

  targetDir(target: SkillTarget): string {
    return TARGET_DIRS[target];
  }

  private copySkill(source: string, destination: string, overwrite: boolean): void {
    const parent = dirname(destination);
    mkdirSync(parent, { recursive: true });
    const skillName = basename(destination) || "skill";
    const tempParent = mkdtempSync(join(parent || tmpdir(), `.${skillName}.`));
    const tempDestination = join(tempParent, skillName);
    cpSync(source, tempDestination, {
      recursive: true,
      filter: path => !path.endsWith("__pycache__") && !path.endsWith(".pyc"),
    });
    if (existsSync(destination)) {
      if (overwrite) {
        rmSync(destination, { recursive: true, force: true });
      } else {
        rmSync(tempParent, { recursive: true, force: true });
        return;
      }
    }
    renameSync(tempDestination, destination);
    rmSync(tempParent, { recursive: true, force: true });
  }

  private skillDirs(): Array<{ readonly name: string; readonly path: string }> {
    const source = this.resolveSourceDir();
    return readdirSync(source, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && existsSync(join(source, entry.name, "SKILL.md")))
      .map(entry => ({ name: entry.name, path: join(source, entry.name) }));
  }

  private resolveSourceDir(): string {
    if (this.sourceDir) return this.sourceDir;
    const moduleDir = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      join(moduleDir, "../bundled_skills"),
      join(moduleDir, "../../bundled_skills"),
      join(moduleDir, "../../skills"),
      join(moduleDir, "../../../../../skills"),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    throw new Error("Bundled Chisel skills could not be found.");
  }

  private validateSkill(skillDir: string, expectedName: string): void {
    const frontmatter = this.frontmatter(join(skillDir, "SKILL.md"));
    if (frontmatter.name !== expectedName) {
      throw new Error(`${join(skillDir, "SKILL.md")} must declare name: ${expectedName}`);
    }
    if (!frontmatter.description) {
      throw new Error(`${join(skillDir, "SKILL.md")} must declare a description.`);
    }
  }

  private frontmatter(skillFile: string): Record<string, string> {
    const lines = readFileSync(skillFile, "utf-8").split(/\r?\n/);
    if (!lines.length || lines[0].trim() !== "---") {
      throw new Error(`${skillFile} must start with YAML frontmatter.`);
    }
    const data: Record<string, string> = {};
    for (const line of lines.slice(1)) {
      if (line.trim() === "---") return data;
      if (!line.includes(":")) continue;
      const [key, ...valueParts] = line.split(":");
      data[key.trim()] = valueParts.join(":").trim().replace(/^"|"$/g, "");
    }
    throw new Error(`${skillFile} frontmatter is not closed.`);
  }
}
