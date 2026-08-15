#!/usr/bin/env node
import { program } from "commander";
import { InitController } from "chisel/checker/controllers/init_controller";
import { UpdateController } from "chisel/checker/controllers/update_controller";
import { BundleController } from "chisel/checker/controllers/bundle_controller";
import { BuildOutputMissingError } from "chisel/checker/services/build/bundle_budget";
import { CheckerFactory } from "chisel/checker/factory";
import { CheckerMode, isCheckerMode, CHECKER_MODES } from "chisel/checker/models/mode";
import { SkillTarget } from "chisel/checker/models/agent_skill";
import { Reporter } from "chisel/checker/reporter";
import { withSkillName } from "chisel/checker/rule_metadata";
import { CONFIG_FILENAME, loadConfig } from "chisel/checker/config";
import type { SelfUpdateManager } from "chisel/checker/services/self_update";
import { createInterface } from "node:readline/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Read the version from package.json rather than repeating it here. The
 * hardcoded string had drifted a patch release behind, and a version number
 * that can drift is one users cannot trust in a bug report.
 */
function packageVersion(): string {
  for (const candidate of ["../package.json", "../../package.json", "../../../package.json"]) {
    try {
      const path = join(dirname(fileURLToPath(import.meta.url)), candidate);
      const pkg = JSON.parse(readFileSync(path, "utf-8")) as { name?: string; version?: string };
      if (pkg.name?.includes("chisel") === true && pkg.version !== undefined) return pkg.version;
    } catch {
      continue;
    }
  }
  return "unknown";
}

program
  .name("chisel-js")
  .description("Opinionated architecture constraint checker for SvelteKit projects")
  .version(packageVersion());

function parseMode(value: string): CheckerMode {
  if (isCheckerMode(value)) return value;
  throw new Error(`Unknown mode. Use one of: ${CHECKER_MODES.join(", ")}.`);
}

function collectSkill(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

function parseTarget(value: string): SkillTarget {
  if (value === SkillTarget.CODEX || value === SkillTarget.CLAUDE || value === SkillTarget.OPENCODE) {
    return value;
  }
  throw new Error("Unknown target. Use codex, claude, or opencode.");
}

async function chooseTargetInteractively(): Promise<SkillTarget> {
  if (!process.stdin.isTTY) {
    throw new Error("Choose an agent target with --target codex, --target claude, or --target opencode.");
  }
  const choices: Array<[string, SkillTarget, string]> = [
    ["1", SkillTarget.CODEX, ".agents/skills"],
    ["2", SkillTarget.CLAUDE, ".claude/skills"],
    ["3", SkillTarget.OPENCODE, ".opencode/skills"],
  ];
  console.log("Select agent skill target:");
  for (const [number, target, destination] of choices) {
    console.log(`  ${number}. ${target} (${destination})`);
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const selected = (await rl.question("Target [1]: ")).trim() || "1";
  rl.close();
  const match = choices.find(([number, target]) => selected === number || selected === target);
  if (!match) throw new Error("Unknown target selection.");
  return match[1];
}

async function confirmSkillOverwrite(yes?: boolean, dryRun?: boolean): Promise<void> {
  if (yes || dryRun) return;
  if (!process.stdin.isTTY) {
    throw new Error("Pass --yes to overwrite bundled skills in non-interactive mode.");
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    "This will overwrite local modifications in the selected Chisel skill directories. Continue? [y/N] ",
  );
  rl.close();
  if (!["y", "yes"].includes(answer.trim().toLowerCase())) {
    throw new Error("Skill update cancelled.");
  }
}

async function showVersionNotice(): Promise<void> {
  if (!process.stderr.isTTY) return;
  const notice = await new UpdateController().versionNotice();
  if (notice) console.error(notice.message);
}

program
  .command("check")
  .description("Check a project for architectural constraint violations")
  .argument("[path]", "Path to project root", ".")
  .option("--json", "Output violations as JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    try {
      const loaded = loadConfig(path);
      const controller = CheckerFactory.createController({ config: loaded.config });
      const result = await controller.check(path);
      const reporter = new Reporter();

      if (options.json) {
        console.log(reporter.reportJson(result));
      } else {
        reporter.report(result);
        if (loaded.detected) {
          console.error(
            `No ${CONFIG_FILENAME} found; assuming mode "${loaded.config.mode}". `
            + `Run \`chisel-js init\` to pin it.`,
          );
        }
        await showVersionNotice();
      }

      if (result.hasErrors) process.exit(1);
    } catch (err) {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  });

program
  .command("bundle")
  .description("Check emitted client chunks against the application bundle budget")
  .argument("[path]", "Path to project root", ".")
  .option("--json", "Output violations as JSON")
  .action((path: string, options: { json?: boolean }) => {
    try {
      const { result, vendorChunksTolerated } = new BundleController().analyse(path);
      const reporter = new Reporter();

      if (options.json) {
        console.log(reporter.reportJson(result));
      } else {
        reporter.report(result);
        if (vendorChunksTolerated > 0) {
          console.error(
            `${vendorChunksTolerated} oversized vendor-only chunk(s) tolerated: they carry `
            + "no application code, so no amount of application discipline shrinks them.",
          );
        }
      }

      if (result.hasErrors) process.exit(1);
    } catch (err) {
      // A missing build is a usage error, not a passing check: staying silent
      // would report success for a budget nothing was measured against.
      console.error(err instanceof BuildOutputMissingError ? `Error: ${err.message}` : `Error: ${err}`);
      process.exit(1);
    }
  });

program
  .command("init")
  .description(`Detect the project topology and write ${CONFIG_FILENAME}`)
  .argument("[path]", "Path to project root", ".")
  .option("--mode <mode>", `Set the mode explicitly: ${CHECKER_MODES.join(" | ")}`)
  .option("--overwrite", `Replace an existing ${CONFIG_FILENAME}`)
  .option("--dry-run", "Show the config that would be written")
  .option("--json", "Output the result as JSON")
  .action((
    path: string,
    options: { mode?: string; overwrite?: boolean; dryRun?: boolean; json?: boolean },
  ) => {
    try {
      const result = new InitController().init(path, {
        mode: options.mode !== undefined ? parseMode(options.mode) : undefined,
        overwrite: options.overwrite,
        dryRun: options.dryRun,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log(`Mode: ${result.mode}`);
      for (const reason of result.detectionReasons) console.log(`  detected from: ${reason}`);
      if (result.ambiguous) {
        console.error(
          `Topology was ambiguous, so "${result.mode}" was assumed. `
          + `Re-run with --mode if that is wrong.`,
        );
      }
      console.log(result.written
        ? `Wrote ${result.configPath}`
        : `Would write ${result.configPath}:\n${JSON.stringify(result.config, null, 2)}`);
      console.log("\nNext: `chisel-js update skills` to install the agent skills.");
    } catch (err) {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  });

/**
 * Every rule the tool can report, across both entry points. `bundle` runs from
 * its own controller because it needs build output, but a rule a user cannot
 * look up is a rule they meet for the first time as a failure.
 */
function allKnownRules() {
  const controller = CheckerFactory.createController({ config: loadConfig(".").config });
  return [
    ...controller.describeAllRules(),
    ...new BundleController().describeAllRules(),
  ].map(withSkillName);
}

program
  .command("rules")
  .description("List all available rules")
  .option("--json", "Output as JSON")
  .action(async (options: { json?: boolean }) => {
    const allRules = allKnownRules();

    if (options.json) {
      console.log(JSON.stringify(allRules, null, 2));
    } else {
      const categories: Record<string, any[]> = {};
      for (const r of allRules) {
        (categories[r.category] ??= []).push(r);
      }
      for (const [cat, rules] of Object.entries(categories).sort()) {
        console.log(`\n${cat} (${rules.length} rules)`);
        for (const r of rules) {
          console.log(`  ${r.id.padEnd(45)} [${r.skillName}] ${r.description}`);
        }
      }
      console.log();
      await showVersionNotice();
    }
  });

program
  .command("explain")
  .description("Show detailed explanation for a rule")
  .argument("<rule-id>", "Rule ID or category prefix")
  .option("--json", "Output as JSON")
  .action(async (ruleId: string, options: { json?: boolean }) => {
    const allRules = allKnownRules();

    const matches = allRules.filter(r =>
      r.id === ruleId || r.id.startsWith(ruleId + ":") || r.category === ruleId
    );

    if (!matches.length) {
      console.error(`Unknown rule or category: ${ruleId}`);
      process.exit(1);
    }

    if (options.json) {
      console.log(JSON.stringify(matches, null, 2));
    } else {
      for (const r of matches) {
        console.log(`Rule:        ${r.id}`);
        console.log(`Category:    ${r.category}`);
        console.log(`Skill:       ${r.skillName}`);
        console.log(`Description: ${r.description}`);
        console.log(`\nHow to fix:\n${r.fixGuidance}\n\n`);
      }
      await showVersionNotice();
    }
  });

const update = program
  .command("update")
  .description("Update the Chisel CLI or bundled agent skills");

update
  .command("self")
  .description("Update the chisel-js CLI package")
  .option("--manager <manager>", "Package manager: auto, npm, or bun", "auto")
  .option("--dry-run", "Show the upgrade command without running it")
  .action((options: { manager: SelfUpdateManager; dryRun?: boolean }) => {
    try {
      if (!["auto", "npm", "bun"].includes(options.manager)) {
        throw new Error("Unknown manager. Use auto, npm, or bun.");
      }
      const result = new UpdateController().updateSelf(options.manager, options.dryRun ?? false);
      const command = result.command.join(" ");
      if (options.dryRun) {
        console.log(`Would run: ${command}`);
        return;
      }
      if (result.returnCode !== 0) {
        console.error(`Self update failed: ${command}`);
        process.exit(result.returnCode);
      }
      console.log("Chisel JS updated. Restart the CLI to use the new version.");
    } catch (err) {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  });

update
  .command("skills")
  .description("Overwrite installed agent skills with the bundled Chisel skills")
  .argument("[path]", "Path to project root", ".")
  .option("--target <target>", "Agent target: codex, claude, or opencode")
  .option("--skill <skill>", "Update only this bundled skill. May be passed multiple times.", collectSkill, [])
  .option("-y, --yes", "Confirm overwriting existing skill directories")
  .option("--dry-run", "Show what would be updated without writing files")
  .option("--json", "Output update results as JSON")
  .action(async (
    path: string,
    options: { target?: string; skill: string[]; yes?: boolean; dryRun?: boolean; json?: boolean },
  ) => {
    try {
      const target = options.target ? parseTarget(options.target) : await chooseTargetInteractively();
      await confirmSkillOverwrite(options.yes, options.dryRun);
      const result = new UpdateController().updateSkills(path, target, {
        skillNames: options.skill,
        overwrite: true,
        dryRun: options.dryRun ?? false,
      });
      if (options.json) {
        console.log(JSON.stringify({
          target: result.target,
          targetDir: result.targetDir,
          results: result.results,
        }, null, 2));
        return;
      }
      console.log(`Target: ${result.target} (${result.targetDir})`);
      for (const item of result.results) {
        console.log(`${item.status.padEnd(15)} ${item.name.padEnd(32)} ${item.destination}`);
      }
      await showVersionNotice();
    } catch (err) {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  });

program.parse();
