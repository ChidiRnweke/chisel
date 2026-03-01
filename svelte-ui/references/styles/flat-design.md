# Flat design

**Signature:** simple shapes, solid fills, minimal depth

These notes are meant to be *agent-executable*: they translate a “style” into **tokens + rules + component recipes**.
Assume a token-driven system (CSS variables) and a component library (SvelteKit + Tailwind or similar).

## Token defaults (starting point)

```css
:root {
  /* Flat = 2D surfaces; contrast + color do the work */
  --surface: 0 0% 100%;
  --surface-2: 210 20% 98%;
  --text: 210 15% 12%;
  --border: 210 16% 86%;
  --primary: 220 85% 52%;
  --primary-fg: 0 0% 100%;

  --radius: 10px;
  --shadow-1: none;
  --border-width: 1px;
}
```
## Rules

### Do
- Use solid fills and crisp borders; avoid drop shadows.
- Communicate hierarchy with size/weight/spacing and color blocks.
- Use clear iconography with consistent stroke/weight.
- Define strong interactive states (hover/active/focus) using color shifts.

### Don’t
- Don’t rely on subtle shadows for affordance.
- Don’t use gradients/glows—flat means flat.
- Don’t use low-contrast “subtle” buttons; flat needs clarity.
## Where to apply

**Primary (dominates):**
- Core product UIs, admin screens, dashboards where clarity > vibe

**Secondary (allowed):**
- Marketing pages as a base; illustration can layer on top

**Banned / keep neutral:**
- Neumorphic depth tricks, glass blur layers
## Component recipes

### Primary button

Solid fill, no shadows. States are color-driven.

```svelte
<button
  class="rounded-[var(--radius)] px-4 py-2 text-sm font-semibold
         bg-[hsl(var(--primary))] text-[hsl(var(--primary-fg))]
         hover:bg-[hsl(var(--primary)/0.9)] active:bg-[hsl(var(--primary)/0.82)]
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]">
  Continue
</button>
```

### Secondary button

Outline + text; stays crisp.

```svelte
<button
  class="rounded-[var(--radius)] px-4 py-2 text-sm font-semibold
         border border-[hsl(var(--border))] bg-[hsl(var(--surface))]
         text-[hsl(var(--text))] hover:bg-[hsl(var(--surface-2))]
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]">
  Cancel
</button>
```

### Card

Use a subtle alternate surface, not elevation.

```svelte
<div class="rounded-[var(--radius)] border border-[hsl(var(--border))]
            bg-[hsl(var(--surface-2))] p-5">
  <h3 class="text-base font-semibold text-[hsl(var(--text))]">Usage</h3>
  <p class="mt-1 text-sm text-[hsl(var(--text)/0.7)]">You’ve used 38% this month.</p>
</div>
```
## UX guardrails

- Flat UIs must have explicit focus rings and hover/active states.
- Use at least two distinct button treatments (primary vs secondary).
- Don’t collapse everything into one neutral surface—grouping still matters.
## Blending guidance

- Great as a base when your secondary style adds character (Editorial, Illustration-first).
- If you want “flat but premium”, add stronger typography and spacing—not shadows.
