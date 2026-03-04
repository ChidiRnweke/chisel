# Card-based / Modular

## Table of Contents

- [Token defaults (starting point)](#token-defaults-starting-point)
- [Rules](#rules)
  - [Do](#do)
  - [Don’t](#dont)
- [Where to apply](#where-to-apply)
- [Component recipes](#component-recipes)
  - [Standard card](#standard-card)
  - [Interactive card](#interactive-card)
- [UX guardrails](#ux-guardrails)
- [Blending guidance](#blending-guidance)

**Signature:** tiles/cards, reusable blocks, feed/dashboard-friendly

These notes are meant to be *agent-executable*: they translate a “style” into **tokens + rules + component recipes**.
Assume a token-driven system (CSS variables) and a component library (SvelteKit + Tailwind or similar).

## Token defaults (starting point)

```css
:root {
  /* Modular UIs depend on consistent card anatomy */
  --surface: 210 20% 98%;
  --card: 0 0% 100%;
  --text: 210 15% 12%;
  --border: 210 18% 86%;
  --accent: 220 85% 52%;

  --radius: 14px;
  --shadow-card: 0 2px 10px hsl(0 0% 0% / 0.08);
  --card-padding: 1.25rem; /* 20px */
  --card-gap: 1rem;       /* 16px */
}
```
## Rules

### Do
- Define a standard card anatomy: header, body, footer/actions.
- Keep card padding consistent; vary only in rare “hero cards”.
- Use a responsive grid; cards reflow cleanly to 1 column.
- Use clear component variants (default, interactive, warning).

### Don’t
- Don’t make every card a different shape or shadow.
- Don’t hide key actions in hover-only controls on mobile.
- Don’t over-nest cards (card-in-card) unless visually separated.
## Where to apply

**Primary (dominates):**
- Dashboards, collections, feeds, settings modules

**Secondary (allowed):**
- Marketing feature grids, onboarding steps

**Banned / keep neutral:**
- Long reading pages where a single column is better
## Component recipes

### Standard card

Card anatomy with consistent padding + border/shadow.

```svelte
<article class="rounded-[var(--radius)] bg-[hsl(var(--card))]
                border border-[hsl(var(--border))]
                shadow-[var(--shadow-card)] p-[var(--card-padding)]">
  <header class="flex items-start justify-between gap-3">
    <div>
      <h3 class="text-base font-semibold">Inventory</h3>
      <p class="mt-1 text-sm text-[hsl(var(--text)/0.7)]">38 items tracked</p>
    </div>
    <button class="rounded-[10px] px-3 py-1.5 text-sm border border-[hsl(var(--border))] hover:bg-black/5">
      Manage
    </button>
  </header>

  <div class="mt-4 h-px bg-[hsl(var(--border))]" />

  <div class="mt-4 grid gap-2">
    <div class="flex justify-between text-sm"><span>Used this week</span><span class="font-medium">12</span></div>
    <div class="flex justify-between text-sm"><span>Expiring soon</span><span class="font-medium">3</span></div>
  </div>
</article>
```

### Interactive card

Make clickability obvious: hover elevation + focus ring.

```svelte
<a href="#"
  class="block rounded-[var(--radius)] bg-[hsl(var(--card))]
         border border-[hsl(var(--border))]
         p-[var(--card-padding)] shadow-[var(--shadow-card)]
         hover:-translate-y-0.5 hover:shadow-[0_10px_30px_hsl(0_0%_0%_/0.12)]
         transition will-change-transform
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]">
  <h3 class="text-base font-semibold">Add your first list</h3>
  <p class="mt-1 text-sm text-[hsl(var(--text)/0.7)]">Keep pantry, freezer, and staples separate.</p>
</a>
```
## UX guardrails

- Cards must remain scannable: title + 1–2 key facts visible above the fold.
- Interactive cards need keyboard focus styling and a clear click target.
- Don’t put critical actions only in overflow menus—surface them in the footer/header.
## Blending guidance

- Card-based is often a **layout pattern**, not a visual style—pair it with Editorial/Swiss/Fluent for personality.
- If you mix with Skeuo/Glass, apply those effects to card surfaces only, not the entire layout.
