import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

export class ColourEnforcementService {
  readonly ruleIdPrefix = "colour-enforcement";

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!file.path.endsWith(".svelte")) continue;
      if (file.path.includes("components/ui/")) continue;
      if (!file.source) continue;
      violations.push(...this._checkFile(file));
      violations.push(...this._checkModifierClasses(file));
    }
    return violations;
  }

  private _checkModifierClasses(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (!file.path.endsWith(".svelte")) return violations;
    const modifierClasses = ["glass", "neumorphic", "claymorph"];
    const semanticTags = ["<form", "<table", "<nav", "<fieldset"];
    for (const cls of modifierClasses) {
      for (const tag of semanticTags) {
        const re = new RegExp(`${tag}[^>]*class="[^"]*${cls}[^"]*"`);
        if (re.test(file.source)) {
          const idx = file.source.search(re);
          const lineNum = idx >= 0 ? file.source.substring(0, idx).split("\n").length : 1;
          violations.push(createViolation({
            file: file.path, line: lineNum, severity: Severity.ERROR,
            ruleId: "colour:modifier-on-semantic",
            message: `Modifier class ".${cls}" must not be applied to semantic HTML elements. Restricted to Hero components and Overlay widgets only.`,
          }));
        }
      }
    }
    return violations;
  }

  private _checkFile(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const prefix = /(?:bg|text|border|ring|fill|stroke|shadow|outline|decoration|accent|caret|divide|placeholder)-\[[^\]]+\]/g;
      const matches = lines[i].match(prefix);
      if (matches) {
        for (const m of matches) {
          violations.push(createViolation({
            file: file.path, line: i + 1, severity: Severity.ERROR,
            ruleId: "colour:arbitrary-value-banned",
            message: `Arbitrary Tailwind value "${m}" is banned. Add the colour as a CSS custom property in app.css first.`,
          }));
        }
      }
      if (/class=\{`.*\$\{.*\}.*`\}/.test(lines[i]) || /class=\{[^}]*\$\{/.test(lines[i])) {
        violations.push(createViolation({
          file: file.path, line: i + 1, severity: Severity.ERROR,
          ruleId: "colour:dynamic-class-banned",
          message: "Dynamic class construction is banned. Use a lookup object of pre-approved token names instead.",
        }));
      }
    }
    return violations;
  }

  describeRules() {
    return [
      { id: "colour:arbitrary-value-banned", category: "colour-enforcement",
        description: "Arbitrary Tailwind value syntax (bg-[...], text-[...], etc.)",
        fixGuidance: "Add the colour as a CSS custom property in app.css first, then reference it as a Tailwind token." },
      { id: "colour:dynamic-class-banned", category: "colour-enforcement",
        description: "Dynamic class construction (class={`bg-${variable}`})",
        fixGuidance: "Use a lookup object of pre-approved token names instead: const colourMap = { primary: 'bg-primary' }." },
      { id: "colour:modifier-on-semantic", category: "colour-enforcement",
        description: "Experimental modifier class on semantic HTML",
        fixGuidance: "Modifier classes (.glass, .neumorphic) restricted to Hero components and Overlay widgets." },
    ];
  }
}
