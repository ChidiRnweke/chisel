#!/usr/bin/env node
import { program } from "commander";
import { CheckerFactory } from "chisel/checker/factory";
import { Reporter } from "chisel/checker/reporter";

program
  .name("chisel-js")
  .description("Opinionated architecture constraint checker for SvelteKit projects")
  .version("0.1.0");

program
  .command("check")
  .description("Check a project for architectural constraint violations")
  .argument("[path]", "Path to project root", ".")
  .option("--json", "Output violations as JSON")
  .action(async (path: string, options: { json?: boolean }) => {
    const factory = new CheckerFactory();
    const controller = factory.createController();
    
    try {
      const result = await controller.check(path);
      
      if (options.json) {
        console.log(JSON.stringify({
          summary: {
            filesChecked: result.filesChecked,
            errors: result.errors,
            warnings: result.warnings,
            info: result.info,
          },
          violations: result.violations,
        }, null, 2));
      } else {
        const reporter = new Reporter();
        reporter.report(result);
      }
      
      if (result.hasErrors) process.exit(1);
    } catch (err) {
      console.error(`Error: ${err}`);
      process.exit(1);
    }
  });

program
  .command("rules")
  .description("List all available rules")
  .option("--json", "Output as JSON")
  .action((options: { json?: boolean }) => {
    const factory = new CheckerFactory();
    const controller = factory.createController();
    const allRules: any[] = [];
    for (const svc of controller.services) {
      allRules.push(...svc.describeRules());
    }

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
          console.log(`  ${r.id.padEnd(45)} ${r.description}`);
        }
      }
      console.log();
    }
  });

program
  .command("explain")
  .description("Show detailed explanation for a rule")
  .argument("<rule-id>", "Rule ID or category prefix")
  .option("--json", "Output as JSON")
  .action((ruleId: string, options: { json?: boolean }) => {
    const factory = new CheckerFactory();
    const controller = factory.createController();
    const allRules: any[] = [];
    for (const svc of controller.services) {
      allRules.push(...svc.describeRules());
    }

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
        console.log(`Description: ${r.description}`);
        console.log(`\nHow to fix:\n${r.fixGuidance}\n\n`);
      }
    }
  });

program.parse();
