import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";
import { parse } from "svelte/compiler";
import { walk } from "estree-walker";

export class StructuralSvelteService {
  readonly ruleIdPrefix = "structural";

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!file.source) continue;
      violations.push(...this._checkFile(file));
    }
    return violations;
  }

  describeRules() {
    return [
      {
        id: "structural:console-log-banned",
        category: "structural",
        description: "console.log / console.error / console.warn in committed code",
        fixGuidance:
          "Remove before committing. Use structured logging or your observability tooling instead.",
      },
      {
        id: "structural:timers-banned",
        category: "structural",
        description: "setTimeout/setInterval in .svelte or $lib/",
        fixGuidance:
          "Use a reactive pattern, loader with streaming, or debounce with a derived.",
      },
      {
        id: "structural:inline-style-banned",
        category: "structural",
        description: "inline style= attribute in .svelte",
        fixGuidance:
          "Use Tailwind utility classes defined in app.css.",
      },
      {
        id: "structural:style-block-banned",
        category: "structural",
        description: "<style> block in .svelte",
        fixGuidance:
          "Remove the <style> block and express styles as Tailwind utility classes.",
      },
      {
        id: "structural:app-stores-banned",
        category: "structural",
        description: "import from $app/stores",
        fixGuidance:
          "Use $app/state instead (Svelte 5 API).",
      },
      {
        id: "structural:writable-banned",
        category: "structural",
        description: "writable()/readable() Svelte 4 stores",
        fixGuidance:
          "Use $state runes for reactive state.",
      },
      {
        id: "structural:inline-svg-banned",
        category: "structural",
        description: "Inline <svg> with >2 children",
        fixGuidance:
          "Check Lucide first. Extract to $lib/components/ otherwise.",
      },
      {
        id: "structural:effect-no-cleanup",
        category: "structural",
        description: "$effect without return cleanup",
        fixGuidance:
          "Add return cleanup, or use $derived/onMount instead.",
      },
      {
        id: "structural:onmount-no-browser-api",
        category: "structural",
        description: "onMount without browser API reference",
        fixGuidance:
          "Use $derived for computed state. Only onMount with localStorage/sessionStorage/DOM refs.",
      },
      {
        id: "structural:effect-single-call",
        category: "structural",
        description: "$effect that only calls a single function",
        fixGuidance: "Use onMount instead for single-function calls with no reactive dependencies.",
      },
      {
        id: "structural:effect-present",
        category: "structural",
        description: "$effect usage (warrants review)",
        fixGuidance: "Confirm $effect has a cleanup function and references a browser-only imperative API.",
      },
      {
        id: "structural:raw-fetch",
        category: "structural",
        description: "Raw fetch() in services/",
        fixGuidance: "Use the typed openapi-fetch client from AppFactory in production code.",
      },
      {
        id: "structural:missing-service-interface",
        category: "structural",
        description: "Service without I<ServiceName> interface",
        fixGuidance: "Define an I<ServiceName> TypeScript interface in the same file.",
      },
      {
        id: "structural:factory-static-only",
        category: "structural",
        description: "AppFactory has non-static method",
        fixGuidance: "AppFactory uses static methods only and contains zero business logic.",
      },
      {
        id: "structural:hooks-locals-limited",
        category: "structural",
        description: "hooks.server.ts sets non-user local",
        fixGuidance: "hooks.server.ts sets only locals.user — no other locals, no route guards, no data fetching.",
      },
      {
        id: "structural:store-should-use-derived",
        category: "structural",
        description: "$effect writes $state from data/$props",
        fixGuidance: "Use $derived(by => data.X) instead of $effect to sync data into $state.",
      },
      {
        id: "structural:derived-calls-fetch",
        category: "structural",
        description: "$derived calls fetch() or a service method",
        fixGuidance: "$derived must be a pure computation — move async work to a loader.",
      },
    ];
  }

  private _checkFile(file: { path: string; source: string; layer: string }) {
    const violations: Violation[] = [];
    violations.push(...this._checkConsole(file));
    violations.push(...this._checkTimers(file));
    violations.push(...this._checkInlineStyle(file));
    violations.push(...this._checkSvelteAst(file));
    violations.push(...this._checkAppStoresImport(file));
    violations.push(...this._checkWritableStores(file));
    violations.push(...this._checkInlineSvg(file));
    violations.push(...this._checkOnMount(file));
    violations.push(...this._checkRawFetch(file));
    violations.push(...this._checkServiceInterface(file));
    violations.push(...this._checkAppFactory(file));
    violations.push(...this._checkHooksServer(file));
    return violations;
  }

  private _checkConsole(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/\bconsole\.(log|error|warn)\b/.test(lines[i])) {
        violations.push(
          createViolation({
            file: file.path,
            line: i + 1,
            severity: Severity.ERROR,
            ruleId: "structural:console-log-banned",
            message:
              "console.log / console.error / console.warn is banned in committed code. Remove before committing.",
          })
        );
      }
    }
    return violations;
  }

  private _checkTimers(file: { path: string; source: string; layer: string }) {
    const violations: Violation[] = [];
    if (!file.path.includes("lib") && !file.path.endsWith(".svelte")) return violations;
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/\b(setTimeout|setInterval)\b/.test(lines[i])) {
        violations.push(
          createViolation({
            file: file.path,
            line: i + 1,
            severity: Severity.ERROR,
            ruleId: "structural:timers-banned",
            message:
              "setTimeout/setInterval is banned in .svelte files and $lib/. Use a reactive pattern or loader with streaming.",
          })
        );
      }
    }
    return violations;
  }

  private _checkInlineStyle(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (!file.path.endsWith(".svelte")) return violations;
    if (file.path.includes("components/ui/")) return violations;
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/style=/.test(lines[i])) {
        violations.push(
          createViolation({
            file: file.path,
            line: i + 1,
            severity: Severity.ERROR,
            ruleId: "structural:inline-style-banned",
            message:
              "inline style= attributes are banned in .svelte files outside components/ui/. Use Tailwind classes.",
          })
        );
      }
    }
    return violations;
  }

  private _checkSvelteAst(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (!file.path.endsWith(".svelte")) return violations;

    let ast;
    try {
      ast = parse(file.source, { modern: true, filename: file.path });
    } catch {
      return violations;
    }

    if (ast.css) {
      violations.push(createViolation({
        file: file.path, line: 1, severity: Severity.ERROR,
        ruleId: "structural:style-block-banned",
        message: "<style> blocks are banned in .svelte files. Use Tailwind classes defined in app.css.",
      }));
    }

    if (!ast.instance) return violations;

    const stateVars = new Set<string>();
    const derivedVars = new Set<string>();

    walk(ast.instance, {
      enter(node: any, parent: any) {
        if (node.type === "CallExpression" && node.callee?.type === "Identifier") {
          const callee = node.callee.name;

          if (callee === "$state") {
            let p = parent;
            while (p) {
              if (p.type === "VariableDeclarator" && p.id?.name) {
                stateVars.add(p.id.name);
                break;
              }
              p = p.parent;
            }
          }

          if (callee === "$derived") {
            let p = parent;
            while (p) {
              if (p.type === "VariableDeclarator" && p.id?.name) {
                derivedVars.add(p.id.name);
                break;
              }
              p = p.parent;
            }
            checkDerivedBody(node, file);
          }

          if (callee === "$effect") {
            checkEffectBody(node, file);
          }
        }

        function checkEffectBody(effectNode: any, file: { path: string; source: string }) {
          const fn = effectNode.arguments?.[0];
          if (!fn || !fn.body) return;

          let hasReturn = false;
          let exprCount = 0;
          const storeAssignments: string[] = [];

          walk(fn, {
            enter(n2: any) {
              if (n2 === fn) return;
              if (n2.type === "ReturnStatement") hasReturn = true;
              if (n2.type === "ExpressionStatement" && n2.parent === fn.body) exprCount++;

              if (n2.type === "AssignmentExpression") {
                let lhs = n2.left;
                if (lhs?.type === "MemberExpression") lhs = lhs.object;
                if (lhs?.type === "Identifier" && stateVars.has(lhs.name)) {
                  let rhsUsesData = false;
                  walk(n2.right, {
                    enter(n3: any) {
                      if (n3 === n2.right) return;
                      if (n3.type === "Identifier" && (n3.name === "data" || n3.name === "$props")) {
                        rhsUsesData = true;
                      }
                    }
                  });
                  if (rhsUsesData) storeAssignments.push(lhs.name);
                }
              }
            }
          });

          const row = sourceLine(file.source, effectNode.start);

          if (!hasReturn) {
            violations.push(createViolation({
              file: file.path, line: row, severity: Severity.ERROR,
              ruleId: "structural:effect-no-cleanup",
              message: "$effect must include a return cleanup function. Without one, use $derived or onMount.",
            }));
          }

          if (exprCount === 1) {
            violations.push(createViolation({
              file: file.path, line: row, severity: Severity.ERROR,
              ruleId: "structural:effect-single-call",
              message: "$effect that only calls a single function with no reactive dependencies should use onMount instead.",
            }));
          }

          for (const varName of storeAssignments) {
            violations.push(createViolation({
              file: file.path, line: row, severity: Severity.ERROR,
              ruleId: "structural:store-should-use-derived",
              message: `$effect writes "${varName}" $state from data/$props. Use $derived(by => data.${varName}) instead.`,
            }));
          }

          violations.push(createViolation({
            file: file.path, line: row, severity: Severity.WARNING,
            ruleId: "structural:effect-present",
            message: "$effect usage warrants review. Confirm it has a cleanup function and references a browser-only imperative API.",
          }));
        }

        function checkDerivedBody(derivedNode: any, file: { path: string; source: string }) {
          const arg = derivedNode.arguments?.[0];
          if (!arg) return;

          const checkCall = (n: any): boolean => {
            if (n.type !== "CallExpression" || !n.callee) return false;
            if (n.callee.type === "Identifier" && n.callee.name === "fetch") return true;
            if (n.callee.type === "MemberExpression") {
              const parts: string[] = [];
              let obj: any = n.callee;
              while (obj?.type === "MemberExpression") {
                if (obj.property?.name) parts.unshift(obj.property.name);
                obj = obj.object;
              }
              if (obj?.name) parts.unshift(obj.name);
              const method = parts.join(".");
              if (method.includes("Service") || method.includes("get") || method === "fetch") return true;
            }
            return false;
          };

          const root: any = arg.body ? arg : arg;
          let callsFetch = checkCall(root);
          if (!callsFetch && root.body) {
            walk(root, {
              enter(n2: any) {
                if (n2 === root) return;
                if (checkCall(n2)) callsFetch = true;
              }
            });
          }

          if (callsFetch) {
            const row = sourceLine(file.source, derivedNode.start);
            violations.push(createViolation({
              file: file.path, line: row, severity: Severity.ERROR,
              ruleId: "structural:derived-calls-fetch",
              message: "$derived calls fetch() or a service method. $derived must be a pure computation — move async work to a loader.",
            }));
          }
        }
      }
    });

    return violations;
  }

  private _checkAppStoresImport(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/from\s+["']\$app\/stores["']/.test(lines[i])) {
        violations.push(
          createViolation({
            file: file.path,
            line: i + 1,
            severity: Severity.ERROR,
            ruleId: "structural:app-stores-banned",
            message:
              "$app/stores is banned — use $app/state (Svelte 5 API) instead.",
          })
        );
      }
    }
    return violations;
  }

  private _checkWritableStores(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/\b(writable|readable)\s*\(/.test(lines[i])) {
        violations.push(
          createViolation({
            file: file.path,
            line: i + 1,
            severity: Severity.ERROR,
            ruleId: "structural:writable-banned",
            message:
              "Svelte 4 writable()/readable() stores are banned — use $state runes instead.",
          })
        );
      }
    }
    return violations;
  }

  private _checkInlineSvg(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (file.path.includes("components/")) return violations;
    const svgBlocks = file.source.match(/<svg[\s\S]*?<\/svg>/g) ?? [];
    for (const block of svgBlocks) {
      const childTags = block.match(/<\w+/g) ?? [];
      if (childTags.length > 3) {
        const line = file.source.indexOf(block);
        const lineNum =
          line >= 0 ? file.source.substring(0, line).split("\n").length : 1;
        violations.push(
          createViolation({
            file: file.path,
            line: lineNum,
            severity: Severity.ERROR,
            ruleId: "structural:inline-svg-banned",
            message:
              "Inline <svg> with more than 2 child elements is banned. Extract to $lib/components/ or use Lucide.",
          })
        );
      }
    }
    return violations;
  }

  private _checkRawFetch(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (!file.path.includes("services/")) return violations;
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/\bfetch\s*\(/.test(lines[i]) && !/openapi/.test(lines[i])) {
        violations.push(createViolation({
          file: file.path, line: i + 1, severity: Severity.WARNING,
          ruleId: "structural:raw-fetch",
          message: "Raw fetch in services is discouraged. Use the typed openapi-fetch client from AppFactory. Suppress with // noqa: raw-fetch — <reason> for streaming, file upload, etc.",
        }));
      }
    }
    return violations;
  }

  private _checkServiceInterface(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (!file.path.includes("services/") || file.path.includes("protocols")) return violations;
    const classMatches = file.source.matchAll(/class\s+(\w+Service)\b/g);
    for (const m of classMatches) {
      const className = m[1];
      const interfaceName = `I${className}`;
      if (!file.source.includes(interfaceName)) {
        const idx = file.source.indexOf(className);
        const lineNum = file.source.substring(0, idx >= 0 ? idx : 0).split("\n").length;
        violations.push(createViolation({
          file: file.path, line: lineNum, severity: Severity.ERROR,
          ruleId: "structural:missing-service-interface",
          message: `Service "${className}" must implement a corresponding ${interfaceName} TypeScript interface.`,
        }));
      }
    }
    return violations;
  }

  private _checkAppFactory(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (!file.path.includes("factory") && !file.path.includes("factories")) return violations;
    const nonStatic = file.source.matchAll(/(?:public\s+|private\s+|protected\s+)?(?<!\bstatic\s)\b(\w+)\s*\([^)]*\)\s*:/g);
    for (const m of nonStatic) {
      if (m[1] === "constructor") continue;
      const idx = m.index ?? 0;
      const lineNum = file.source.substring(0, idx).split("\n").length;
      violations.push(createViolation({
        file: file.path, line: lineNum, severity: Severity.ERROR,
        ruleId: "structural:factory-static-only",
        message: `AppFactory method "${m[1]}" must be static. AppFactory uses static methods only and contains zero business logic.`,
      }));
    }
    return violations;
  }

  private _checkHooksServer(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (!file.path.endsWith("hooks.server.ts")) return violations;
    const localsAssignments = file.source.matchAll(/event\.locals\.(\w+)\s*=/g);
    for (const m of localsAssignments) {
      if (m[1] !== "user") {
        const idx = m.index ?? 0;
        const lineNum = file.source.substring(0, idx).split("\n").length;
        violations.push(createViolation({
          file: file.path, line: lineNum, severity: Severity.ERROR,
          ruleId: "structural:hooks-locals-limited",
          message: `hooks.server.ts sets locals.${m[1]}. Only locals.user is permitted. Move other logic to a loader or service.`,
        }));
      }
    }
    return violations;
  }

  private _checkOnMount(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (!file.path.endsWith(".svelte")) return violations;
    const onMountBlocks =
      file.source.match(/onMount\s*\(\s*(?:\(\)\s*=>\s*)?\{[\s\S]*?\}/g) ?? [];
    for (const block of onMountBlocks) {
      const hasBrowserApi = /\b(localStorage|sessionStorage|document|window|bind:this|WebSocket|EventSource)\b/.test(block);
      if (!hasBrowserApi) {
        const line = file.source.indexOf(block);
        const lineNum =
          line >= 0 ? file.source.substring(0, line).split("\n").length : 1;
        violations.push(
          createViolation({
            file: file.path,
            line: lineNum,
            severity: Severity.ERROR,
            ruleId: "structural:onmount-no-browser-api",
            message:
              "onMount must reference localStorage, sessionStorage, a DOM ref, or a browser-only constructor. Use $derived or loader for everything else.",
          })
        );
      }
    }
    return violations;
  }
}

function sourceLine(source: string, offset: number): number {
  if (offset < 0) return 1;
  return source.substring(0, offset).split("\n").length;
}
