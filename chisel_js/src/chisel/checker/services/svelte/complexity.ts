import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

export class ComplexityService {
  readonly ruleIdPrefix = "complexity";

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!file.source) continue;
      violations.push(...this._checkLoc(file));
    }
    return violations;
  }

  private _checkLoc(file: { path: string; source: string; layer: string }) {
    const violations: Violation[] = [];
    const lines = file.source.split("\n");
    const loc = lines.filter(l => l.trim() && !l.trim().startsWith("//")).length;

    if (file.path.endsWith("+page.svelte")) {
      if (loc > 100) {
        violations.push(createViolation({
          file: file.path, line: 1, severity: Severity.ERROR,
          ruleId: "complexity:page-loc-limit",
          message: `+page.svelte exceeds 100 lines of code (found ${loc}). Extract sections into components/domain/.`,
        }));
      } else if (loc > 80) {
        violations.push(createViolation({
          file: file.path, line: 1, severity: Severity.WARNING,
          ruleId: "complexity:page-loc-warning",
          message: `+page.svelte exceeds 80 lines of code (found ${loc}). Consider extracting sections into components/domain/.`,
        }));
      }
    }

    if (file.path.includes("controllers/") && file.path.endsWith(".ts")) {
      const methodMatches = file.source.matchAll(/(?:async\s+)?\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/g);
      for (const m of methodMatches) {
        const startLine = file.source.substring(0, m.index!).split("\n").length;
        let braceCount = 0;
        let endLine = startLine;
        let started = false;
        const remaining = file.source.substring(m.index!);
        for (let j = 0; j < remaining.length; j++) {
          if (remaining[j] === '{') { braceCount++; started = true; }
          if (remaining[j] === '}') {
            braceCount--;
            if (started && braceCount === 0) {
              endLine = file.source.substring(0, m.index! + j).split("\n").length;
              break;
            }
          }
        }
        const methodLoc = endLine - startLine + 1;
        if (methodLoc > 40) {
          violations.push(createViolation({
            file: file.path, line: startLine, severity: Severity.ERROR,
            ruleId: "complexity:controller-loc-limit",
            message: `Controller method exceeds 40 lines of code (found ${methodLoc}). Extract business logic into a service.`,
          }));
        }
      }
    }

    if ((file.path.endsWith("+page.server.ts") || file.path.endsWith("+layout.server.ts"))) {
      const funcMatches = file.source.matchAll(/(?:export\s+(?:async\s+)?function\s+(load|actions))\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/g);
      for (const m of funcMatches) {
        const startLine = file.source.substring(0, m.index!).split("\n").length;
        let braceCount = 0;
        let endLine = startLine;
        let started = false;
        const remaining = file.source.substring(m.index!);
        for (let j = 0; j < remaining.length; j++) {
          if (remaining[j] === '{') { braceCount++; started = true; }
          if (remaining[j] === '}') {
            braceCount--;
            if (started && braceCount === 0) {
              endLine = file.source.substring(0, m.index! + j).split("\n").length;
              break;
            }
          }
        }
        const funcLoc = endLine - startLine + 1;
        if (funcLoc > 20) {
          violations.push(createViolation({
            file: file.path, line: startLine, severity: Severity.ERROR,
            ruleId: "complexity:loader-loc-limit",
            message: `Loader/action exceeds 20 lines of code (found ${funcLoc}). Move logic into a controller or service.`,
          }));
        }
      }
    }

    return violations;
  }

  describeRules() {
    return [
      { id: "complexity:page-loc-limit", category: "complexity",
        description: "+page.svelte exceeds 100 LoC", fixGuidance: "Extract logical sections into components/domain/." },
      { id: "complexity:page-loc-warning", category: "complexity",
        description: "+page.svelte exceeds 80 LoC", fixGuidance: "Consider extracting sections into components/domain/." },
      { id: "complexity:controller-loc-limit", category: "complexity",
        description: "Controller method exceeds 40 LoC", fixGuidance: "Extract business logic into a service. Controllers orchestrate — services do the work." },
      { id: "complexity:loader-loc-limit", category: "complexity",
        description: "Loader or form action exceeds 20 LoC", fixGuidance: "Move logic into a controller or service. Loaders parse input, call factory, return output." },
    ];
  }
}
