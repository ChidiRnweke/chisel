import type { Exemption } from "chisel/checker/models/exemption";
import type { Violation } from "chisel/checker/models/violation";
import { createExemption } from "chisel/checker/models/exemption";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export class ExceptionRegistry {
  private readonly exemptions: Exemption[] = [];

  load(root: string): void {
    const configPath = join(root, "chisel-exceptions.json");
    if (!existsSync(configPath)) return;
    const data = JSON.parse(readFileSync(configPath, "utf-8")) as { exceptions?: unknown };
    const entries = Array.isArray(data.exceptions) ? data.exceptions : [];
    for (const entry of entries) {
      this.exemptions.push(this.toExemption(entry));
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

  private toExemption(entry: unknown): Exemption {
    const record = (entry ?? {}) as Record<string, unknown>;
    return createExemption({
      filePatterns: toStringList(record.files),
      ruleIds: toStringList(record.rules),
      reason: typeof record.reason === "string" ? record.reason : "",
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

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

// Mirrors Python's fnmatch so the same chisel-exceptions.toml behaves
// identically under both checkers: `*` matches across `/`, `?` matches any
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
