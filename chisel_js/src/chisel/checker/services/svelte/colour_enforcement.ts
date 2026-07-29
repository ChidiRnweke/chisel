import { Layer } from "chisel/checker/models/layer";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

/**
 * Prefixes that take a colour. Used by the palette rule; the arbitrary-value
 * rule decides by inspecting the value, not the prefix.
 */
const COLOURABLE_PREFIXES = new Set([
  "bg", "text", "border", "ring", "fill", "stroke",
  "shadow", "outline", "decoration", "accent", "caret",
  "divide", "placeholder", "from", "via", "to",
]);

/** Tailwind's built-in palette hues. */
const PALETTE_HUES = new Set([
  "slate", "gray", "grey", "zinc", "neutral", "stone",
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
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

/**
 * Whether an arbitrary value is a *colour*, judged by the value itself.
 *
 * Previously any `ring-[…]`/`shadow-[…]`/`outline-[…]` was reported as a colour
 * violation regardless of content, so `ring-[2px]` and
 * `shadow-[0_1px_2px_rgba(0,0,0,.1)]` came back as colour errors. The prefix
 * says where a value is used; only the value says what it is.
 */
function isColourArbitrary(token: string): boolean {
  const m = token.match(/^([a-z][a-z0-9-]*)-\[([^\]]+)\]$/);
  if (!m) return false;
  if (!COLOURABLE_PREFIXES.has(m[1]!)) return false;
  return isColourValue(m[2]!);
}

/**
 * A hardcoded Tailwind palette class: `text-red-500`, `bg-slate-800`,
 * `from-blue-500`. Real Tailwind, but not a semantic theme token — it hardcodes
 * one appearance and cannot follow a theme.
 */
function paletteClass(token: string): { prefix: string; hue: string } | undefined {
  const m = token.match(/^([a-z][a-z0-9-]*)-([a-z]+)-(\d{2,3})$/);
  if (!m) return undefined;
  if (!COLOURABLE_PREFIXES.has(m[1]!) || !PALETTE_HUES.has(m[2]!)) return undefined;
  return { prefix: m[1]!, hue: m[2]! };
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

/** The semantic token that usually replaces a hardcoded palette class. */
function suggestToken(prefix: string): string {
  const suggestions: Record<string, string> = {
    bg: "bg-background, bg-muted, bg-card, bg-destructive",
    text: "text-foreground, text-muted-foreground, text-destructive",
    border: "border-border, border-input",
    ring: "ring-ring",
    fill: "fill-foreground, fill-muted-foreground",
    stroke: "stroke-foreground, stroke-muted-foreground",
    placeholder: "placeholder-muted-foreground",
  };
  return suggestions[prefix] ?? "one of the semantic tokens declared in app.css";
}

export class ColourEnforcementService {
  readonly ruleIdPrefix = "colour-enforcement";

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!file.path.endsWith(".svelte")) continue;
      // Tests are exempt: a mock response, a fixture with a hardcoded status,
      // or a long arrange block is not an architectural problem. Tests keep
      // their own test-structure rules. Note this is narrower than
      // UNRESTRICTED_LAYERS, which the import rules use — an *unclassified*
      // component still gets the hygiene and design-system rules.
      if (file.layer === Layer.TESTS) continue;
      if (file.path.includes("components/ui/")) continue;
      if (!file.source) continue;
      violations.push(...this._checkArbitraryValues(file));
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

      for (const m of lines[i].matchAll(/\b([a-z][a-z0-9-]*-[a-z]+-\d{2,3})\b/g)) {
        const token = m[1]!;
        const palette = paletteClass(token);
        if (palette === undefined) continue;
        violations.push(createViolation({
          file: file.path, line: i + 1, severity: Severity.ERROR,
          ruleId: "colour:palette-class-banned",
          message: `"${token}" hardcodes a Tailwind palette colour. Use a semantic `
            + `token instead — ${suggestToken(palette.prefix)} — so the colour follows `
            + `the theme instead of pinning one appearance in light and dark alike.`,
        }));
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
      { id: "colour:palette-class-banned", category: "colour-enforcement",
        description: "Hardcoded Tailwind palette colour (text-red-500, bg-slate-800, from-blue-500)",
        fixGuidance: "Use a semantic token from app.css (bg-background, text-muted-foreground, "
          + "text-destructive). A palette class pins one appearance and cannot follow the theme, "
          + "so it looks wrong in whichever mode it was not written for." },
      { id: "colour:dynamic-class-banned", category: "colour-enforcement",
        description: "Dynamic class construction (class={`bg-${variable}`})",
        fixGuidance: "Use a lookup object of pre-approved token names instead: const colourMap = { primary: 'bg-primary' }." },
      { id: "colour:modifier-on-semantic", category: "colour-enforcement",
        description: "Experimental modifier class on semantic HTML",
        fixGuidance: "Modifier classes (.glass, .neumorphic) restricted to Hero components and Overlay widgets." },
    ];
  }
}