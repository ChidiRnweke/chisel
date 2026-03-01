# Minimalism / Swiss

**Signature:** strict grid, whitespace, typographic hierarchy

These notes are meant to be *agent-executable*: they translate a “style” into **tokens + rules + component recipes**.
Assume a token-driven system (CSS variables) and a component library (SvelteKit + Tailwind or similar).

## Token defaults (starting point)

```css
:root {
  /* Color: largely neutral; use ONE accent */
  --accent: 210 90% 45%;
  --surface: 0 0% 100%;
  --surface-2: 0 0% 98%;
  --text: 210 10% 12%;
  --border: 210 12% 88%;

  /* Type: hierarchy is the design */
  --font-display: ui-sans-serif, system-ui;
  --font-body: ui-sans-serif, system-ui;
  --tracking-display: -0.02em;

  /* Shape: quiet */
  --radius: 8px;
  --border-width: 1px;
  --shadow-1: none;

  /* Layout rhythm */
  --space-1: 0.25rem; /* 4px */
  --space-2: 0.5rem;  /* 8px */
  --space-4: 1rem;    /* 16px */
  --space-8: 2rem;    /* 32px */
  --gutter: var(--space-8);
  --max-width: 72rem;
}
```
## Rules

### Do
- Use a strict grid; align baselines and edges obsessively.
- Let whitespace do the work; reduce decorative containers.
- Use typographic contrast (size/weight/spacing), not shadows.
- Prefer hairline borders and 1–2 neutral surfaces.
- Use the accent color sparingly (links, primary CTA, focus).

### Don’t
- Don’t add gradients, glows, or heavy shadows.
- Don’t mix multiple accent hues.
- Don’t round everything differently—pick a single radius family.
- Don’t rely on icons to communicate hierarchy; use headings.
## Where to apply

**Primary (dominates):**
- Page layout, spacing, typography, tables, settings screens

**Secondary (allowed):**
- Buttons/links, small dividers, subtle section backgrounds

**Banned / keep neutral:**
- Ornamental textures, faux materials, noisy backgrounds
## Component recipes

### Button

Crisp, mostly-outline. Accent only for primary action.

```svelte
<button
  class="inline-flex items-center gap-2 rounded-[var(--radius)]
         border border-[hsl(var(--border))]
         px-4 py-2 text-[0.95rem] font-medium
         bg-[hsl(var(--surface))] text-[hsl(var(--text))]
         hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none
         focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]">
  Save
</button>
```

### Card / Section

Often unnecessary—use it only to group content; keep it flat.

```svelte
<section
  class="rounded-[var(--radius)]
         border border-[hsl(var(--border))]
         bg-[hsl(var(--surface))]
         p-6">
  <h2 class="text-xl font-semibold tracking-[var(--tracking-display)]">Billing</h2>
  <p class="mt-2 text-sm text-[hsl(var(--text)/0.7)]">Manage invoices and payment method.</p>
</section>
```

### Table header

Lean on alignment and spacing rather than colored fills.

```svelte
<div class="flex items-baseline justify-between border-b border-[hsl(var(--border))] pb-3">
  <h3 class="text-lg font-semibold">Invoices</h3>
  <a class="text-sm underline decoration-[hsl(var(--accent))] underline-offset-4" href="#">Export</a>
</div>
```
## UX guardrails

- High contrast text; don’t make “subtle” equal “low contrast”.
- Focus ring must be obvious (accent ring).
- Minimum tap target: 44×44px; use padding, not bigger fonts.
- If a screen feels empty, add structure (headings/dividers), not ornament.
## Blending guidance

- Works well as a **base system** with almost any secondary style.
- If blending, keep Swiss rules for grid/type and let secondary style touch only surfaces/hero.
