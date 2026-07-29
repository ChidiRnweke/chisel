import type { RuleInfo } from "chisel/checker/rule_metadata";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

/**
 * `chisel-ignore <rule>[, <rule>...] -- <reason>`
 *
 * Both `--` and an em dash are accepted as the separator. The reason is not
 * optional — see `check` for why the parser tolerates its absence.
 */
const IGNORE_RE = /chisel-ignore(-file)?\s*:?\s+([a-zA-Z0-9_:.\-]+(?:\s*,\s*[a-zA-Z0-9_:.\-]+)*)\s*(?:--|—)?\s*(.*)$/;

/** How far into a file a `chisel-ignore-file` comment is honoured. */
const FILE_HEADER_LINES = 5;

interface Directive {
  readonly ruleIds: string[];
  readonly reason: string;
  readonly fileScoped: boolean;
}

/**
 * Applies inline suppressions and reports the ones missing a reason.
 *
 * Mirrors `chisel_py`'s `SuppressionService` in structure, with two of its bugs
 * left behind:
 *
 *  - Python's file-level check inverts its own reason test — it fires *only*
 *    for a reasonless header `noqa`, and then reports that a reason was
 *    present, so the missing-reason diagnostic never appears. Here file scope
 *    uses its own keyword (`chisel-ignore-file`) and runs the same reason
 *    requirement as line scope.
 *  - Python matches rule ids with a bare `startswith`, so `structural` also
 *    suppresses a hypothetical `structural-extra:*`. Here a prefix only matches
 *    at a `:` boundary, the stricter form its own exceptions registry uses.
 *
 * The user-facing keyword is `chisel-ignore` rather than Python's `noqa`:
 * `noqa` is a Python idiom, and this file is read by people who write
 * `eslint-disable`.
 */
export class SuppressionService {
  readonly ruleIdPrefix = "suppression";

  /**
   * Returns the violations that survive suppression, plus a `missing-reason`
   * error for each reasonless directive.
   *
   * A suppression without a reason does **not** suppress. Silencing a rule is a
   * decision someone should have to justify in the diff; an unexplained
   * `chisel-ignore` is the thing this rule exists to surface, so the original
   * violation is kept as well.
   */
  check(violations: readonly Violation[], sources: ReadonlyMap<string, string>): Violation[] {
    const active: Violation[] = [];
    const reported = new Set<string>();

    for (const violation of violations) {
      const directive = this._directiveFor(violation, sources);

      if (directive === undefined) {
        active.push(violation);
        continue;
      }

      if (directive.reason !== "") continue;

      active.push(violation);
      const key = `${violation.file}:${violation.line}`;
      if (reported.has(key)) continue;
      reported.add(key);
      active.push(createViolation({
        file: violation.file,
        line: violation.line,
        severity: Severity.ERROR,
        ruleId: `${this.ruleIdPrefix}:missing-reason`,
        message: `Suppressing "${violation.ruleId}" requires a reason: `
          + `\`chisel-ignore ${violation.ruleId} -- why this case is different\`. `
          + `The violation stands until one is given.`,
      }));
    }

    return active;
  }

  /** The directive suppressing this violation, if any. */
  private _directiveFor(
    violation: Violation,
    sources: ReadonlyMap<string, string>,
  ): Directive | undefined {
    const source = sources.get(violation.file);
    if (source === undefined) return undefined;
    const lines = source.split("\n");

    // File scope: a header directive covers everything below it.
    for (let i = 0; i < Math.min(FILE_HEADER_LINES, lines.length); i++) {
      const directive = parseDirective(lines[i] ?? "");
      if (directive?.fileScoped === true && matchesRule(violation.ruleId, directive.ruleIds)) {
        return directive;
      }
    }

    // Line scope: the violation's own line, or the line immediately above it.
    // Accepting the line above is what makes the directive usable at all — most
    // violations sit on a line with no room left for a trailing comment.
    for (const index of [violation.line - 1, violation.line - 2]) {
      if (index < 0 || index >= lines.length) continue;
      const directive = parseDirective(lines[index] ?? "");
      if (directive?.fileScoped === false && matchesRule(violation.ruleId, directive.ruleIds)) {
        return directive;
      }
    }

    return undefined;
  }

  describeRules(): RuleInfo[] {
    return [{
      id: "suppression:missing-reason",
      category: this.ruleIdPrefix,
      description: "A chisel-ignore comment gave no reason, so it suppressed nothing.",
      fixGuidance: "Write `chisel-ignore <rule-id> -- <why this case is different>`. "
        + "A suppression nobody has to justify is one nobody will revisit.",
    }];
  }
}

function parseDirective(line: string): Directive | undefined {
  const match = IGNORE_RE.exec(line);
  if (match === null) return undefined;

  const raw = match[3] ?? "";
  // Strip a trailing `-->` so the directive reads naturally inside markup.
  const reason = raw.replace(/--+>\s*$/, "").trim();

  return {
    fileScoped: match[1] === "-file",
    ruleIds: (match[2] ?? "").split(",").map(r => r.trim()).filter(r => r !== ""),
    reason,
  };
}

/** Exact id, or a category prefix ending at a `:` boundary. */
function matchesRule(ruleId: string, patterns: readonly string[]): boolean {
  return patterns.some(p => ruleId === p || ruleId.startsWith(`${p}:`));
}
