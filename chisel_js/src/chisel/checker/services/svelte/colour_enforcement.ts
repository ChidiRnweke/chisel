import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

const COLOUR_PREFIXES = new Set([
  "bg", "text", "border", "ring", "fill", "stroke",
  "shadow", "outline", "decoration", "accent", "caret",
  "divide", "placeholder",
]);

const TYPOGRAPHY_PREFIXES = new Set([
  "text", "tracking", "leading", "font-size", "line-height",
  "text-size", "leading",
]);

const SPACING_PREFIXES = new Set([
  "w", "h", "p", "px", "py", "ps", "pe", "pt", "pr", "pb", "pl",
  "m", "mx", "my", "ms", "me", "mt", "mr", "mb", "ml",
  "gap", "gap-x", "gap-y",
  "min-w", "min-h", "max-w", "max-h",
  "size",
]);

const COLOUR_VALUE_PREFIXES = new Set([
  "bg", "border", "ring", "fill", "stroke",
  "shadow", "outline", "decoration", "accent", "caret",
  "divide", "placeholder",
]);

function isColourArbitrary(token: string): boolean {
  const m = token.match(/^([a-z][a-z0-9-]*)-\[([^\]]+)\]$/);
  if (!m) return false;
  const prefix = m[1];
  if (COLOUR_VALUE_PREFIXES.has(prefix)) return true;

  if (prefix === "text") {
    const value = m[2];
    if (isColourValue(value)) return true;
    return false;
  }
  return false;
}

function isColourValue(value: string): boolean {
  if (/^#[0-9a-fA-F]([0-9a-fA-F]{2}|[0-9a-fA-F]{5})?$/.test(value)) return true;
  if (/^(rgb|hsl|oklch|oklab|color)/.test(value)) return true;
  if (/^(?:red|blue|green|yellow|orange|purple|pink|gray|grey|slate|zinc|neutral|stone|emerald|teal|cyan|sky|indigo|violet|fuchsia|rose|lime|amber|brown|black|white)\b/.test(value)) return true;
  return false;
}

function isTypographyArbitrary(token: string): boolean {
  const m = token.match(/^([a-z][a-z0-9-]*)-\[([^\]]+)\]$/);
  if (!m) return false;
  const prefix = m[1];
  const value = m[2];

  if (prefix === "text") {
    if (isColourValue(value)) return false;
    if (/^\d+(\.\d+)?(px|rem|em|ex|ch|vw|vh|%|pt|in|cm|mm)$/.test(value)) return true;
    return true;
  }
  if (TYPOGRAPHY_PREFIXES.has(prefix)) return true;
  if (prefix === "tracking" || prefix === "leading") return true;
  if (prefix === "font-size" || prefix === "line-height") return true;
  return false;
}

function isSpacingArbitrary(token: string): boolean {
  const m = token.match(/^([a-z][a-z0-9-]*)-\[([^\]]+)\]$/);
  if (!m) return false;
  const prefix = m[1];
  if (SPACING_PREFIXES.has(prefix)) return true;
  return false;
}

function extractClassStrings(source: string): string[] {
  const out: string[] = [];
  const re = /class=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`|([^>]+?)(?=\s|\/>))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const v = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (typeof v === "string") out.push(v);
  }
  return out;
}

export class ColourEnforcementService {
  readonly ruleIdPrefix = "colour-enforcement";

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!file.path.endsWith(".svelte")) continue;
      if (file.path.includes("components/ui/")) continue;
      if (!file.source) continue;
      violations.push(...this._checkArbitraryValues(file));
      violations.push(...this._checkDynamicClass(file));
      violations.push(...this._checkModifierClasses(file));
    }
    return violations;
  }

  private _checkArbitraryValues(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const matched = lines[i].matchAll(/([a-z][a-z0-9-]*)-\[[^\]]+\]/g);
      for (const m of matched) {
        const token = m[0];
        if (isColourArbitrary(token)) {
          violations.push(createViolation({
            file: file.path, line: i + 1, severity: Severity.ERROR,
            ruleId: "colour:arbitrary-value-banned",
            message: `Arbitrary Tailwind colour "${token}" is banned. Add the colour as a CSS custom property in app.css first, then reference it as a Tailwind token.`,
          }));
        } else if (isTypographyArbitrary(token)) {
          violations.push(createViolation({
            file: file.path, line: i + 1, severity: Severity.ERROR,
            ruleId: "typography:arbitrary-value-banned",
            message: `Arbitrary typography value "${token}" is banned. Map it to a type-scale token defined in app.css (e.g. --text-sm) and reference it as a Tailwind token.`,
          }));
        } else if (isSpacingArbitrary(token)) {
          violations.push(createViolation({
            file: file.path, line: i + 1, severity: Severity.ERROR,
            ruleId: "spacing:arbitrary-value-banned",
            message: `Arbitrary spacing/sizing value "${token}" is banned. Define it as a CSS custom property in app.css (e.g. --space-4) and reference it as a Tailwind token.`,
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

  private _checkDynamicClass(file: { path: string; source: string }) {
    return [];
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

  describeRules() {
    return [
      { id: "colour:arbitrary-value-banned", category: "colour-enforcement",
        description: "Arbitrary Tailwind colour value syntax (bg-[...], text-[#...], border-[...], etc.)",
        fixGuidance: "Add the colour as a CSS custom property in app.css first, then reference it as a Tailwind token (e.g. bg-primary)." },
      { id: "typography:arbitrary-value-banned", category: "typography",
        description: "Arbitrary Tailwind typography value syntax (text-[10px], tracking-[0.4em], leading-[1.6])",
        fixGuidance: "Define the size/leading/tracking as a CSS custom property in app.css (e.g. --text-sm) and reference it as a Tailwind token." },
      { id: "spacing:arbitrary-value-banned", category: "spacing",
        description: "Arbitrary Tailwind spacing/sizing value syntax (w-[400px], min-h-[80vh], gap-[14px])",
        fixGuidance: "Define the size as a CSS custom property in app.css (e.g. --space-4) and reference it as a Tailwind token." },
      { id: "colour:dynamic-class-banned", category: "colour-enforcement",
        description: "Dynamic class construction (class={`bg-${variable}`})",
        fixGuidance: "Use a lookup object of pre-approved token names instead: const colourMap = { primary: 'bg-primary' }." },
      { id: "colour:modifier-on-semantic", category: "colour-enforcement",
        description: "Experimental modifier class on semantic HTML",
        fixGuidance: "Modifier classes (.glass, .neumorphic) restricted to Hero components and Overlay widgets." },
    ];
  }
}