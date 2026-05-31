# Tokens and Theming

## Table of Contents
- [Phase 3: Tokens (Design System First)](#phase-3-tokens-design-system-first)
  - [3.1 Token format rule (important)](#31-token-format-rule-important)
  - [3.2 Palette rules (non-negotiable)](#32-palette-rules-non-negotiable)
  - [3.3 Baseline token scaffold (extend per style)](#33-baseline-token-scaffold-extend-per-style)
- [Phase 4: Tailwind + shadcn-svelte Theming](#phase-4-tailwind--shadcn-svelte-theming)
  - [4.1 Tailwind mapping (tokens-first)](#41-tailwind-mapping-tokens-first)
  - [4.2 shadcn-svelte variables (never default)](#42-shadcn-svelte-variables-never-default)

## Phase 3: Tokens (Design System First)

### 3.1 Token format rule (important)

**Store full `hsl()` values** (not bare HSL triples). Tailwind v4 uses `@theme inline` which reads CSS variables at runtime — it needs resolvable color values, not raw triples. Alpha variants are handled by the `bg-primary/50` utility syntax (no `<alpha-value>` hack needed).

✅ good:

```css
--color-primary: hsl(142 40% 28%);
```

❌ avoid:

```css
--color-primary: 142 40% 28%; /* bare triple — broken with @theme inline */
```

> **Tip:** OKLCH is also valid and provides better perceptual uniformity (`oklch(35% 0.08 142)`). Use it if the team is comfortable with it.

### 3.2 Palette rules (non-negotiable)

- **Brand hues:** **1–3** max (primary + optional accent + optional secondary)
- **Neutrals:** unlimited, but **derived** (warm/cool bias) — no dead #fff/#eee soup
- **States:** define hover/active/focus/error/success; don’t improvise per component

### 3.3 Baseline token scaffold (extend per style)

Agent must generate a full set, at minimum:

```css
:root {
  /* Brand colors */
  --color-primary: hsl(142 40% 28%);
  --color-accent: hsl(38 90% 52%);
  --color-accent-fg: hsl(30 10% 10%);

  /* Neutrals */
  --color-surface: hsl(45 20% 97%);
  --color-surface-2: hsl(45 15% 93%);
  --color-surface-3: hsl(45 12% 87%);
  --color-border: hsl(45 10% 82%);
  --color-text: hsl(30 10% 15%);
  --color-text-muted: hsl(30 8% 45%);

  /* Semantic */
  --color-danger: hsl(0 65% 50%);
  --color-warning: hsl(38 90% 50%);
  --color-success: hsl(142 45% 40%);

  /* Typography */
  --font-display: "Fraunces", ui-serif, Georgia, serif;
  --font-body: "DM Sans", ui-sans-serif, system-ui;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.5625rem;
  --text-2xl: 1.953rem;
  --text-3xl: 2.441rem;
  --text-4xl: 3.052rem;

  --leading-tight: 1.2;
  --leading-snug: 1.35;
  --leading-normal: 1.5;
  --leading-relaxed: 1.65;

  --tracking-tight: -0.02em;
  --tracking-normal: 0em;
  --tracking-wide: 0.06em;
  --tracking-wider: 0.12em;

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-20: 5rem;
  --space-24: 6rem;

  --page-padding: var(--space-6);
  --card-padding: var(--space-5);
  --section-gap: var(--space-16);
  --stack-gap: var(--space-4);

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Elevation (style-specific) */
  --shadow-sm: 0 1px 2px hsl(0 0% 0% / 0.06);
  --shadow-md: 0 4px 12px hsl(0 0% 0% / 0.08);
  --shadow-lg: 0 8px 24px hsl(0 0% 0% / 0.1);
  --shadow-card:
    0 2px 8px hsl(0 0% 0% / 0.06), 0 0 0 1px var(--color-border);
}
```

**Anti-patterns to call out and fix (always):**

- default Tailwind blue as primary → generic
- pure white backgrounds by default → sterile
- random “mt-3 p-2 rounded-md” sprinkled everywhere → no system
- more than 3 brand hues → incoherent
- no explicit focus style → accessibility failure

---

## Phase 4: Tailwind + shadcn-svelte Theming

### 4.1 Tailwind mapping (tokens-first)

Tailwind v4 is **CSS-first** — no `tailwind.config.js`. Add an `@theme inline` block in `src/app.css` (after the `:root` token block) to expose tokens as Tailwind utilities:

```css
/* src/app.css */
@import "tailwindcss";

/* ... :root token block above ... */

@theme inline {
  /* Colors → bg-primary, text-primary, border-primary, ring-primary, etc.
     Alpha variants work automatically: bg-primary/50 */
  --color-primary: var(--color-primary);
  --color-accent: var(--color-accent);
  --color-surface: var(--color-surface);
  --color-surface-2: var(--color-surface-2);
  --color-surface-3: var(--color-surface-3);
  --color-text: var(--color-text);
  --color-text-muted: var(--color-text-muted);
  --color-border: var(--color-border);
  --color-danger: var(--color-danger);
  --color-warning: var(--color-warning);
  --color-success: var(--color-success);

  /* Fonts → font-display, font-body, font-mono */
  --font-display: var(--font-display);
  --font-body: var(--font-body);
  --font-mono: var(--font-mono);

  /* Radius → rounded-sm, rounded-md, rounded-lg, rounded-xl */
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-xl: var(--radius-xl);
}
```

> **No `content:` config needed** — Tailwind v4 detects source files automatically.

### 4.2 shadcn-svelte variables (never default)

Set shadcn semantic vars to your tokens (triples):

```css
:root {
  --background: var(--color-surface);
  --foreground: var(--color-text);

  --card: var(--color-surface-2);
  --card-foreground: var(--color-text);

  --primary: var(--color-primary);
  --primary-foreground: hsl(0 0% 100%);

  --secondary: var(--color-surface-3);
  --secondary-foreground: var(--color-text);

  --muted: var(--color-surface-2);
  --muted-foreground: var(--color-text-muted);

  --accent: var(--color-accent);
  --accent-foreground: var(--color-accent-fg);

  --destructive: var(--color-danger);
  --border: var(--color-border);

  --radius: var(--radius-md);
}
```