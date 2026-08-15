/**
 * Fails when README.md's rule table disagrees with the real rule set.
 *
 * The table's prose is editorial and stays hand-written — generating "what it
 * enforces" would produce something worse than a human sentence. The numbers
 * are not editorial, and they had drifted badly: the table claimed categories
 * that no longer existed (Complexity, Concurrency, Responsiveness) and counts
 * that were wrong by up to eleven. This guards the half a machine can check.
 *
 * It shells out to the CLI rather than importing the rule list, for the same
 * reason docs/scripts/sync-rules.mjs does: what ships is what `chisel-js rules`
 * prints, so that is what the README should be compared against.
 *
 *   bun run scripts/check_readme_rules.ts
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const packageRoot = dirname(import.meta.dir);
const readmePath = join(packageRoot, "README.md");
const cliEntry = join(packageRoot, "src/chisel/cli/main.ts");

interface RuleInfo {
  readonly id: string;
  readonly category: string;
}

/** Category → rule count, as the CLI actually reports it. */
function actualCounts(): Map<string, number> {
  const json = execFileSync("bun", ["run", cliEntry, "rules", "--json"], {
    cwd: packageRoot,
    encoding: "utf-8",
    maxBuffer: 32 * 1024 * 1024,
  });

  const counts = new Map<string, number>();
  for (const rule of JSON.parse(json) as RuleInfo[]) {
    counts.set(rule.category, (counts.get(rule.category) ?? 0) + 1);
  }
  return counts;
}

/**
 * Category → rule count, as README.md claims.
 *
 * Rows are matched on a backticked category in the first cell and "N rule(s)"
 * in the second, so the surrounding prose can be rewritten freely without
 * touching this parser.
 */
function documentedCounts(readme: string): Map<string, number> {
  const counts = new Map<string, number>();
  const row = /^\|\s*`([a-z-]+)`\s*\|\s*(\d+)\s+rules?\s*\|/gm;

  for (const match of readme.matchAll(row)) {
    counts.set(match[1]!, Number(match[2]!));
  }
  return counts;
}

function main(): void {
  const readme = readFileSync(readmePath, "utf-8");
  const actual = actualCounts();
  const documented = documentedCounts(readme);

  if (documented.size === 0) {
    console.error(
      "No rule-count rows found in README.md. The table format changed; "
      + "update scripts/check_readme_rules.ts to match it.",
    );
    process.exit(1);
  }

  const problems: string[] = [];

  for (const [category, count] of [...actual].sort()) {
    const claimed = documented.get(category);
    if (claimed === undefined) {
      problems.push(`  missing row:  \`${category}\` (${count} rules) is not in the table`);
    } else if (claimed !== count) {
      problems.push(`  wrong count:  \`${category}\` says ${claimed}, actual is ${count}`);
    }
  }

  for (const category of [...documented.keys()].sort()) {
    if (actual.has(category)) continue;
    problems.push(`  stale row:    \`${category}\` is in the table but no rule reports it`);
  }

  const total = [...actual.values()].reduce((sum, n) => sum + n, 0);
  const claimedTotal = /(\d+) rules across (\d+) categories/.exec(readme);
  if (claimedTotal === null) {
    problems.push("  missing the \"N rules across M categories\" line above the table");
  } else if (Number(claimedTotal[1]) !== total || Number(claimedTotal[2]) !== actual.size) {
    problems.push(
      `  wrong totals: says ${claimedTotal[1]} rules across ${claimedTotal[2]} categories, `
      + `actual is ${total} across ${actual.size}`,
    );
  }

  if (problems.length > 0) {
    console.error("README.md's rule table disagrees with the rule set:\n");
    console.error(problems.join("\n"));
    console.error(
      "\nFix the table in chisel_js/README.md. Current counts:\n"
      + [...actual].sort().map(([c, n]) => `  ${String(n).padStart(3)}  ${c}`).join("\n"),
    );
    process.exit(1);
  }

  console.log(`README.md rule table is current: ${total} rules across ${actual.size} categories.`);
}

main();
