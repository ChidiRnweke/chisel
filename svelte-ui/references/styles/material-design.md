# Material Design

**Signature:** layered surfaces, consistent elevation, motion rules

These notes are meant to be *agent-executable*: they translate a “style” into **tokens + rules + component recipes**.
Assume a token-driven system (CSS variables) and a component library (SvelteKit + Tailwind or similar).

## Token defaults (starting point)

```css
:root {
  /* Material is an elevation + motion system */
  --surface: 210 20% 98%;
  --surface-1: 0 0% 100%;
  --text: 210 15% 12%;
  --primary: 265 85% 55%;
  --primary-fg: 0 0% 100%;

  --radius: 12px;
  --elev-0: none;
  --elev-1: 0 1px 2px hsl(0 0% 0% / 0.14), 0 1px 3px hsl(0 0% 0% / 0.10);
  --elev-2: 0 6px 12px hsl(0 0% 0% / 0.14), 0 2px 4px hsl(0 0% 0% / 0.10);
  --elev-3: 0 12px 24px hsl(0 0% 0% / 0.16), 0 4px 8px hsl(0 0% 0% / 0.12);
}
```
## Rules

### Do
- Define a small set of elevation levels and use them consistently.
- Use motion to explain causality (menus originate from triggers, dialogs from center).
- Prefer filled/tonal buttons with clear states; keep components rounded and touch-friendly.
- Use surface layering to separate regions (app bar, content, cards).

### Don’t
- Don’t invent random shadows per component.
- Don’t use elevation everywhere—most content stays at elev-0/1.
- Don’t animate for decoration; animate for understanding and feedback.
## Where to apply

**Primary (dominates):**
- App shells, dashboards, mobile-first products, component libraries

**Secondary (allowed):**
- Dialog/popover layers, cards, floating actions

**Banned / keep neutral:**
- Skeuo textures, harsh neo-brutalist borders
## Component recipes

### Card with elevation

Elevation communicates grouping and clickability.

```svelte
<div class="rounded-[var(--radius)] bg-[hsl(var(--surface-1))]
            shadow-[var(--elev-1)] hover:shadow-[var(--elev-2)]
            transition-shadow p-5">
  <h3 class="text-base font-semibold">Suggested actions</h3>
  <p class="mt-1 text-sm text-[hsl(var(--text)/0.7)]">Quickly add items you buy often.</p>
</div>
```

### Filled button

Material-style primary action: filled, high contrast.

```svelte
<button class="rounded-[9999px] px-5 py-2.5 text-sm font-semibold
                bg-[hsl(var(--primary))] text-[hsl(var(--primary-fg))]
                hover:bg-[hsl(var(--primary)/0.92)] active:bg-[hsl(var(--primary)/0.84)]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]">
  Add item
</button>
```

### Dialog / overlay layer

Modal uses higher elevation and clear scrim.

```svelte
<div class="fixed inset-0 bg-black/35 grid place-items-center">
  <div class="w-[min(28rem,90vw)] rounded-[var(--radius)]
              bg-[hsl(var(--surface-1))] shadow-[var(--elev-3)] p-6">
    <h2 class="text-lg font-semibold">Rename list</h2>
    <p class="mt-2 text-sm text-[hsl(var(--text)/0.7)]">This changes the label everywhere.</p>
    <div class="mt-5 flex justify-end gap-2">
      <button class="px-4 py-2 rounded-[9999px]">Cancel</button>
      <button class="px-4 py-2 rounded-[9999px] bg-[hsl(var(--primary))] text-white">Save</button>
    </div>
  </div>
</div>
```
## UX guardrails

- Elevation must map to interaction: clickable surfaces elevate on hover/press.
- Touch targets and spacing should be generous (mobile-friendly by default).
- Motion must respect reduced-motion preferences; keep durations short (150–250ms).
## Blending guidance

- If blending with **Editorial**, keep Material elevations but swap typography + surfaces.
- Avoid combining with **Glassmorphism** unless glass is limited to overlays only.
