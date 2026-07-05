import type { CheckResult } from "chisel/checker/models/result";
import type { Violation } from "chisel/checker/models/violation";
import { skillNameForRule } from "chisel/checker/rule_metadata";
import chalk from "chalk";

const GENERATED_DIR_PARTS = [
  "build/", "dist/", ".svelte-kit/", "coverage/", ".vercel/",
  ".netlify/", ".output/", ".cache/", ".turbo/", ".parcel-cache/",
];

function isGeneratedPath(path: string): boolean {
  const normal = path.replace(/\\/g, "/");
  return GENERATED_DIR_PARTS.some(p => normal.startsWith(p) || normal.includes("/" + p));
}

export class Reporter {
  report(result: CheckResult): void {
    if (result.violations.length === 0) {
      console.log(chalk.green(`✓ ${result.filesChecked} files checked — no violations`));
      return;
    }

    console.log(chalk.bold("\nChisel Architecture Check\n"));
    const { refs, messages } = this.messageRefs(result.violations);

    const grouped = groupByRule(result.violations);
    for (const group of grouped) {
      const sevLabel = group.severity === "error"
        ? chalk.red("ERROR")
        : group.severity === "warning"
          ? chalk.yellow("WARN ")
          : chalk.blue("INFO ");
      console.log(
        `${sevLabel} ${chalk.white(group.ruleId.padEnd(42))} ${chalk.dim(`x${group.count}`)} `
        + (group.generated > 0 ? chalk.dim(`(${group.generated} in generated)`) : "")
      );
    }
    console.log("");

    for (const v of result.violations) {
      const sev = v.severity === "error" ? chalk.red("ERROR")
                : v.severity === "warning" ? chalk.yellow("WARNING")
                : chalk.blue("INFO");
      const genTag = isGeneratedPath(v.file) ? chalk.magenta(" gen ") : "     ";
      console.log(
        `${chalk.dim(refs.get(v) ?? "")}  ${genTag}${chalk.cyan(v.file)}:${chalk.dim(String(v.line))}  ${sev}  ${chalk.white(v.ruleId)}`
      );
    }

    console.log(chalk.bold("\nMessages"));
    for (const message of messages) {
      console.log(`${message.ref} skill: ${message.skillName} - ${message.message}`);
    }

    const noisy = noisyRules(result.violations);
    if (noisy.length > 0) {
      console.log(chalk.bold("\nTop noisy rules"));
      for (const n of noisy) {
        console.log(`  ${chalk.white(n.ruleId.padEnd(42))} ${chalk.yellow(`x${n.count}`)} ${chalk.dim(`(${n.generated} in generated files)`)}`);
      }
    }

    console.log(
      `\n${result.filesChecked} files checked | ` +
      chalk.red(`${result.errors} errors`) + " | " +
      chalk.yellow(`${result.warnings} warnings`) + " | " +
      chalk.blue(`${result.info} info`)
    );
  }

  reportJson(result: CheckResult): string {
    const { refs, messages } = this.messageRefs(result.violations);
    const grouped = groupByRule(result.violations);
    const noisy = noisyRules(result.violations);
    return JSON.stringify({
      summary: {
        filesChecked: result.filesChecked,
        errors: result.errors,
        warnings: result.warnings,
        info: result.info,
      },
      messages,
      violations: result.violations.map((v) => ({
        file: v.file,
        line: v.line,
        severity: v.severity,
        ruleId: v.ruleId,
        messageRef: refs.get(v),
        generated: isGeneratedPath(v.file),
      })),
      groupedByRule: grouped.map(g => ({
        ruleId: g.ruleId,
        severity: g.severity,
        count: g.count,
        generated: g.generated,
        files: g.files,
      })),
      noisyRules: noisy,
    }, null, 2);
  }

  private messageRefs(violations: readonly Violation[]): {
    refs: Map<Violation, string>;
    messages: Array<{ ref: string; skillName: string; message: string }>;
  } {
    const refs = new Map<Violation, string>();
    const byMessage = new Map<string, string>();
    const messages: Array<{ ref: string; skillName: string; message: string }> = [];

    for (const violation of violations) {
      const skillName = skillNameForRule(violation.ruleId);
      const key = `${skillName}\0${violation.message}`;
      let ref = byMessage.get(key);
      if (ref === undefined) {
        ref = `[${messages.length + 1}]`;
        byMessage.set(key, ref);
        messages.push({ ref, skillName, message: violation.message });
      }
      refs.set(violation, ref);
    }

    return { refs, messages };
  }
}

function groupByRule(violations: readonly Violation[]): Array<{
  ruleId: string;
  severity: string;
  count: number;
  generated: number;
  files: number;
}> {
  const map = new Map<string, { ruleId: string; severity: string; count: number; generated: number; fileSet: Set<string> }>();
  for (const v of violations) {
    const existing = map.get(v.ruleId);
    if (existing) {
      existing.count++;
      existing.fileSet.add(v.file);
      if (isGeneratedPath(v.file)) existing.generated++;
    } else {
      map.set(v.ruleId, {
        ruleId: v.ruleId,
        severity: v.severity,
        count: 1,
        generated: isGeneratedPath(v.file) ? 1 : 0,
        fileSet: new Set([v.file]),
      });
    }
  }
  return [...map.values()]
    .map(g => ({ ...g, files: g.fileSet.size }))
    .sort((a, b) => b.count - a.count);
}

function noisyRules(violations: readonly Violation[]): Array<{
  ruleId: string;
  count: number;
  generated: number;
}> {
  return groupByRule(violations)
    .filter((_, idx, arr) => idx < Math.max(3, Math.ceil(arr.length * 0.2)))
    .map(g => ({
      ruleId: g.ruleId,
      count: g.count,
      generated: g.generated,
    }));
}