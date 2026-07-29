import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";
import { Layer } from "chisel/checker/models/layer";
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

  /**
   * Every service should have a test somewhere.
   *
   * Counts colocated specs. The previous version built its candidate set from
   * files under `tests/` only, so a project that puts `management.spec.ts`
   * beside `management.ts` — the SvelteKit default — had every service
   * reported as untested. Interface-only modules are skipped: there is nothing
   * to test in a type.
   */
  private _checkStructuralCoverage(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];

    const isSpec = (path: string) => /\.(spec|test)\.(ts|js)$/.test(path);
    const stem = (path: string) =>
      path.split("/").pop()?.replace(/\.(spec|test)?\.?(ts|js)$/, "") ?? "";

    const tested = new Set(
      project.files.filter(f => isSpec(f.path)).map(f => stem(f.path)),
    );

    const services = project.files.filter(f =>
      f.layer === Layer.SERVICES
      && !isSpec(f.path)
      && !f.path.endsWith("contracts.ts")
      && !f.path.endsWith("index.ts")
      && !f.path.endsWith(".d.ts"),
    );

    for (const service of services) {
      const name = stem(service.path);
      if (tested.has(name)) continue;
      violations.push(createViolation({
        file: service.path,
        line: 1,
        severity: Severity.ERROR,
        ruleId: "project-structure:missing-test-coverage",
        message: `Service "${name}" has no test. Add ${name}.spec.ts beside it, or a test `
          + `under tests/unit/.`,
      }));
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
