import type { Exemption } from "chisel/checker/models/exemption";
import type { Violation } from "chisel/checker/models/violation";
import { createExemption } from "chisel/checker/models/exemption";
import type { Json, JsonObject } from "chisel/checker/repositories/json_file";
import { ConfigError } from "chisel/checker/errors";
import { asObject, asString, asStrings, readJsonFile } from "chisel/checker/repositories/json_file";
import { existsSync } from "node:fs";
import { join } from "node:path";

export class ExceptionRegistry {
  private readonly exemptions: Exemption[] = [];

  /**
   * Load `chisel-exceptions.json`. A file that does not parse stops the run: a
   * registry read as empty would turn every exemption into a violation, and a
   * registry that silently loses entries is worse.
   */
  load(root: string): void {
    const configPath = join(root, "chisel-exceptions.json");
    if (!existsSync(configPath)) return;
    const read = readJsonFile(configPath);
    if (read.kind === "failure") {
      throw new ConfigError(`chisel-exceptions.json is not valid JSON: ${read.reason}`);
    }
    const entries = asObject(read.value)?.["exceptions"];
    if (!Array.isArray(entries)) return;
    for (const entry of entries as readonly Json[]) {
      this.exemptions.push(this.toExemption(asObject(entry) ?? {}));
    }
  }

  isExempted(file: string, ruleId: string): boolean {
    return this.exemptions.some(
      e => this.fileMatches(file, e.filePatterns) && this.ruleMatches(ruleId, e.ruleIds),
    );
  }

  filter(violations: Violation[]): Violation[] {
    return violations.filter(v => !this.isExempted(v.file, v.ruleId));
  }

  private toExemption(entry: JsonObject): Exemption {
    return createExemption({
      filePatterns: asStrings(entry["files"]) ?? [],
      ruleIds: asStrings(entry["rules"]) ?? [],
      reason: asString(entry["reason"]) ?? "",
    });
  }

  private fileMatches(file: string, patterns: readonly string[]): boolean {
    return patterns.some(pattern => fnmatchToRegExp(pattern).test(file));
  }

  private ruleMatches(ruleId: string, rules: readonly string[]): boolean {
    return rules.some(
      rule =>
        rule === "*" ||
        ruleId === rule ||
        ruleId.startsWith(rule + ":") ||
        ruleId.startsWith(rule + "."),
    );
  }
}


// Mirrors Python's fnmatch so patterns behave identically under both checkers,
// even though the files differ by ecosystem (chisel-exceptions.json here,
// chisel-exceptions.toml in chisel_py): `*` matches across `/`, `?` matches any
// single character, `[seq]`/`[!seq]` are character classes.
function fnmatchToRegExp(pattern: string): RegExp {
  let regex = "";
  let i = 0;
  while (i < pattern.length) {
    const char = pattern[i];
    if (char === "*") {
      regex += ".*";
      i += 1;
    } else if (char === "?") {
      regex += ".";
      i += 1;
    } else if (char === "[") {
      const closing = findClassEnd(pattern, i);
      if (closing === -1) {
        regex += "\\[";
        i += 1;
      } else {
        regex += toCharacterClass(pattern.slice(i + 1, closing));
        i = closing + 1;
      }
    } else {
      regex += escapeRegExpChar(char);
      i += 1;
    }
  }
  return new RegExp(`^${regex}$`);
}

function findClassEnd(pattern: string, start: number): number {
  let j = start + 1;
  if (pattern[j] === "!") j += 1;
  if (pattern[j] === "]") j += 1;
  while (j < pattern.length && pattern[j] !== "]") j += 1;
  return j < pattern.length ? j : -1;
}

function toCharacterClass(inner: string): string {
  const body = inner.startsWith("!") ? `^${inner.slice(1)}` : inner;
  return `[${body.replace(/\\/g, "\\\\")}]`;
}

function escapeRegExpChar(char: string): string {
  return /[a-zA-Z0-9_/]/.test(char) ? char : `\\${char}`;
}
