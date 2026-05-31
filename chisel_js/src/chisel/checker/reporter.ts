import type { CheckResult } from "chisel/checker/models/result";
import chalk from "chalk";

export class Reporter {
  report(result: CheckResult): void {
    if (result.violations.length === 0) {
      console.log(chalk.green(`✓ ${result.filesChecked} files checked — no violations`));
      return;
    }
    
    console.log(chalk.bold("\nChisel Architecture Check\n"));
    
    for (const v of result.violations) {
      const sev = v.severity === "error" ? chalk.red("ERROR")
                : v.severity === "warning" ? chalk.yellow("WARNING")
                : chalk.blue("INFO");
      console.log(
        `${chalk.cyan(v.file)}:${chalk.dim(String(v.line))}  ${sev}  ${chalk.white(v.ruleId)}`
      );
      console.log(`  ${v.message}\n`);
    }
    
    console.log(
      `\n${result.filesChecked} files checked | ` +
      chalk.red(`${result.errors} errors`) + " | " +
      chalk.yellow(`${result.warnings} warnings`) + " | " +
      chalk.blue(`${result.info} info`)
    );
  }
}
