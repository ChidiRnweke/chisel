import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";
import { DEFAULT_ALLOW_IN } from "chisel/checker/config";

const BANNED_HTML: Record<string, string> = {
  button: "Button, Toggle",
  textarea: "Textarea",
  select: "Select, NativeSelect, Combobox",
  label: "Label",
  progress: "Progress",
  dialog: "Dialog, AlertDialog, Drawer, Sheet",
  nav: "NavigationMenu, Breadcrumb, Menubar, Sidebar, Pagination",
  kbd: "Kbd",
  hr: "Separator",
  form: "Formsnap",
  fieldset: "Field",
  table: "Table, DataTable",
  thead: "Table, DataTable",
  tbody: "Table, DataTable",
  tr: "Table, DataTable",
  th: "Table, DataTable",
  td: "Table, DataTable",
  details: "Accordion, Collapsible",
  summary: "Accordion, Collapsible",
};

const INPUT_TYPE_REPLACEMENT: Record<string, string> = {
  text: "Input, InputOTP",
  checkbox: "Checkbox",
  radio: "RadioGroup",
  range: "Slider",
};

const AVATAR_PATTERNS = ["avatar"];
const MENU_PATTERNS = ["menu", "nav", "dropdown", "context", "listbox", "menubar"];

/**
 * Visit every node in a Svelte template.
 *
 * Walks the object graph generically rather than following named child
 * properties. The modern AST reaches children through a different key for
 * almost every construct — `fragment.nodes` on an element, `body` on an each
 * block, `consequent`/`alternate` on an if block — and enumerating them means
 * silently missing elements nested inside whichever construct was overlooked.
 */
function walkAst(root: any, fn: (node: any) => void): void {
  const seen = new Set<any>();

  const visit = (value: any): void => {
    if (value === null || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    if (typeof value.type === "string") fn(value);
    for (const key of Object.keys(value)) {
      if (key === "parent") continue;
      visit(value[key]);
    }
  };

  visit(root);
}

function getAttributeValue(node: any, attrName: string): string | null {
  if (!node.attributes) return null;
  for (const attr of node.attributes) {
    if (attr.name !== attrName) continue;
    if (attr.value === true) return "";
    if (Array.isArray(attr.value)) {
      return attr.value
        .map((v: any) => {
          if (v.type === "Text") return v.data;
          if (v.type === "ExpressionTag") return v.expression?.data ?? "";
          return v.data ?? v.raw ?? "";
        })
        .join("");
    }
    return null;
  }
  return null;
}

function hasClassOrRole(node: any, patterns: string[]): boolean {
  const cls = (getAttributeValue(node, "class") ?? "").toLowerCase();
  const role = (getAttributeValue(node, "role") ?? "").toLowerCase();
  return patterns.some(
    (p) => cls.includes(p) || role.includes(p)
  );
}

function getLineFromOffset(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

function buildRules(): Array<{
  id: string;
  category: string;
  description: string;
  fixGuidance: string;
}> {
  const rules: Array<{
    id: string;
    category: string;
    description: string;
    fixGuidance: string;
  }> = [];

  for (const [el, replacement] of Object.entries(BANNED_HTML)) {
    rules.push({
      id: `component-enforcement:html-${el}-banned`,
      category: "component-enforcement",
      description: `Raw <${el}> element`,
      fixGuidance: `Use <${replacement}> from shadcn.`,
    });
  }

  rules.push({
    id: "component-enforcement:html-input-banned",
    category: "component-enforcement",
    description: "Raw <input> element",
    fixGuidance:
      "Use <Input>, <InputOTP>, <Checkbox>, <Slider>, or <RadioGroup> from shadcn depending on the type attribute.",
  });

  rules.push({
    id: "component-enforcement:html-img-avatar-banned",
    category: "component-enforcement",
    description: "Raw <img> used as avatar",
    fixGuidance: "Use <Avatar> from shadcn.",
  });

  rules.push({
    id: "component-enforcement:html-ol-menu-banned",
    category: "component-enforcement",
    description: "Raw <ol> used as menu structure",
    fixGuidance: "Use <DropdownMenu>, <ContextMenu>, or <Command> from shadcn.",
  });

  rules.push({
    id: "component-enforcement:html-ul-menu-banned",
    category: "component-enforcement",
    description: "Raw <ul> used as menu structure",
    fixGuidance: "Use <DropdownMenu>, <ContextMenu>, or <Command> from shadcn.",
  });

  rules.push({
    id: "component-enforcement:html-li-menu-banned",
    category: "component-enforcement",
    description: "Raw <li> used as menu structure",
    fixGuidance: "Use <DropdownMenu>, <ContextMenu>, or <Command> from shadcn.",
  });

  return rules;
}

export class ComponentEnforcementService {
  readonly ruleIdPrefix = "component-enforcement";

  private readonly _rules = buildRules();
  private readonly _allowIn: readonly string[];

  /**
   * @param allowIn Folders exempt from the ban — where vendored and generated
   *   components live. This is the one configurable part of the design system
   *   rule set, and it is deliberately a list of paths rather than an on/off
   *   switch: it says *where* third-party markup lives, which is a fact about
   *   the repository, and it cannot silence the ban on first-party UI.
   */
  constructor(allowIn: readonly string[] = DEFAULT_ALLOW_IN) {
    this._allowIn = allowIn;
  }

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (file.language !== "svelte") continue;
      if (!file.source) continue;
      if (this._allowIn.some(prefix => file.path.startsWith(prefix) || file.path.includes(prefix))) {
        continue;
      }

      // Parsed once by the controller; no second parse here.
      const fragment = file.ast?.fragment;
      if (fragment === undefined) continue;

      walkAst(fragment, (node: any) => {
        if (node.type !== "RegularElement") return;

        const name: string = node.name;
        const line = getLineFromOffset(file.source, node.start);

        if (BANNED_HTML[name]) {
          violations.push(
            createViolation({
              file: file.path,
              line,
              severity: Severity.ERROR,
              ruleId: `component-enforcement:html-${name}-banned`,
              message: `Raw <${name}> element is banned outside the allowed component folders. Use <${BANNED_HTML[name]}> from shadcn.`,
            })
          );
          return;
        }

        if (name === "input") {
          const type = getAttributeValue(node, "type") || "text";
          if (type === "hidden") return;

          const replacement =
            INPUT_TYPE_REPLACEMENT[type] ?? "Input (or appropriate shadcn component)";

          violations.push(
            createViolation({
              file: file.path,
              line,
              severity: Severity.ERROR,
              ruleId: "component-enforcement:html-input-banned",
              message: `Raw <input type="${type}"> is banned outside the allowed component folders. Use <${replacement}> from shadcn.`,
            })
          );
          return;
        }

        if (name === "img") {
          if (hasClassOrRole(node, AVATAR_PATTERNS)) {
            violations.push(
              createViolation({
                file: file.path,
                line,
                severity: Severity.ERROR,
                ruleId: "component-enforcement:html-img-avatar-banned",
                message:
                  "Raw <img> appears to be used as an avatar. Use <Avatar> from shadcn.",
              })
            );
          }
          return;
        }

        if (name === "ol" || name === "ul" || name === "li") {
          if (hasClassOrRole(node, MENU_PATTERNS)) {
            violations.push(
              createViolation({
                file: file.path,
                line,
                severity: Severity.WARNING,
                ruleId: `component-enforcement:html-${name}-menu-banned`,
                message: `Raw <${name}> appears to be used as a menu structure. Use <DropdownMenu>, <ContextMenu>, or <Command> from shadcn.`,
              })
            );
          }
          return;
        }
      });
    }
    return violations;
  }

  describeRules() {
    return this._rules;
  }
}
