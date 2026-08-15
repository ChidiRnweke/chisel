import ts from "typescript";
import fastGlob from "fast-glob";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { RuleInfo } from "chisel/checker/rule_metadata";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

/** Test-runner configurations whose `include` globs name the suite. */
const RUNNER_CONFIGS: readonly string[] = [
  "vitest.config.ts",
  "vitest.config.js",
  "vitest.config.mts",
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mts",
];

/**
 * Backtick-quoted repo-relative paths in prose: `src/lib/server/application.ts`.
 * Only source-ish extensions, so a sentence about `src/` in general is not a
 * reference that can rot.
 */
const DOC_PATH_RE = /`((?:src|tests|scripts)\/[A-Za-z0-9_@./+()[\]-]+\.(?:ts|js|svelte|md|json|py))`/g;

/** Directories whose markdown is generated or vendored, and so not maintained. */
const UNMAINTAINED_DIR_RE = /(?:^|\/)(?:node_modules|dist|build|\.astro|\.svelte-kit|coverage)(?:\/|$)|-generated(?:\/|$)/;

/**
 * Checks that configuration and documentation still describe the tree.
 *
 * These read the filesystem directly rather than `ProjectInfo.files`, which
 * holds only `.ts`/`.js`/`.svelte`. `ProjectStructureService` does the same for
 * `package.json` and `.env`.
 */
export class CoherenceService {
  readonly ruleIdPrefix = "coherence";

  check(project: ProjectInfo): Violation[] {
    return [
      ...this._checkTestGlobs(project),
      ...this._checkDocPaths(project),
    ];
  }

  /**
   * Every `include` glob in the test-runner config must match a file.
   *
   * This is the "ran zero tests and passed" failure: a renamed directory or a
   * typo silently removes part of the suite while CI stays green. Nothing else
   * in the checker can see it, because the missing tests leave no trace.
   */
  private _checkTestGlobs(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];

    for (const name of RUNNER_CONFIGS) {
      const path = join(project.rootPath, name);
      if (!existsSync(path)) continue;

      let source: string;
      try {
        source = readFileSync(path, "utf-8");
      } catch {
        continue;
      }

      const sf = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
      for (const { pattern, line } of this._includePatterns(sf)) {
        // A glob naming a literal path is checked as one; both forms appear in
        // real configs, and fast-glob treats a plain path as a pattern anyway.
        const matches = fastGlob.sync(pattern, {
          cwd: project.rootPath,
          onlyFiles: true,
          dot: false,
        });
        if (matches.length > 0) continue;

        violations.push(createViolation({
          file: name,
          line,
          severity: Severity.ERROR,
          ruleId: `${this.ruleIdPrefix}:empty-test-glob`,
          message:
            `The include pattern "${pattern}" matches no files, so the tests it was meant `
            + `to run are silently not running. Fix the pattern, or delete it if those `
            + `tests are gone — a suite that runs nothing still reports success.`,
        }));
      }
    }

    return violations;
  }

  /**
   * Every `include:` property whose value is an array of string literals,
   * anywhere in the config. Nesting is not special-cased: a config with one
   * `test.include` and a config with five entries under `projects` both yield
   * their patterns from the same walk.
   */
  private _includePatterns(sf: ts.SourceFile): Array<{ pattern: string; line: number }> {
    const found: Array<{ pattern: string; line: number }> = [];

    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertyAssignment(node)
        && ts.isIdentifier(node.name)
        && node.name.text === "include"
        && ts.isArrayLiteralExpression(node.initializer)
      ) {
        for (const element of node.initializer.elements) {
          if (!ts.isStringLiteralLike(element)) continue;
          found.push({
            pattern: element.text,
            line: sf.getLineAndCharacterOfPosition(element.getStart(sf)).line + 1,
          });
        }
      }
      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sf, visit);
    return found;
  }

  /**
   * Paths quoted in maintained documentation must exist.
   *
   * Docs rot fastest at their most useful sentence — "the implementation is in
   * `<path>`". A stale reference actively misleads whoever follows it, and an
   * agent reading the docs has no way to tell.
   */
  private _checkDocPaths(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];

    for (const document of this._maintainedDocuments(project.rootPath)) {
      let source: string;
      try {
        source = readFileSync(join(project.rootPath, document), "utf-8");
      } catch {
        continue;
      }

      for (const match of source.matchAll(DOC_PATH_RE)) {
        const referenced = match[1]!;
        if (existsSync(join(project.rootPath, referenced))) continue;

        violations.push(createViolation({
          file: document,
          line: source.slice(0, match.index).split("\n").length,
          severity: Severity.ERROR,
          ruleId: `${this.ruleIdPrefix}:broken-doc-path`,
          message:
            `${document} points at ${referenced}, which does not exist. Update the `
            + `reference or drop it — a wrong path in architecture documentation is worse `
            + `than no path, because the reader follows it.`,
        }));
      }
    }

    return violations;
  }

  /**
   * Hand-written markdown: the repo root and one level of `docs/`. Generated
   * API references and build output are excluded — nobody maintains those by
   * hand, and their paths are correct by construction or not at all.
   */
  private _maintainedDocuments(rootPath: string): string[] {
    const documents: string[] = [];

    const collect = (relativeDir: string): void => {
      const absolute = relativeDir === "" ? rootPath : join(rootPath, relativeDir);
      if (!existsSync(absolute)) return;
      if (UNMAINTAINED_DIR_RE.test(relativeDir)) return;

      let entries;
      try {
        entries = readdirSync(absolute, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith(".md")) continue;
        documents.push(relativeDir === "" ? entry.name : `${relativeDir}/${entry.name}`);
      }
    };

    collect("");
    collect("docs");
    return documents;
  }

  describeRules(): RuleInfo[] {
    return [
      {
        id: "coherence:empty-test-glob",
        category: this.ruleIdPrefix,
        description: "A test-runner include pattern matches no files",
        fixGuidance:
          "Fix the pattern or delete it. A glob matching nothing means part of the suite "
          + "stopped running and CI stayed green — the one failure mode the test suite "
          + "cannot report itself.",
      },
      {
        id: "coherence:broken-doc-path",
        category: this.ruleIdPrefix,
        description: "Maintained documentation cites a path that does not exist",
        fixGuidance:
          "Update the reference or remove it. Checked in root and docs/ markdown; "
          + "generated API references and build output are excluded.",
      },
    ];
  }
}
