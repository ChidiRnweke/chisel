import type { CheckResult } from "chisel/checker/models/result";
import type { Violation } from "chisel/checker/models/violation";
import { skillNameForRule } from "chisel/checker/rule_metadata";
import chalk from "chalk";

export class Reporter {
  report(result: CheckResult): void {
    if (result.violations.length === 0) {
      console.log(chalk.green(`✓ ${result.filesChecked} files checked — no violations`));
      return;
    }
    
    console.log(chalk.bold("\nChisel Architecture Check\n"));
    const { refs, messages } = this.messageRefs(result.violations);
    
    for (const v of result.violations) {
      const sev = v.severity === "error" ? chalk.red("ERROR")
                : v.severity === "warning" ? chalk.yellow("WARNING")
                : chalk.blue("INFO");
      console.log(
        `${chalk.dim(refs.get(v) ?? "")}  ${chalk.cyan(v.file)}:${chalk.dim(String(v.line))}  ${sev}  ${chalk.white(v.ruleId)}`
      );
    }

    console.log(chalk.bold("\nMessages"));
    for (const message of messages) {
      console.log(`${message.ref} skill: ${message.skillName} - ${message.message}`);
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
      })),
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
