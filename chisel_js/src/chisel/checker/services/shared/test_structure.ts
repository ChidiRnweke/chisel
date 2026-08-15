import ts from "typescript";
import type { FileInfo } from "chisel/checker/models/file_info";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { RuleInfo } from "chisel/checker/rule_metadata";
import type { Violation } from "chisel/checker/models/violation";
import { Layer } from "chisel/checker/models/layer";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";
import { scriptsOf } from "chisel/checker/repositories/file_parser";

/** Mocking entry points, by the call name the AST reports. */
const MOCKING_CALL_RE = /^(?:vi|jest)\.(?:mock|doMock|unmock|fn|spyOn)$|^sinon\.|^spyOn$/;

/** `expect(...).toHaveBeenCalled()` and its family — assertions about wiring. */
const INTERACTION_MATCHER_RE = /^toHaveBeenCalled|^toHaveBeenNthCalledWith$|^toHaveBeenLastCalledWith$/;

/** A class named like a test double: it stands in for something real. */
const TEST_DOUBLE_NAME_RE = /^(?:Fake|Stub|InMemory)/;

const TEST_FILE_RE = /(?:^|\/)test_[^/]*\.(?:ts|js)$|\.(?:test|spec)\.(?:ts|js)$/;

/** Directories under `tests/` that name what kind of test lives there. */
const TEST_ROOTS = ["tests/unit/", "tests/integration/", "tests/e2e/"];

/**
 * The shortest string that can carry a real explanation. Below this it is a
 * label ("wip", "todo"), which is the debt the rule exists to make visible.
 */
const MIN_REASON_LENGTH = 12;

function lineOf(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

/**
 * The dotted name of a call target: `vi.mock`, `test.skip`, `expect`.
 * Returns undefined for anything not built from identifiers, such as
 * `getRunner().mock()` — those are not what the naming conventions describe.
 */
function callName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (!ts.isPropertyAccessExpression(expression)) return undefined;
  const target = callName(expression.expression);
  if (target === undefined) return undefined;
  return `${target}.${expression.name.text}`;
}

/** `test`, `it`, and their `.only` / `.each` / `.concurrent` variants. */
function isTestDeclaration(name: string | undefined): boolean {
  return name !== undefined && /^(?:test|it)(?:\.(?:only|each|concurrent|sequential|failing))*$/.test(name);
}

function isSkipDeclaration(name: string | undefined): boolean {
  return name !== undefined && /^(?:test|it|describe)(?:\.(?:each|concurrent))*\.skip$/.test(name);
}

function isAssertion(name: string | undefined): boolean {
  return name === "expect" || name === "expect.element" || name === "expect.soft";
}

function callbackOf(node: ts.CallExpression): ts.ArrowFunction | ts.FunctionExpression | undefined {
  return node.arguments.find(
    (argument): argument is ts.ArrowFunction | ts.FunctionExpression =>
      ts.isArrowFunction(argument) || ts.isFunctionExpression(argument),
  );
}

/**
 * Rules about the test suite itself.
 *
 * These read the AST rather than the source text. The regex version this
 * replaced terminated a test body at the first `}` it found, so any test
 * containing a block — an object literal, a nested arrow — had its assertions
 * counted wrong.
 *
 * Scope is `Layer.TESTS`, which covers `tests/`, colocated `*.spec.ts` and
 * `*.test.ts`, `src/evals/`, and fakes shipped under `src/lib/testing/`. The
 * previous scope was "the path contains `tests/`", which silently skipped every
 * colocated spec — on a real app that was 227 of 240 test files.
 */
export class TestStructureService {
  readonly ruleIdPrefix = "test-structure";

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (file.layer !== Layer.TESTS) continue;
      if (file.source === "") continue;
      violations.push(...this._checkTestLocation(file));
      violations.push(...this._checkAst(file));
    }
    return violations;
  }

  /**
   * A test file lives beside the code it covers, or in a `tests/` directory
   * that names its kind. Both are coherent conventions; a spec in `scripts/`
   * is neither.
   */
  private _checkTestLocation(file: FileInfo): Violation[] {
    if (!TEST_FILE_RE.test(file.path)) return [];

    const colocated = file.path.startsWith("src/");
    const inTestRoot = TEST_ROOTS.some(root => file.path.startsWith(root));
    if (colocated || inTestRoot) return [];

    return [createViolation({
      file: file.path,
      line: 1,
      severity: Severity.ERROR,
      ruleId: `${this.ruleIdPrefix}:test-file-location`,
      message:
        "A test belongs beside the file it covers (foo.spec.ts next to foo.ts) or "
        + "under tests/unit/, tests/integration/ or tests/e2e/. Anywhere else and "
        + "nobody can tell what kind of test it is, or what it covers.",
    })];
  }

  /** Whether a test name describes an invariant rather than restating a symbol. */
  private _namesAnInvariant(name: string): boolean {
    return name.includes(" ") || name.split(/(?=[A-Z])/).length >= 3;
  }

  /** One walk of the file, collecting every AST-based finding. */
  private _checkAst(file: FileInfo): Violation[] {
    const violations: Violation[] = [];
    // End-to-end specs drive a whole flow; asserting once per step is the point
    // of them, so the assertion count rule does not apply.
    const isEndToEnd = file.path.includes("tests/e2e/") || /\.e2e\.(?:ts|js)$/.test(file.path);

    for (const { sf, offset } of scriptsOf(file.ast)) {
      const at = (node: ts.Node): number => lineOf(file.source, offset + node.getStart(sf));

      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const name = callName(node.expression);

          if (name !== undefined && MOCKING_CALL_RE.test(name)) {
            violations.push(createViolation({
              file: file.path,
              line: at(node),
              severity: Severity.ERROR,
              ruleId: `${this.ruleIdPrefix}:mocking-banned`,
              message:
                `${name}() is a mocking library. Write a fake that implements the same `
                + "interface as the real dependency. A mock that cannot be constructed "
                + "directly is telling you the wiring is wrong, not that you need a mock.",
            }));
          }

          if (isSkipDeclaration(name) && !this._hasExplanation(node, sf)) {
            violations.push(createViolation({
              file: file.path,
              line: at(node),
              severity: Severity.ERROR,
              ruleId: `${this.ruleIdPrefix}:skip-without-reason`,
              message:
                "A skipped test must say why, and when it should come back. Pass an "
                + "explanation — test.skip(condition, 'the dev database must seed two "
                + "notes') — or put one in a comment above it. A bare skip is invisible debt.",
            }));
          }

          if (isTestDeclaration(name)) {
            const [first] = node.arguments;
            if (
              first !== undefined
              && ts.isStringLiteralLike(first)
              && !this._namesAnInvariant(first.text)
            ) {
              violations.push(createViolation({
                file: file.path,
                line: at(node),
                severity: Severity.ERROR,
                ruleId: `${this.ruleIdPrefix}:test-naming`,
                message:
                  `Test name "${first.text}" does not describe an invariant. Name it after `
                  + "what must hold — returns_Y_when_Z — so a failure says what broke "
                  + "without opening the file.",
              }));
            }
          }

          if (!isEndToEnd && isTestDeclaration(name)) {
            const body = callbackOf(node);
            if (body !== undefined) {
              const count = this._countAssertions(body.body);
              if (count > 1) {
                violations.push(createViolation({
                  file: file.path,
                  line: at(node),
                  severity: Severity.ERROR,
                  ruleId: `${this.ruleIdPrefix}:one-assert-per-test`,
                  message:
                    `This test makes ${count} assertions. Split it, one invariant each: a `
                    + "multi-assertion test fails at the first wrong line and hides the "
                    + "rest, and its name can no longer say what broke.",
                }));
              }
            }
          }
        }

        if (ts.isPropertyAccessExpression(node) && INTERACTION_MATCHER_RE.test(node.name.text)) {
          violations.push(createViolation({
            file: file.path,
            line: at(node),
            severity: Severity.ERROR,
            ruleId: `${this.ruleIdPrefix}:interaction-assertion`,
            message:
              `.${node.name.text}() asserts on wiring, not behaviour. Refactor the internals `
              + "without changing what the code does and this test still breaks. Assert on "
              + "the returned value or the resulting state instead.",
          }));
        }

        if (this._isUnknownCast(node)) {
          violations.push(createViolation({
            file: file.path,
            line: at(node),
            severity: Severity.ERROR,
            ruleId: `${this.ruleIdPrefix}:unsafe-dependency-cast`,
            message:
              "`as unknown as T` exists to silence the type error that was telling you the "
              + "fake does not match the interface. Complete the fake, or narrow the "
              + "interface the code under test actually depends on.",
          }));
        }

        if (
          ts.isClassDeclaration(node)
          && node.name !== undefined
          && TEST_DOUBLE_NAME_RE.test(node.name.text)
          && (node.heritageClauses ?? []).length === 0
        ) {
          violations.push(createViolation({
            file: file.path,
            line: at(node),
            severity: Severity.ERROR,
            ruleId: `${this.ruleIdPrefix}:untyped-fake`,
            message:
              `${node.name.text} stands in for a real dependency but declares no interface. `
              + "Add `implements <Interface>` so the type checker is what tells you the fake "
              + "has gone stale, rather than a production path failing later.",
          }));
        }

        ts.forEachChild(node, visit);
      };

      ts.forEachChild(sf, visit);
    }

    return violations;
  }

  /** `x as unknown as T` — an `as` whose operand is itself an `as unknown`. */
  private _isUnknownCast(node: ts.Node): boolean {
    if (!ts.isAsExpression(node)) return false;
    const inner = node.expression;
    return ts.isAsExpression(inner) && inner.type.kind === ts.SyntaxKind.UnknownKeyword;
  }

  /**
   * Assertions directly inside one test body. Nested `test(...)` declarations
   * keep their own count, so the walk stops at them rather than blaming the
   * outer test for their assertions.
   */
  private _countAssertions(body: ts.Node): number {
    let found = 0;
    const walk = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const name = callName(node.expression);
        if (isTestDeclaration(name)) return;
        if (isAssertion(name)) found += 1;
      }
      ts.forEachChild(node, walk);
    };
    walk(body);
    return found;
  }

  /**
   * Whether a skip carries a reason: an explanatory string argument, or a
   * comment above the statement. `test.skip('name', fn)` has no reason slot in
   * every runner, so a comment is often the only place to put one.
   */
  private _hasExplanation(node: ts.CallExpression, sf: ts.SourceFile): boolean {
    // The first argument is the test's name in every runner, and a descriptive
    // name is not a reason for skipping. Only a later string can be one, as in
    // `test.skip(condition, 'why')`.
    for (const argument of node.arguments.slice(1)) {
      if (!ts.isStringLiteralLike(argument)) continue;
      if (argument.text.trim().length >= MIN_REASON_LENGTH) return true;
    }

    const statement = this._enclosingStatement(node);
    if (statement === undefined) return false;
    const comments = ts.getLeadingCommentRanges(sf.getFullText(), statement.getFullStart()) ?? [];
    return comments.some(range => {
      const text = sf.getFullText().slice(range.pos, range.end);
      return text.replace(/^[/*\s]+|[*/\s]+$/g, "").length >= MIN_REASON_LENGTH;
    });
  }

  private _enclosingStatement(node: ts.Node): ts.Node | undefined {
    let current: ts.Node | undefined = node;
    while (current !== undefined && !ts.isStatement(current)) current = current.parent;
    return current;
  }

  describeRules(): RuleInfo[] {
    return [
      {
        id: "test-structure:test-file-location",
        category: this.ruleIdPrefix,
        description: "Test file neither colocated with its subject nor under a tests/ root",
        fixGuidance:
          "Put foo.spec.ts beside foo.ts, or move it under tests/unit/, tests/integration/ "
          + "or tests/e2e/ so its kind is visible from its path.",
      },
      {
        id: "test-structure:test-naming",
        category: this.ruleIdPrefix,
        description: "Test name does not describe an invariant",
        fixGuidance:
          "Name the test after the invariant it proves: test_cannot_X, test_returns_Y_when_Z. "
          + "When it fails, the name alone should say what broke.",
      },
      {
        id: "test-structure:one-assert-per-test",
        category: this.ruleIdPrefix,
        description: "More than one assertion in a test",
        fixGuidance:
          "Split into separate tests, one per assertion, each named after its invariant. "
          + "End-to-end specs are exempt.",
      },
      {
        id: "test-structure:mocking-banned",
        category: this.ruleIdPrefix,
        description: "Mocking library usage (vi.mock, jest.fn, spyOn, sinon)",
        fixGuidance:
          "Write a fake that implements the full interface. In a layered architecture with "
          + "injected dependencies you can always construct the real object; needing a mock "
          + "is a signal the wiring is wrong.",
      },
      {
        id: "test-structure:skip-without-reason",
        category: this.ruleIdPrefix,
        description: "test.skip without an explanation",
        fixGuidance:
          "Pass a reason string, or put one in a comment above the skip: what blocks it and "
          + "when it comes back. A bare skip is debt nobody can see.",
      },
      {
        id: "test-structure:untyped-fake",
        category: this.ruleIdPrefix,
        description: "A Fake*/Stub*/InMemory* class declares no interface",
        fixGuidance:
          "Add `implements <Interface>`. Without it the fake drifts from the real contract "
          + "silently, and the first thing to notice is a production path.",
      },
      {
        id: "test-structure:unsafe-dependency-cast",
        category: this.ruleIdPrefix,
        description: "`as unknown as T` in a test",
        fixGuidance:
          "The cast is silencing the error that says the fake does not match the interface. "
          + "Complete the fake, or narrow the interface the code under test depends on.",
      },
      {
        id: "test-structure:interaction-assertion",
        category: this.ruleIdPrefix,
        description: "Assertion on calls (toHaveBeenCalled and friends)",
        fixGuidance:
          "Assert on output or resulting state. Interaction assertions pin the internals, so "
          + "a behaviour-preserving refactor breaks the test for no reason.",
      },
    ];
  }
}
