import type { FileInfo } from "chisel/checker/models/file_info";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Layer } from "chisel/checker/models/layer";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";
import { scriptsOf, walkMarkup } from "chisel/checker/repositories/file_parser";
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
 * a property of a layer (hooks set only locals.user). Whether a factory executes
 * work is a semantic question, answered by `architecture:factory-workflow`.
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
        description: "An inline style attribute or style: directive in .svelte",
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
        description: "Public service class without an explicitly implemented capability interface",
        fixGuidance: "Declare a narrow capability interface beside the service and write "
          + "`implements` on the class. Controllers depend on that interface and the factory "
          + "supplies the implementation. It has to be the same file — a sibling "
          + "contracts.ts is a same-layer import, which the boundary rules ban.",
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
      ...this._checkHooksServer(file),
    ];
  }

  /**
   * A `style` attribute or a `style:` directive on an element, reported at the
   * element's opening line so one comment above the element can excuse it.
   */
  private _checkInlineStyle(file: FileInfo): Violation[] {
    const violations: Violation[] = [];
    if (!file.path.endsWith(".svelte")) return violations;
    if (file.path.includes("components/ui/")) return violations;
    const fragment = file.ast?.fragment;
    if (fragment === undefined) return violations;

    walkMarkup(fragment, (node: any) => {
      if (node.type !== "RegularElement" && node.type !== "SvelteElement") return;
      const styled = (node.attributes ?? []).some((attribute: any) =>
        (attribute.type === "Attribute" && attribute.name === "style")
        || attribute.type === "StyleDirective");
      if (!styled) return;
      violations.push(createViolation({
        file: file.path,
        line: lineOf(file.source, node.start),
        severity: Severity.ERROR,
        ruleId: "structural:inline-style-banned",
        message: "An inline style is banned outside components/ui/. Use Tailwind classes so "
          + "the value comes from the design system rather than the element.",
      }));
    });
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

  /**
   * A public service class explicitly implements the capability interfaces it
   * offers, declared beside it.
   *
   * Callers depend on the interface; the factory supplies the class. The class
   * name does not matter: any exported class in the services layer is a public
   * capability, so a naming convention cannot opt it out. Every interface it
   * implements must be declared in the same file — a sibling `contracts.ts` is
   * a same-layer import, which the boundary rules ban.
   */
  private _checkServiceInterface(file: FileInfo): Violation[] {
    const violations: Violation[] = [];
    if (file.layer !== Layer.SERVICES) return violations;

    for (const { sf, offset } of scriptsOf(file.ast)) {
      const interfaces = new Set(
        sf.statements.filter(ts.isInterfaceDeclaration).map(s => s.name.text),
      );

      for (const statement of sf.statements) {
        if (!ts.isClassDeclaration(statement) || statement.name === undefined) continue;
        if (!isExported(statement)) continue;
        const implemented = (statement.heritageClauses ?? [])
          .filter(clause => clause.token === ts.SyntaxKind.ImplementsKeyword)
          .flatMap(clause => [...clause.types]);
        if (implemented.length > 0 && implemented.every(type =>
          ts.isIdentifier(type.expression) && interfaces.has(type.expression.text))) continue;

        violations.push(createViolation({
          file: file.path,
          line: lineOf(file.source, offset + statement.getStart(sf)),
          severity: Severity.ERROR,
          ruleId: "structural:missing-service-interface",
          message: `Service "${statement.name.text}" must explicitly implement capability `
            + `interfaces declared in this file. Controllers depend on those interfaces; `
            + `factories supply the implementation.`,
        }));
      }
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



function lineOf(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

function isExported(node: ts.ClassDeclaration): boolean {
  return node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}
