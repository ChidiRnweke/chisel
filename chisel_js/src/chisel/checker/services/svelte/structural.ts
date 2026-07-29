import type { FileInfo } from "chisel/checker/models/file_info";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Layer } from "chisel/checker/models/layer";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";
import { scriptsOf } from "chisel/checker/repositories/file_parser";
import ts from "typescript";

/**
 * Structural rules that earn their place.
 *
 * The `$effect` / `onMount` / `writable` / timers / raw-fetch family used to
 * live here and has been removed. Those encoded a position on how to write
 * Svelte reactivity — not on layering, not on the design system — and produced
 * 107 findings on a real app, most of them arguing with working code. chisel's
 * opinion is the architecture and the design system; Svelte idiom is the
 * compiler's business.
 *
 * What remains is either design-system enforcement (no CSS outside Tailwind) or
 * a property of a layer (a factory decides nothing, hooks set only locals.user).
 */
export class StructuralSvelteService {
  readonly ruleIdPrefix = "structural";

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (file.source === "") continue;
      // Tests keep their own test-structure rules.
      if (file.layer === Layer.TESTS) continue;
      violations.push(...this._checkFile(file));
    }
    return violations;
  }

  describeRules() {
    return [
      {
        id: "structural:inline-style-banned",
        category: "structural",
        description: "inline style= attribute in .svelte",
        fixGuidance: "Use Tailwind utility classes defined in app.css. Styling comes from "
          + "the design system, not from the element.",
      },
      {
        id: "structural:style-block-banned",
        category: "structural",
        description: "<style> block in .svelte",
        fixGuidance: "Remove the <style> block and express the styles as Tailwind utility "
          + "classes.",
      },
      {
        id: "structural:missing-service-interface",
        category: "structural",
        description: "Concrete service without a matching I<ServiceName> interface",
        fixGuidance: "Declare an I<ServiceName> interface in the same file. Controllers "
          + "depend on the interface and the factory supplies the implementation. It has to "
          + "be the same file — a sibling contracts.ts is a same-layer import, which the "
          + "boundary rules ban.",
      },
      {
        id: "structural:factory-contains-logic",
        category: "structural",
        description: "A factory contains branching or looping",
        fixGuidance: "A factory wires concrete implementations together and decides "
          + "nothing — no if, for, while, switch, try or ternary. Instance methods are "
          + "fine: holding injected collaborators is what a factory is for.",
      },
      {
        id: "structural:hooks-locals-limited",
        category: "structural",
        description: "hooks.server.ts sets a local other than locals.user",
        fixGuidance: "hooks.server.ts attaches the authenticated user and nothing else. "
          + "Route guards and data fetching belong in a loader.",
      },
    ];
  }

  private _checkFile(file: FileInfo): Violation[] {
    return [
      ...this._checkInlineStyle(file),
      ...this._checkStyleBlock(file),
      ...this._checkServiceInterface(file),
      ...this._checkFactoryLogic(file),
      ...this._checkHooksServer(file),
    ];
  }

  private _checkInlineStyle(file: FileInfo): Violation[] {
    const violations: Violation[] = [];
    if (!file.path.endsWith(".svelte")) return violations;
    if (file.path.includes("components/ui/")) return violations;

    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!/style=/.test(lines[i]!)) continue;
      violations.push(createViolation({
        file: file.path,
        line: i + 1,
        severity: Severity.ERROR,
        ruleId: "structural:inline-style-banned",
        message: "inline style= is banned outside components/ui/. Use Tailwind classes so "
          + "the value comes from the design system rather than the element.",
      }));
    }
    return violations;
  }

  private _checkStyleBlock(file: FileInfo): Violation[] {
    if (!file.path.endsWith(".svelte")) return [];
    if (file.ast?.hasStyleBlock !== true) return [];

    return [createViolation({
      file: file.path,
      line: 1,
      severity: Severity.ERROR,
      ruleId: "structural:style-block-banned",
      message: "<style> blocks are banned in .svelte files. Express the styles as Tailwind "
        + "utility classes defined in app.css.",
    })];
  }

  /** A concrete `*Service` class needs an interface for the factory to inject. */
  private _checkServiceInterface(file: FileInfo): Violation[] {
    const violations: Violation[] = [];
    if (file.layer !== Layer.SERVICES) return violations;

    for (const { sf, offset } of scriptsOf(file.ast)) {
      const interfaces = new Set(
        sf.statements.filter(ts.isInterfaceDeclaration).map(s => s.name.text),
      );

      for (const statement of sf.statements) {
        if (!ts.isClassDeclaration(statement) || statement.name === undefined) continue;
        const name = statement.name.text;
        if (!name.endsWith("Service")) continue;
        if (interfaces.has(`I${name}`)) continue;

        violations.push(createViolation({
          file: file.path,
          line: lineOf(file.source, offset + statement.getStart(sf)),
          severity: Severity.ERROR,
          ruleId: "structural:missing-service-interface",
          message: `Service "${name}" has no I${name} interface in this file. Controllers `
            + `depend on the interface; the factory supplies the implementation.`,
        }));
      }
    }

    return violations;
  }

  /**
   * A factory wires implementations together and decides nothing.
   *
   * Replaces `factory-static-only`, which required every factory method to be
   * `static`. That was the wrong property: a factory holding injected
   * collaborators and exposing `notes()` is standard DI, and `chisel_py`'s own
   * `CheckerFactory` is a dataclass with an instance method. What actually
   * matters is the absence of logic.
   */
  private _checkFactoryLogic(file: FileInfo): Violation[] {
    const violations: Violation[] = [];
    if (file.layer !== Layer.FACTORY) return violations;

    for (const { sf, offset } of scriptsOf(file.ast)) {
      const visit = (node: ts.Node): void => {
        if (isBranchOrLoop(node)) {
          violations.push(createViolation({
            file: file.path,
            line: lineOf(file.source, offset + node.getStart(sf)),
            severity: Severity.ERROR,
            ruleId: "structural:factory-contains-logic",
            message: `A factory contains no logic — found ${describeNode(node)}. Wire the `
              + `dependencies here and let the layer that owns the decision make it.`,
          }));
        }
        ts.forEachChild(node, visit);
      };
      ts.forEachChild(sf, visit);
    }

    return violations;
  }

  private _checkHooksServer(file: FileInfo): Violation[] {
    const violations: Violation[] = [];
    if (!file.path.endsWith("hooks.server.ts")) return violations;

    for (const { sf, offset } of scriptsOf(file.ast)) {
      const visit = (node: ts.Node): void => {
        // Matched as an assignment node. The old `event\.locals\.(\w+)\s*=`
        // regex also matched `===`, so a comparison was reported as a write.
        if (ts.isBinaryExpression(node)
          && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
          && ts.isPropertyAccessExpression(node.left)
          && ts.isPropertyAccessExpression(node.left.expression)
          && node.left.expression.name.text === "locals") {
          const name = node.left.name.text;
          if (name !== "user") {
            violations.push(createViolation({
              file: file.path,
              line: lineOf(file.source, offset + node.getStart(sf)),
              severity: Severity.ERROR,
              ruleId: "structural:hooks-locals-limited",
              message: `hooks.server.ts sets locals.${name}. Only locals.user is permitted `
                + `— move the rest into a loader or a service.`,
            }));
          }
        }
        ts.forEachChild(node, visit);
      };
      ts.forEachChild(sf, visit);
    }

    return violations;
  }
}

function isBranchOrLoop(node: ts.Node): boolean {
  return ts.isIfStatement(node)
    || ts.isForStatement(node)
    || ts.isForOfStatement(node)
    || ts.isForInStatement(node)
    || ts.isWhileStatement(node)
    || ts.isDoStatement(node)
    || ts.isSwitchStatement(node)
    || ts.isTryStatement(node)
    || ts.isConditionalExpression(node);
}

function describeNode(node: ts.Node): string {
  if (ts.isIfStatement(node)) return "an if statement";
  if (ts.isSwitchStatement(node)) return "a switch statement";
  if (ts.isTryStatement(node)) return "a try block";
  if (ts.isConditionalExpression(node)) return "a ternary";
  return "a loop";
}

function lineOf(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}
