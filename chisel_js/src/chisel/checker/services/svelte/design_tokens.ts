import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { RuleInfo } from "chisel/checker/rule_metadata";
import type { Violation } from "chisel/checker/models/violation";
import type { UiOptions, UiRule } from "chisel/checker/services/svelte/design_tokens_rules";
import { Layer } from "chisel/checker/models/layer";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";
import { analyzeFile } from "chisel/checker/services/svelte/design_tokens_rules";

const TEST_FILE_RE = /\.(?:spec|test|e2e)\.ts$|\.d\.ts$/;

/**
 * The design-system rules: type scale, weights, alpha steps, flat surfaces,
 * colour only from tokens, and AA contrast between the token pairs. They read
 * components, stylesheets and the class strings in TypeScript.
 */
export class DesignTokensService {
  readonly ruleIdPrefix = "design-system";

  constructor(private readonly options: UiOptions) {}

  check(project: ProjectInfo): Violation[] {
    const sources = [
      ...project.files
        .filter(file => file.path.startsWith("src/") && file.layer !== Layer.TESTS)
        .filter(file => file.language === "svelte" || (file.language === "ts" && !TEST_FILE_RE.test(file.path))),
      ...project.stylesheets,
    ];
    return sources.flatMap(({ path, source }) =>
      analyzeFile(path, source, this.options).map(finding => createViolation({
        file: path,
        line: finding.line,
        severity: Severity.ERROR,
        ruleId: `${this.ruleIdPrefix}:${finding.rule}`,
        message: `${finding.message.charAt(0).toUpperCase()}${finding.message.slice(1)}.`,
      })));
  }

  describeRules(): RuleInfo[] {
    const rule = (id: UiRule, description: string, fixGuidance: string): RuleInfo => ({
      id: `${this.ruleIdPrefix}:${id}`,
      category: this.ruleIdPrefix,
      description,
      fixGuidance,
    });
    return [
      rule("no-raw-font-family", "A raw font-family utility (font-sans, font-serif, font-mono)",
        "Use the type utility that carries the family, so faces stay where the design system puts them."),
      rule("font-weight-bounds", "A font weight outside 400–800",
        "Use font-normal through font-extrabold. Thin and black weights fall apart at UI sizes."),
      rule("no-em-font-size", "A font-size in em",
        "Use rem or a type-scale utility; em compounds through nesting."),
      rule("uppercase-needs-tracking", "Uppercase text without positive letter-spacing",
        "Add a tracking-wide class. Capitals set solid read as shouting and crowd each other."),
      rule("no-wide-tracking-on-display", "Wide tracking on display-size text",
        "Display sizes already space themselves; keep tracking normal or tight."),
      rule("no-hex-rgb-color", "A hex or rgb() colour literal",
        "Use a token, or oklch() in the token stylesheet. Vendored theme stylesheets are exempt."),
      rule("no-runtime-color-derivation", "A colour derived at run time (lighten, color-mix, relative colours)",
        "Define the colour as a token. A token wash toward transparent is the one allowed color-mix."),
      rule("no-pure-black", "Pure black as a colour",
        "Use the foreground token; pure black is harsher than any surface it sits on."),
      rule("token-contrast-aa", "A text token pair below WCAG AA 4.5:1, or a missing pair",
        "Adjust the token's lightness in the token stylesheet until the pair passes in both modes."),
      rule("heading-needs-utility", "A heading element without a type-scale utility",
        "Add a text size or a configured heading utility; otherwise it inherits browser sizes."),
      rule("justify-needs-hyphens", "Justified text without automatic hyphenation",
        "Add hyphens-auto, or align left. Justified text without hyphens opens rivers."),
      rule("text-shadow-glow-only", "A text shadow with an offset or a small blur",
        "Only soft glows (no offset, blur of 8px or more) are allowed."),
      rule("no-accent-bars", "A thick coloured edge bar on a container",
        "Mark state with a wash or a hairline ring instead of a coloured side border."),
      rule("no-ad-hoc-shadow", "A shadow outside the vendored primitives",
        "The surfaces are flat; use ring-1 ring-inset for a hairline edge."),
      rule("alpha-fixed-steps", "A colour opacity step outside the sanctioned steps",
        "Use /5, /10, /15, /20, /25, /30, /35, /40, /50, /60, /70, /75, /80 or /90."),
    ];
  }
}
