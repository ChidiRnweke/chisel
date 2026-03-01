---
name: svelte-ui
description: Use when the user wants to build, improve, or review UI in a SvelteKit project. Triggers include: creating a new page, component, or layout; setting up or extending a design system; theming shadcn-svelte or Tailwind; fixing UI that looks bland, generic, or inconsistent; auditing an existing codebase for style drift. Do not trigger for pure logic, routing, server actions, API work, or anything non-visual unless the user explicitly connects it to UI appearance.
---

# SvelteKit UI Skill (Refactored: Style-Repo + UX-first)

Build opinionated, visually distinctive SvelteKit interfaces with a coherent design system underneath.
Not just pretty — consistent, maintainable, accessible, and characterful.

---

## Blueprint

**First action:** ask whether to start coding now or invoke `feature-blueprint` to plan.

If the user wants to build UI immediately, still complete **Phase 0 (Style Commit + Design System)** before writing components.

---

## Phase 0: Lock Visual Direction (Style Commit)

### 0.1 Determine context

- **New UI / new feature** → do Phase 0 fully.
- **Existing project / “make it less generic”** → run **Audit Mode** (later) but still do a Style Commit if none exists.

### 0.2 Style Picker (curated art directions)

Offer the user a constrained choice: **1 Primary style** (+ optional 1 Secondary) + optional **Modifiers**.

> Ask: “Pick **1 primary** style. Optionally add **1 secondary** style and up to **2 modifiers**.”

**Style registry (with reference files):**

| Style                                | What it looks like                                   | Best used for                         | Reference                                                    |
| ------------------------------------ | ---------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| Minimalism / Swiss                   | strict grid, whitespace, typographic hierarchy       | settings, dashboards, “quiet premium” | `references/styles/minimalism-swiss.md`                      |
| Editorial / Typography-led           | big type, rhythm, magazine-like layouts              | content-heavy products, warm brands   | `references/styles/editorial-typography-led.md`              |
| Flat design                          | solid fills, crisp borders, minimal depth            | clarity-first product UIs             | `references/styles/flat-design.md`                           |
| Material Design                      | layered surfaces, consistent elevation, motion rules | app shells, mobile-first              | `references/styles/material-design.md`                       |
| Fluent Design                        | depth + translucency (acrylic), blur, light          | chrome/overlays, modern OS feel       | `references/styles/fluent-design.md`                         |
| Card-based / Modular                 | cards/tiles, reusable blocks, feed/dash patterns     | dashboards, collections               | `references/styles/card-based-modular.md`                    |
| Bento / Panel grid                   | calm boxed sections, varied spans, rhythm            | home hubs, overview pages             | `references/styles/bento-panel-grid.md`                      |
| Glassmorphism (modifier)             | frosted blur panels + glow                           | hero/overlays only                    | `references/styles/glassmorphism.md`                         |
| Neumorphism (modifier)               | soft extruded/pressed surfaces                       | widgets only, risky                   | `references/styles/neumorphism.md`                           |
| Claymorphism / Soft 3D               | puffy shapes, chunky depth                           | playful consumer/onboarding           | `references/styles/claymorphism-soft-3d.md`                  |
| Gradients / Aurora (modifier)        | bold gradients/iridescent backdrops                  | hero/section backdrops                | `references/styles/gradients-aurora.md`                      |
| Skeuomorphism (selective) (modifier) | paper/tape/pins used sparingly                       | editorial pairing, storytelling       | `references/styles/skeuomorphism-selective.md`               |
| Brutalist / Neo-brutalist            | thick borders, loud contrast, raw                    | bold brand statements                 | `references/styles/brutalist-neo-brutalist.md`               |
| Illustration-first / Brand character | custom visuals + friendly voice                      | onboarding/empty states               | `references/styles/illustration-first-brand-character-ui.md` |
| Motion-rich (modifier)               | microinteractions as guidance                        | feedback/orientation layer            | `references/styles/motion-rich-microinteraction-heavy.md`    |

**Important classification rule:**

- **Primary style** defines the _system_ (grid, type, spacing, surfaces).
- **Secondary style** may influence _some_ tokens + select components.
- **Modifiers** are **restricted** to specific zones (hero/overlays/widgets) and must not override UX guardrails.

### 0.3 Mandatory: Style Interview (fast, commitment-driven)

After the user picks styles, ask **at most 4–5 forced-choice questions total** (prioritise the primary style) to eliminate vagueness. Don't ask per-style; pick the highest-leverage unknowns only

Example interview prompts (agent should adapt to chosen styles):

- Editorial: type mood (bookish serif / modern serif / sans-only), layout (single-col reading / magazine 2-col / bento editorial), hierarchy (hero-first / balanced / dense)
- Swiss: density (airy / balanced / compact), separators (rules / whitespace), accent usage (links-only / CTA+focus)
- Fluent/Glass: transparency budget (nav+overlays only / hero too / heavy), fallback (solid mode required?)
- Skeuo: metaphor (paper+tape / notebook / binder tabs), ornament budget (0–1 / 2 / 3 motifs per screen)
- Gradients: where (hero only / section backdrops / subtle accents), palette (2 hues / 3 hues)
- Motion-rich: where (nav transitions / expand-collapse / delight only), reduced-motion (strict / normal)

### 0.4 Produce a Style Application Plan (required output)

Before coding anything, the agent must write a concise plan:

- **Primary style (≈80%)**: what it controls (type, grid, spacing, core components)
- **Secondary style (≈20%)**: what it controls (surfaces, header patterns, select components)
- **Modifiers**: exact placement rules (hero only / overlays only / widgets only)
- **Banned zones** (default): **forms, tables, navigation scaffolding** stay conventional unless explicitly permitted
- **Ornament budget** (if applicable): e.g., “max 2 skeuo motifs per screen”
- **Dark mode**: decide explicitly — `prefers-color-scheme` auto, manual toggle, or light-only. If dark mode is in scope, add a `.dark` variant block to the token file now, not later.

### 0.5 Read style specs (always)

For every chosen style, the agent must open:

- `references/styles/<chosen-style>.md`

The agent must **extract** from each chosen style's spec:

- token defaults,
- do/don’t rules,
- component recipes,
- UX guardrails,
  and incorporate them into the project’s design system + primitives.

---

## Phase 0b: Persist Decisions (always)

Once the user confirms the Style Application Plan, write:

### 1) `DESIGN_SYSTEM.md` (project root)

Must include:

- chosen styles + Style Application Plan
- final palette + typography + spacing + radii + elevation/motion policies
- component conventions + "banned zones" decisions
- ornament budget + any exceptions
- project-specific anti-patterns

### 2) `AGENTS.md` (project root)

Keep short — this file is loaded into every agent context, so don't pollute it with the full design system. It should only point to the right file:

```md
For UI design decisions (tokens, style, components), see @DESIGN_SYSTEM.md.
```

### 3) `CLAUDE.md` (project root)

Short project context + `@AGENTS.md`

### 3) Tokens file

Put tokens at the top of `src/app.css` (or `src/lib/styles/tokens.css`), with a header:

```css
/* ============================================================
   DESIGN SYSTEM TOKENS — see DESIGN_SYSTEM.md for rationale
   ============================================================ */
```

````

---

## Phase 1: Tokens (Design System First)

### 1.1 Token format rule (important)

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

### 1.2 Palette rules (non-negotiable)

- **Brand hues:** **1–3** max (primary + optional accent + optional secondary)
- **Neutrals:** unlimited, but **derived** (warm/cool bias) — no dead #fff/#eee soup
- **States:** define hover/active/focus/error/success; don’t improvise per component

### 1.3 Baseline token scaffold (extend per style)

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

## Phase 2: Tailwind + shadcn-svelte Theming

### 2.1 Tailwind mapping (tokens-first)

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

### 2.2 shadcn-svelte variables (never default)

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

---

## Phase 3: Component Architecture (Primitives enforce style)

### 3.1 File conventions

```
src/lib/components/
├── ui/            # shadcn-svelte generated — don’t hand-edit
├── primitives/    # wrappers that encode tokens + conventions
│   ├── Button.svelte
│   ├── Card.svelte
│   ├── Input.svelte
│   ├── Badge.svelte
│   ├── Text.svelte        # typographic ladder
│   ├── Stack.svelte       # vertical rhythm / spacing
│   ├── Rule.svelte        # editorial rules/dividers
│   └── Panel.svelte       # bento/modular surface blocks
├── layout/
│   ├── PageHeader.svelte
│   ├── Sidebar.svelte
│   ├── EmptyState.svelte
│   └── Skeletons.svelte
└── domain/
    └── feature-specific components...
```

### 3.2 Hard rules (consistency)

- Never use raw `<button>` → always `primitives/Button`
- Never use raw `<input>` → shadcn `Input` via `primitives/Input`
- Never hand-roll spacing ad-hoc → use `Stack` / tokens
- Never use Tailwind default palette as final colors → tokens only
- If a request conflicts with `DESIGN_SYSTEM.md`, **flag it** (don't silently change style)

### 3.3 Style repository integration in primitives

When styles are chosen:

1. read the style spec `.md` files
2. incorporate their rules into:
   - tokens (where appropriate)
   - primitive variants (Button/Card/Panel)
   - layout patterns (PageHeader/EmptyState)

3. keep UX guardrails intact (focus rings, contrast, tap targets)

---

## Phase 4: Svelte 5 + SvelteKit patterns (production-grade)

### 4.1 Svelte 5 runes

Use runes consistently (`$props`, `$state`, `$derived`). Prefer `onclick` etc.

### 4.2 Streaming + skeletons

Prefer streamed promises with **skeleton UIs** that match final layout.

### 4.3 Form actions + progressive enhancement

Prefer SvelteKit actions + `use:enhance`.

---

## Phase 5: UX Guardrails (always on)

Regardless of style:

- **Focus rings** are visible and consistent
- **Contrast** targets AA for text
- **Tap targets** ≥ 44×44px
- **States** exist for hover/active/disabled/error/success
- **Keyboard** navigation works for menus/dialogs/forms
- **Reduced motion** respected (especially if Motion-rich modifier is used)

If a visual effect (glass/neo/skeuo) harms these, it must be limited, toned down, or replaced.

---

## Phase 6: Blandness + Style Drift Audit

When reviewing or improving UI, the agent must audit for:

### 6.1 Generic anti-patterns

- default Tailwind colors/typography
- pure white/gray soup
- inconsistent radii and shadows
- random spacing values
- unthemed shadcn defaults

### 6.2 Style drift (new)

Compare code against `DESIGN_SYSTEM.md`:

- Is the Style Application Plan being followed?
- Are modifiers leaking into banned zones?
- Is ornament budget exceeded?
- Are core primitives bypassed?

When calling it out, be explicit:

> “This screen uses default gray text + blue actions, which conflicts with the locked style + tokens. I’m switching to the token palette and primitive components.”

---

## Audit Mode (Existing Projects)

If the user asks to improve/review an existing codebase:

- Read existing tokens, Tailwind config, shadcn mapping, primitives
- Identify violations + propose a migration plan
- Only then change code incrementally

Use `references/audit.md` for the detailed workflow.

---

## Checklist Before Shipping Any UI

- [ ] Style Application Plan exists in `DESIGN_SYSTEM.md` and matches implementation
- [ ] Tokens are full `hsl()` (or OKLCH) values, not bare triples
- [ ] `@theme inline` block in `app.css` exposes all color/font/radius tokens to Tailwind utilities
- [ ] Alpha variants use `bg-primary/50` syntax — no `<alpha-value>` strings anywhere
- [ ] All colors come from tokens (no Tailwind defaults as final)
- [ ] shadcn variables remapped (no defaults)
- [ ] Typography ladder exists and is used (no random `text-*` choices)
- [ ] No raw `<button>` / `<input>` outside primitives
- [ ] Spacing uses scale + layout helpers (no ad-hoc drift)
- [ ] Loading states are skeletons matching final layout
- [ ] Empty states exist and follow the style rules (and ornament budget)
- [ ] Focus/contrast/tap targets pass UX guardrails
````
