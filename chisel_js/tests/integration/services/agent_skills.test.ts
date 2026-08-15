import { describe, expect, test } from "bun:test";
import { SkillTarget } from "chisel/checker/models/agent_skill";
import { SkillInstaller } from "chisel/checker/services/agent_skills";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function makeSkill(root: string, name: string, extraFile = false): void {
  const skillDir = join(root, name);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: Skill ${name}.\n---\n\nUse this skill.\n`,
    "utf-8",
  );
  if (extraFile) {
    mkdirSync(join(skillDir, "references"));
    writeFileSync(join(skillDir, "references", "example.md"), "Example\n", "utf-8");
  }
}

describe("SkillInstaller", () => {
  test("maps targets to agent skill directories", () => {
    const installer = new SkillInstaller();
    expect({
      codex: installer.targetDir(SkillTarget.CODEX),
      claude: installer.targetDir(SkillTarget.CLAUDE),
      opencode: installer.targetDir(SkillTarget.OPENCODE),
    }).toEqual({
      codex: ".agents/skills",
      claude: ".claude/skills",
      opencode: ".opencode/skills",
    });
  });

  test("copies skill with reference files", () => {
    const source = mkdtempSync(join(tmpdir(), "chisel-skills-"));
    const project = mkdtempSync(join(tmpdir(), "chisel-project-"));
    makeSkill(source, "qa", true);

    const results = new SkillInstaller(source).install(project, SkillTarget.CODEX);
    const copiedReference = join(project, ".agents", "skills", "qa", "references", "example.md");

    expect({
      status: results[0].status,
      reference: readFileSync(copiedReference, "utf-8"),
    }).toEqual({
      status: "installed",
      reference: "Example\n",
    });
  });

  test("skips existing skill without overwrite", () => {
    const source = mkdtempSync(join(tmpdir(), "chisel-skills-"));
    const project = mkdtempSync(join(tmpdir(), "chisel-project-"));
    makeSkill(source, "qa");
    const destination = join(project, ".agents", "skills", "qa");
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, "SKILL.md"), "existing\n", "utf-8");

    const results = new SkillInstaller(source).install(project, SkillTarget.CODEX);

    expect(results[0].status).toBe("skipped_exists");
  });

  test("overwrites existing skill when requested", () => {
    const source = mkdtempSync(join(tmpdir(), "chisel-skills-"));
    const project = mkdtempSync(join(tmpdir(), "chisel-project-"));
    makeSkill(source, "qa");
    const destination = join(project, ".agents", "skills", "qa");
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, "SKILL.md"), "existing\n", "utf-8");

    const results = new SkillInstaller(source).install(project, SkillTarget.CODEX, { overwrite: true });

    expect({
      status: results[0].status,
      skill: readFileSync(join(destination, "SKILL.md"), "utf-8").includes("name: qa"),
    }).toEqual({
      status: "installed",
      skill: true,
    });
  });

  test("dry run does not write files", () => {
    const source = mkdtempSync(join(tmpdir(), "chisel-skills-"));
    const project = mkdtempSync(join(tmpdir(), "chisel-project-"));
    makeSkill(source, "qa");

    const results = new SkillInstaller(source).install(project, SkillTarget.CODEX, { dryRun: true });

    expect({
      status: results[0].status,
      exists: existsSync(join(project, ".agents", "skills", "qa")),
    }).toEqual({
      status: "would_install",
      exists: false,
    });
  });

  test("filters by skill name", () => {
    const source = mkdtempSync(join(tmpdir(), "chisel-skills-"));
    const project = mkdtempSync(join(tmpdir(), "chisel-project-"));
    makeSkill(source, "qa");
    makeSkill(source, "planning-features");

    const results = new SkillInstaller(source).install(project, SkillTarget.OPENCODE, {
      skillNames: ["qa"],
    });

    expect({
      names: results.map(result => result.name),
      skippedExists: existsSync(join(project, ".opencode", "skills", "planning-features")),
    }).toEqual({
      names: ["qa"],
      skippedExists: false,
    });
  });
});
