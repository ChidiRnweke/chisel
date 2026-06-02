import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export class ProjectStructureService {
  readonly ruleIdPrefix = "project-structure";

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    violations.push(...this._checkPackageManager(project));
    violations.push(...this._checkEnvFiles(project));
    violations.push(...this._checkStructuralCoverage(project));
    return violations;
  }

  private _checkPackageManager(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    const lockPath = join(project.rootPath, "pnpm-lock.yaml");
    if (existsSync(join(project.rootPath, "package-lock.json"))) {
      violations.push(createViolation({
        file: "package-lock.json", line: 1, severity: Severity.ERROR,
        ruleId: "project-structure:wrong-package-manager",
        message: "npm is banned. Frontend must use pnpm exclusively.",
      }));
    }
    if (existsSync(join(project.rootPath, "yarn.lock"))) {
      violations.push(createViolation({
        file: "yarn.lock", line: 1, severity: Severity.ERROR,
        ruleId: "project-structure:wrong-package-manager",
        message: "yarn is banned. Frontend must use pnpm exclusively.",
      }));
    }
    return violations;
  }

  private _checkEnvFiles(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    const envPath = join(project.rootPath, ".env");
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, "utf-8");
        const backendVars = ["DATABASE_URL", "POSTGRES_", "REDIS_URL"];
        for (const v of backendVars) {
          if (content.includes(v)) {
            violations.push(createViolation({
              file: ".env", line: 1, severity: Severity.ERROR,
              ruleId: "project-structure:backend-env-in-frontend",
              message: `.env must not contain backend infrastructure variables (${v}). Keep frontend/.env and backend/.env separate.`,
            }));
            break;
          }
        }
      } catch {}
    }
    return violations;
  }

  private _checkStructuralCoverage(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    const serviceFiles = project.files.filter(f => f.path.includes("services/") && !f.path.includes("protocols") && !f.path.startsWith("tests/") && !f.path.startsWith("src/chisel/"));
    const testFiles = new Set(project.files.filter(f => f.path.includes("tests/")).map(f => f.path));
    for (const sf of serviceFiles) {
      const name = sf.path.split("/").pop()?.replace(/\.(ts|js)$/, "") ?? "";
      const testPath = `tests/unit/services/${name}.test.ts`;
      if (![...testFiles].some(t => t.endsWith(`${name}.test.ts`) || t.endsWith(`${name}.spec.ts`))) {
        violations.push(createViolation({
          file: sf.path, line: 1, severity: Severity.ERROR,
          ruleId: "project-structure:missing-test-coverage",
          message: `Service "${name}" has no corresponding test file. Add tests/unit/services/${name}.test.ts.`,
        }));
      }
    }
    return violations;
  }

  describeRules() {
    return [
      { id: "project-structure:wrong-package-manager", category: "project-structure",
        description: "npm or yarn lockfile found instead of pnpm", fixGuidance: "Use pnpm exclusively for the frontend." },
      { id: "project-structure:backend-env-in-frontend", category: "project-structure",
        description: "Backend infrastructure variables in frontend .env", fixGuidance: "Keep frontend/.env and backend/.env separate. Never share secrets." },
      { id: "project-structure:missing-test-coverage", category: "project-structure",
        description: "Service has no test file", fixGuidance: "Add a test file under tests/unit/ covering its core invariants." },
    ];
  }
}
