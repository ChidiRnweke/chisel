/**
 * Design-system rules over markup, class strings and stylesheets.
 *
 * Ported from FollowThrough.ai's `scripts/audit-ui.ts`. The design system is a
 * set of bounded choices — a type scale, a weight range, fixed alpha steps, flat
 * surfaces, colour only from tokens, and token pairs that pass WCAG AA — and
 * each rule reports a value chosen outside it. The rules scan text rather than
 * an AST because the values live in class strings, `@apply` lists and CSS, and
 * reports land on the tag or declaration so one comment above can excuse it.
 */
const RULES = [
  "no-raw-font-family",
  "font-weight-bounds",
  "no-em-font-size",
  "uppercase-needs-tracking",
  "no-wide-tracking-on-display",
  "no-hex-rgb-color",
  "no-runtime-color-derivation",
  "no-pure-black",
  "token-contrast-aa",
  "heading-needs-utility",
  "justify-needs-hyphens",
  "text-shadow-glow-only",
  "no-accent-bars",
  "no-ad-hoc-shadow",
  "alpha-fixed-steps",
] as const;
export type UiRule = (typeof RULES)[number];
/** Design-system facts the rules cannot derive. */
export interface UiOptions {
  /** The stylesheet that defines the colour tokens; contrast is checked there. */
  readonly tokens?: string;
  /** Folders of vendored components and themes; their stylesheets keep their own colour format. */
  readonly vendored: readonly string[];
  /** Utility classes that set a heading's type scale, beyond `text-*` and `sr-only`. */
  readonly headingUtilities: readonly string[];
  /** Utility classes that render display-size text, beyond `text-xl` and up. */
  readonly displayUtilities: readonly string[];
}

export interface UiViolation {
  readonly rule: UiRule;
  readonly line: number;
  readonly message: string;
}

// The sanctioned alpha steps: the brand washes (/10–/35, +5% in dark mode), the
// utilities a token stylesheet applies (/20 /30 /40 /50), and the coarse
// overlay and emphasis steps. A step outside these is an unreviewed colour.
const ALLOWED_ALPHA_STEPS = new Set([5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 75, 80, 90]);

const RAW_FONT_CLASSES = new Set(["font-serif", "font-sans", "font-mono"]);
const OUT_OF_BOUNDS_WEIGHTS = new Set(["font-thin", "font-extralight", "font-light", "font-black"]);
const PURE_BLACK_CLASSES = /^(?:bg|text|border|ring)-black(?:\/\d+)?$/;
const WIDE_TRACKING = new Set(["tracking-wide", "tracking-wider", "tracking-widest"]);
const HEADING_SIZES = /^text-(?:xs|sm|base|lg|xl|[2-9]xl|\[)/;
const ACCENT_SIDE_CLASS = /^border-[ltrb]-[248]$/;
const ACCENT_COLOR_CLASS = /^border-(?:brand|primary|destructive|accent)(?:\/\d+)?$/;
const COLOR_UTILITY_ALPHA =
  /^(?:bg|text|border|ring|outline|decoration|divide|placeholder|caret|accent|fill|stroke|from|via|to)-[a-z0-9-]+\/(\d+)$/;
const HEX_COLOR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;
const DERIVATION_ALWAYS = /lighten\(|darken\(|oklch\(\s*from|hsl\(\s*from/;
// color-mix that only fades a token toward transparent is the design system's own
// wash mechanism — what Tailwind's /alpha compiles to. Mixing two colors, or
// mixing anywhere in component code, is runtime derivation.
const TOKEN_WASH = /^in\s+\w+,\s*var\(--[\w-]+\)\s+[\d.]+%\s*,\s*transparent$/;

interface Reporter {
  readonly report: (rule: UiRule, index: number, message: string) => void;
  readonly violations: UiViolation[];
}

const createReporter = (text: string): Reporter => {
  const starts: number[] = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  const lineAt = (index: number): number => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const violations: UiViolation[] = [];
  const report = (rule: UiRule, index: number, message: string): void => {
    const line = lineAt(index);
    if (violations.some(v => v.rule === rule && v.line === line)) return;
    violations.push({ rule, line, message });
  };
  return { report, violations };
};

/** Replace every match with spaces, preserving newlines so indices and lines still align. */
const blank = (text: string, pattern: RegExp): string =>
  text.replace(pattern, match => match.replace(/[^\n]/g, " "));

const blankRanges = (text: string, ranges: readonly { start: number; end: number }[]): string => {
  const chars = [...text];
  for (const { start, end } of ranges)
    for (let i = start; i < end; i++) if (chars[i] !== "\n") chars[i] = " ";
  return chars.join("");
};

/** The base utility of a class token, with variant prefixes (`dark:`, `hover:`) removed. */
const variantBase = (token: string): string => {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (c === ":" && depth === 0) cut = i;
  }
  return cut === -1 ? token : token.slice(cut + 1);
};

const tokensOf = (value: string): string[] => value.split(/\s+/).filter(Boolean);

interface Literal {
  readonly value: string;
  readonly start: number;
}

/** Index of a literal's closing quote, descending into template-literal expressions. */
const literalEnd = (text: string, start: number, to: number): number => {
  const quote = text[start]!;
  let i = start + 1;
  while (i < to) {
    const c = text[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === quote) return i;
    if (quote === "`" && c === "$" && text[i + 1] === "{") {
      i = expressionEnd(text, i + 2, to);
      continue;
    }
    i++;
  }
  return to;
};

/** One past the `}` closing the expression that opened at `from`. */
const expressionEnd = (text: string, from: number, to: number): number => {
  let depth = 1;
  let i = from;
  while (i < to && depth > 0) {
    const c = text[i];
    if (c === "'" || c === '"' || c === "`") i = literalEnd(text, i, to) + 1;
    else {
      if (c === "{") depth++;
      else if (c === "}") depth--;
      i++;
    }
  }
  return i;
};

/** All string literals in a JS/TS-ish region, skipping comments and template expressions. */
const stringLiterals = (text: string, from = 0, to = text.length): Literal[] => {
  const out: Literal[] = [];
  let i = from;
  while (i < to) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/") {
      while (i < to && text[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? to : end + 2;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      out.push({ value: text.slice(i + 1, literalEnd(text, i, to)), start: i });
      i = literalEnd(text, i, to) + 1;
      continue;
    }
    i++;
  }
  return out;
};

/** Tokens of a class attribute value, including string literals inside `{…}` expressions. */
const classValueTokens = (value: string): string[] => {
  if (!value.includes("{")) return tokensOf(value);
  const tokens: string[] = [];
  let text = "";
  let i = 0;
  while (i < value.length) {
    if (value[i] === "{") {
      const end = expressionEnd(value, i + 1, value.length);
      for (const literal of stringLiterals(value, i, end)) tokens.push(...tokensOf(literal.value));
      i = end;
      continue;
    }
    text += value[i];
    i++;
  }
  return [...tokensOf(text), ...tokens];
};

/** Token-level rules over a list of class tokens found at `reportIndex`. */
const classTokenRules = (
  file: string,
  tokens: readonly string[],
  reportIndex: number,
  report: Reporter["report"],
): void => {
  for (const raw of tokens) {
    const base = variantBase(raw);
    if (RAW_FONT_CLASSES.has(base))
      report(
        "no-raw-font-family",
        reportIndex,
        `raw ${base} — font families come from the design system's type utilities`,
      );
    if (OUT_OF_BOUNDS_WEIGHTS.has(base))
      report("font-weight-bounds", reportIndex, `${base} is outside the 400–800 weight bounds`);
    if (PURE_BLACK_CLASSES.test(base))
      report("no-pure-black", reportIndex, `${base} — pure black is banned, use a token`);
    if (
      base.startsWith("shadow") &&
      base !== "shadow-none" &&
      !file.startsWith("src/lib/components/ui/")
    )
      report(
        "no-ad-hoc-shadow",
        reportIndex,
        `${base} outside components/ui — the system is flat; hairlines are ring-inset ring-1`,
      );
    const alpha = COLOR_UTILITY_ALPHA.exec(base);
    if (alpha && !ALLOWED_ALPHA_STEPS.has(Number(alpha[1])))
      report("alpha-fixed-steps", reportIndex, `alpha step /${alpha[1]} is not a sanctioned step`);
  }
};

/** Rules about how classes combine on one element (or one @apply list). */
const elementRules = (
  tagName: string,
  tokens: readonly string[],
  at: number,
  report: Reporter["report"],
  options: UiOptions,
): void => {
  const bases = tokens.map(variantBase);
  const display = (b: string): boolean =>
    /^text-(?:xl|[2-9]xl)$/.test(b) || options.displayUtilities.includes(b);
  const headingUtility = (b: string): boolean =>
    b === "sr-only" || options.headingUtilities.includes(b);
  if (bases.includes("uppercase")) {
    if (!bases.some(b => b.startsWith("tracking-")))
      report("uppercase-needs-tracking", at, "uppercase without a tracking-* class");
    else if (bases.some(b => b === "tracking-tight" || b === "tracking-tighter"))
      report("uppercase-needs-tracking", at, "uppercase must never use tight tracking");
  }
  if (bases.some(display) && bases.some(b => WIDE_TRACKING.has(b)))
    report("no-wide-tracking-on-display", at, "wide tracking on display-size text");
  if (/^h[1-6]$/.test(tagName) && !bases.some(b => headingUtility(b) || HEADING_SIZES.test(b)))
    report(
      "heading-needs-utility",
      at,
      `<${tagName}> without a type-scale utility inherits UA sizes`,
    );
  if (bases.includes("text-justify") && !bases.includes("hyphens-auto"))
    report("justify-needs-hyphens", at, "text-justify without hyphens-auto");
  if (bases.some(b => ACCENT_SIDE_CLASS.test(b)) && bases.some(b => ACCENT_COLOR_CLASS.test(b)))
    report("no-accent-bars", at, "thick colored edge accent bar");
};

interface Tag {
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly classTokens: readonly string[];
  /** String literals in the tag's attributes that are not the class attribute. */
  readonly otherLiterals: readonly string[];
}

/** Tags in markup; quoted attributes and `{…}` expressions hide their `>` from the scan. */
const parseTags = (markup: string): Tag[] => {
  const tags: Tag[] = [];
  let i = 0;
  while (i < markup.length) {
    if (markup[i] !== "<" || !/[A-Za-z]/.test(markup[i + 1] ?? "")) {
      i++;
      continue;
    }
    const start = i;
    const name = /^[A-Za-z][\w.:-]*/.exec(markup.slice(i + 1))![0];
    let j = start + 1 + name.length;
    const classTokens: string[] = [];
    const otherLiterals: string[] = [];
    while (j < markup.length && markup[j] !== ">") {
      const c = markup[j];
      if (c === '"' || c === "'") {
        const end = literalEnd(markup, j, markup.length);
        const value = markup.slice(j + 1, end);
        if (/(?:^|\s)class\s*=\s*$/.test(markup.slice(start, j)))
          classTokens.push(...classValueTokens(value));
        else otherLiterals.push(value);
        j = end + 1;
        continue;
      }
      if (c === "{") {
        const end = expressionEnd(markup, j + 1, markup.length);
        const literals = stringLiterals(markup, j, end).map(literal => literal.value);
        if (/\bclass\s*=\s*$/.test(markup.slice(start, j)))
          for (const value of literals) classTokens.push(...tokensOf(value));
        else otherLiterals.push(...literals);
        j = end;
        continue;
      }
      j++;
    }
    tags.push({ name, start, end: j, classTokens, otherLiterals });
    i = j + 1;
  }
  return tags;
};

const COLORED_SIDE_BORDER = /(?<![-\w])border-(?:left|top|right|bottom)\s*:\s*([^;}]+)/g;
const SIDE_BORDER_COLOR =
  /var\(--color-(?:brand|primary|destructive|accent|success|warning)[\s),]|#[0-9a-fA-F]|\brgba?\(|\boklch\(/;
// The same bar drawn without a border: a thin, colored `::before`/`::after`
// pinned to the leading edge. The selected sidebar row once carried one past the
// border-only check above. A 1px pseudo-element is a hairline divider (the
// workspace tab separator), not a bar.
const PSEUDO_RULE = /([^{};]*::(?:before|after)[^{};]*)\{([^{}]*)\}/g;
const PSEUDO_EDGE_ANCHOR = /(?<![-\w])(?:inset-inline-start|left)\s*:\s*0\b/;
const PSEUDO_THIN_WIDTH = /(?<![-\w])width\s*:\s*([\d.]+)px/;
const PSEUDO_BACKGROUND = /(?<![-\w])background(?:-color)?\s*:\s*([^;}]+)/;

/** CSS-level rules over a comment-stripped stylesheet; `at` maps offsets into the source file. */
const cssRules = (
  file: string,
  css: string,
  at: (index: number) => number,
  options: { readonly boxShadow: boolean; readonly vendoredTheme: boolean },
  report: Reporter["report"],
  ui: UiOptions,
): void => {
  for (const match of css.matchAll(/(?<![-\w])font-weight\s*:\s*(\d+)/g)) {
    const weight = Number(match[1]);
    if (weight < 400 || weight > 800)
      report("font-weight-bounds", at(match.index), `font-weight ${weight} is outside 400–800`);
  }
  for (const match of css.matchAll(/(?<![-\w])font-size\s*:\s*([^;}{]+)/g))
    if (/(?:^|[\s,(])-?[\d.]+em\b/.test(match[1]!))
      report("no-em-font-size", at(match.index), `font-size in em: ${match[1]!.trim()}`);
  for (const match of css.matchAll(/@apply\s+([^;}]+)/g)) {
    const tokens = tokensOf(match[1]!);
    // @apply in the stylesheet defines the utilities themselves, so only the
    // combinatorial rules and the alpha steps apply here — the raw-font and
    // shadow class rules govern markup, not the definitions.
    for (const raw of tokens) {
      const alpha = COLOR_UTILITY_ALPHA.exec(variantBase(raw));
      if (alpha && !ALLOWED_ALPHA_STEPS.has(Number(alpha[1])))
        report(
          "alpha-fixed-steps",
          at(match.index),
          `alpha step /${alpha[1]} is not a sanctioned step`,
        );
    }
    elementRules("", tokens, at(match.index), report, ui);
  }
  // A vendored theme (a syntax-highlighting palette) is authored in its own colour
  // format; re-authoring it is a design task, so only the colour-literal rules skip it.
  if (!options.vendoredTheme) {
    for (const match of css.matchAll(new RegExp(HEX_COLOR.source, "g")))
      report("no-hex-rgb-color", at(match.index), `hex color literal ${match[0]}`);
    for (const match of css.matchAll(/\brgba?\(/g))
      report("no-hex-rgb-color", at(match.index), "rgb()/rgba() literal — use oklch() or a token");
  }
  for (const match of css.matchAll(new RegExp(DERIVATION_ALWAYS.source, "g")))
    report(
      "no-runtime-color-derivation",
      at(match.index),
      `derives a color at runtime: ${match[0]}`,
    );
  for (const match of css.matchAll(/color-mix\(((?:[^()]|\([^()]*\))*)\)/g))
    if (!TOKEN_WASH.test(match[1]!.trim()))
      report(
        "no-runtime-color-derivation",
        at(match.index),
        `color-mix beyond a token wash: ${match[1]!.trim()}`,
      );
  for (const match of css.matchAll(/#000(?:000)?\b/g))
    report("no-pure-black", at(match.index), "pure black literal");
  for (const match of css.matchAll(/:[^;{}]*\bblack\b/g))
    report("no-pure-black", at(match.index), "the black keyword as a color value");
  for (const match of css.matchAll(/oklch\(\s*0\s+0\s+0[\s/)]/g))
    report("no-pure-black", at(match.index), "oklch(0 0 0) is pure black");
  for (const match of css.matchAll(/(?<![-\w])text-align\s*:\s*justify/g)) {
    const open = css.lastIndexOf("{", match.index);
    let depth = 1;
    let close = open + 1;
    while (close < css.length && depth > 0) {
      if (css[close] === "{") depth++;
      else if (css[close] === "}") depth--;
      close++;
    }
    if (!/(?<![-\w])hyphens\s*:\s*auto/.test(css.slice(open, close)))
      report("justify-needs-hyphens", at(match.index), "text-align: justify without hyphens: auto");
  }
  for (const match of css.matchAll(/(?<![-\w])text-shadow\s*:\s*([^;}]+)/g)) {
    const bad = match[1]!.split(",").some(shadow => {
      // Leading length tokens (x, y, blur); unitless zeros are legal CSS.
      const lengths: number[] = [];
      for (const token of shadow.trim().split(/\s+/)) {
        if (!/^-?[\d.]+(?:px|rem|em)?$/.test(token)) break;
        if (lengths.length < 4) lengths.push(parseFloat(token));
      }
      const [x = 0, y = 0, blur = 0] = lengths;
      return x !== 0 || y !== 0 || blur < 8;
    });
    if (bad)
      report(
        "text-shadow-glow-only",
        at(match.index),
        "text-shadow with an offset or a blur below 8px — only soft glows are allowed",
      );
  }
  for (const match of css.matchAll(COLORED_SIDE_BORDER))
    if (SIDE_BORDER_COLOR.test(match[1]!))
      report("no-accent-bars", at(match.index), `colored edge border: ${match[0].trim()}`);
  for (const match of css.matchAll(PSEUDO_RULE)) {
    const body = match[2]!;
    const width = PSEUDO_THIN_WIDTH.exec(body);
    const background = PSEUDO_BACKGROUND.exec(body);
    if (
      PSEUDO_EDGE_ANCHOR.test(body) &&
      width &&
      Number(width[1]) >= 2 &&
      Number(width[1]) <= 4 &&
      background &&
      SIDE_BORDER_COLOR.test(background[1]!)
    )
      report("no-accent-bars", at(match.index), "colored edge bar drawn by a pseudo-element");
  }
  if (options.boxShadow)
    for (const match of css.matchAll(/(?<![-\w])box-shadow\s*:\s*([^;}]+)/g))
      if (!/^\s*none\b/.test(match[1]!))
        report(
          "no-ad-hoc-shadow",
          at(match.index),
          "bespoke box-shadow in a component style block",
        );
};

/* ---------------------------------------------------------------------------
   token-contrast-aa — OKLCH tokens → WCAG contrast
   --------------------------------------------------------------------------- */

interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

/** OKLCH → OKLab → linear sRGB (Björn Ottosson's matrices), channels linear 0–1. */
const linearSrgb = ({ l, c, h }: Oklch): [number, number, number] => {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);
  const lp = l + 0.3963377774 * a + 0.2158037573 * b;
  const mp = l - 0.1055613458 * a - 0.0638541728 * b;
  const sp = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = lp ** 3;
  const m3 = mp ** 3;
  const s3 = sp ** 3;
  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
};

/** OKLCH → gamma-encoded sRGB, channels rounded to 0–255. */
export const oklchToSrgb = (l: number, c: number, h: number): [number, number, number] => {
  const encode = (channel: number): number =>
    channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
  return linearSrgb({ l, c, h }).map(channel =>
    Math.round(Math.min(1, Math.max(0, encode(channel))) * 255),
  ) as [number, number, number];
};

export const relativeLuminance = (color: Oklch): number => {
  const [r, g, b] = linearSrgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (x: number, y: number): number => {
  const [hi, lo] = x >= y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
};

/** The luminance of `fg` alpha-composited over `bg` in linear light. */
export const compositeLuminance = (fg: Oklch, bg: Oklch, alpha: number): number => {
  const front = linearSrgb(fg);
  const back = linearSrgb(bg);
  const mixed = front.map((channel, i) => alpha * channel + (1 - alpha) * back[i]!);
  return 0.2126 * mixed[0]! + 0.7152 * mixed[1]! + 0.0722 * mixed[2]!;
};

// Every pair is normal-size text on its documented surface → WCAG AA 4.5:1.
// The wash pairs are the DS recipes composited over --background: text-brand on
// bg-brand/10 (light) and bg-brand/15 (dark), and the same wash behind
// brand-muted-foreground (file-output gutter, input focus placeholder).
// The shadcn token pairs every palette defines; a missing one is reported.
const CONTRAST_PAIRS = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["primary-foreground", "primary"],
  ["destructive-foreground", "destructive"],
  ["sidebar-foreground", "sidebar"],
] as const;

// Brand and muted-destructive text tokens, checked wherever a palette defines them.
const OPTIONAL_CONTRAST_PAIRS = [
  ["brand", "background"],
  ["brand-muted-foreground", "background"],
  ["destructive-muted-foreground", "background"],
  ["destructive-muted-foreground", "muted"],
] as const;

const WASH_PAIRS = [
  ["brand", "brand"],
  ["brand-muted-foreground", "brand"],
] as const;

const AA_NORMAL = 4.5;

interface TokenValue extends Oklch {
  readonly index: number;
}

const tokenBlocks = (css: string, selector: ":root" | ".dark"): Map<string, TokenValue> => {
  const tokens = new Map<string, TokenValue>();
  const blockPattern = selector === ":root" ? /:root\s*\{/g : /\.dark\s*\{/g;
  for (const match of css.matchAll(blockPattern)) {
    let depth = 1;
    let close = match.index + match[0].length;
    while (close < css.length && depth > 0) {
      if (css[close] === "{") depth++;
      else if (css[close] === "}") depth--;
      close++;
    }
    const body = css.slice(match.index, close);
    for (const token of body.matchAll(
      /--([a-z0-9-]+)\s*:\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+%?)?\s*\)/g,
    ))
      tokens.set(token[1]!, {
        l: Number(token[2]),
        c: Number(token[3]),
        h: Number(token[4]),
        index: match.index + token.index,
      });
  }
  return tokens;
};

export interface ContrastViolation {
  readonly rule: "token-contrast-aa";
  readonly index: number;
  readonly message: string;
}

export const analyzeContrast = (cssText: string): ContrastViolation[] => {
  const css = blank(cssText, /\/\*[\s\S]*?\*\//g);
  const violations: ContrastViolation[] = [];
  const modes = [
    { name: "light", tokens: tokenBlocks(css, ":root"), wash: 0.1 },
    { name: "dark", tokens: tokenBlocks(css, ".dark"), wash: 0.15 },
  ];
  for (const mode of modes) {
    if (mode.tokens.size === 0) continue;
    const checkPair = (fg: string, bg: string, front: TokenValue, back: TokenValue): void => {
      const ratio = contrastRatio(relativeLuminance(front), relativeLuminance(back));
      if (ratio < AA_NORMAL)
        violations.push({
          rule: "token-contrast-aa",
          index: front.index,
          message: `${fg}/${bg} is ${ratio.toFixed(2)}:1 in ${mode.name} mode, below AA ${AA_NORMAL}:1`,
        });
    };
    for (const [fg, bg] of CONTRAST_PAIRS) {
      const front = mode.tokens.get(fg);
      const back = mode.tokens.get(bg);
      if (!front || !back) {
        violations.push({
          rule: "token-contrast-aa",
          index: (front ?? back)?.index ?? 0,
          message: `missing --${front ? bg : fg} token in the ${mode.name} palette`,
        });
        continue;
      }
      checkPair(fg, bg, front, back);
    }
    for (const [fg, bg] of OPTIONAL_CONTRAST_PAIRS) {
      const front = mode.tokens.get(fg);
      const back = mode.tokens.get(bg);
      if (front && back) checkPair(fg, bg, front, back);
    }
    for (const [fg, washToken] of WASH_PAIRS) {
      const front = mode.tokens.get(fg);
      const washColor = mode.tokens.get(washToken);
      const background = mode.tokens.get("background");
      if (!front || !washColor || !background) continue;
      const ratio = contrastRatio(
        relativeLuminance(front),
        compositeLuminance(washColor, background, mode.wash),
      );
      if (ratio < AA_NORMAL)
        violations.push({
          rule: "token-contrast-aa",
          index: front.index,
          message: `${fg} on the ${washToken}/${mode.wash * 100} wash is ${ratio.toFixed(2)}:1 in ${mode.name} mode, below AA ${AA_NORMAL}:1`,
        });
    }
  }
  return violations;
};

/* ---------------------------------------------------------------------------
   Per-file analysis
   --------------------------------------------------------------------------- */

interface Block {
  readonly content: string;
  readonly start: number;
  readonly contentStart: number;
  readonly end: number;
}

const svelteBlocks = (text: string, tag: "script" | "style"): Block[] => {
  const blocks: Block[] = [];
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  for (const match of text.matchAll(pattern))
    blocks.push({
      content: match[1]!,
      start: match.index,
      contentStart: match.index + match[0].indexOf(match[1]!),
      end: match.index + match[0].length,
    });
  return blocks;
};

export const analyzeFile = (file: string, text: string, ui: UiOptions): readonly UiViolation[] => {
  const { report, violations } = createReporter(text);
  const vendored = ui.vendored.some(folder => file.startsWith(folder));

  if (file.endsWith(".css")) {
    cssRules(
      file,
      blank(text, /\/\*[\s\S]*?\*\//g),
      i => i,
      { boxShadow: false, vendoredTheme: vendored },
      report,
      ui,
    );
    if (file === ui.tokens)
      for (const v of analyzeContrast(text)) report(v.rule, v.index, v.message);
    return violations;
  }

  if (file.endsWith(".ts")) {
    for (const match of text.matchAll(new RegExp(DERIVATION_ALWAYS.source, "g")))
      report("no-runtime-color-derivation", match.index, `derives a color at runtime: ${match[0]}`);
    for (const match of text.matchAll(/color-mix\(/g))
      report("no-runtime-color-derivation", match.index, "color-mix outside the stylesheet");
    return violations;
  }

  const scripts = svelteBlocks(text, "script");
  const styles = svelteBlocks(text, "style");
  for (const style of styles)
    cssRules(
      file,
      blank(style.content, /\/\*[\s\S]*?\*\//g),
      i => style.contentStart + i,
      { boxShadow: !file.startsWith("src/lib/components/ui/"), vendoredTheme: false },
      report,
      ui,
    );
  for (const script of scripts)
    for (const literal of stringLiterals(script.content)) {
      const at = script.contentStart + literal.start;
      classTokenRules(file, tokensOf(literal.value), at, report);
      if (HEX_COLOR.test(literal.value))
        report("no-hex-rgb-color", at, "hex color literal in a string");
      if (/\brgba?\(/.test(literal.value))
        report("no-hex-rgb-color", at, "rgb()/rgba() literal in a string");
      if (DERIVATION_ALWAYS.test(literal.value))
        report("no-runtime-color-derivation", at, "derives a color at runtime");
    }

  let markup = blankRanges(text, [...scripts, ...styles]);
  markup = blank(markup, /<!--[\s\S]*?-->/g);
  const tags = parseTags(markup);
  const tagAt = (index: number): Tag | undefined =>
    tags.find(tag => index >= tag.start && index <= tag.end);
  for (const tag of tags) {
    elementRules(tag.name, tag.classTokens, tag.start, report, ui);
    classTokenRules(file, tag.classTokens, tag.start, report);
    // Non-class attribute literals (overlayProps-style class options land here).
    // Reporting at the tag's first line lets an allowance comment sit above it.
    for (const value of tag.otherLiterals)
      classTokenRules(file, tokensOf(value), tag.start, report);
  }
  for (const match of markup.matchAll(new RegExp(HEX_COLOR.source, "g")))
    report(
      "no-hex-rgb-color",
      tagAt(match.index)?.start ?? match.index,
      `hex color literal ${match[0]}`,
    );
  for (const match of markup.matchAll(/\brgba?\(/g))
    report("no-hex-rgb-color", tagAt(match.index)?.start ?? match.index, "rgb()/rgba() literal");
  for (const match of markup.matchAll(new RegExp(DERIVATION_ALWAYS.source, "g")))
    report(
      "no-runtime-color-derivation",
      tagAt(match.index)?.start ?? match.index,
      `derives a color at runtime: ${match[0]}`,
    );
  return violations;
};
