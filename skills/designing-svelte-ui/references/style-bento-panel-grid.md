# Bento / Panel grid

**Signature:** neat boxed sections, rounded rectangles, “dashboard calm”

These notes are meant to be *agent-executable*: they translate a “style” into **tokens + rules + component recipes**.
Assume a token-driven system (CSS variables) and a component library (SvelteKit + Tailwind or similar).

## Token defaults (starting point)

```css
:root {
  /* Bento = calm panels with consistent rounding and spacing */
  --surface: 210 25% 98%;
  --panel: 0 0% 100%;
  --text: 210 15% 12%;
  --border: 210 18% 88%;
  --accent: 220 85% 52%;

  --radius: 18px;
  --panel-padding: 1.5rem; /* 24px */
  --shadow-panel: 0 1px 2px hsl(0 0% 0% / 0.06), 0 0 0 1px hsl(var(--border));
}
```
## Rules

### Do
- Use a grid with varied panel sizes (1×1, 2×1, 2×2) but consistent gaps.
- Keep panels calm: light borders, subtle shadow, generous padding.
- Use icons or small visuals as anchors in each panel header.
- Establish a clear reading order (top-left → bottom-right).

### Don’t
- Don’t mix many competing backgrounds inside panels.
- Don’t let panel padding drift per component.
- Don’t create irregular gap sizes; bento depends on rhythm.
## Where to apply

**Primary (dominates):**
- Dashboards, home screens, settings hubs, overview pages

**Secondary (allowed):**
- Marketing feature sections with “tiles”

**Banned / keep neutral:**
- Dense, row-based data tables without enough width
## Component recipes

### Bento grid container

Use a responsive grid with consistent gaps; vary spans.

```svelte
<div class="grid gap-4 md:grid-cols-12">
  <section class="md:col-span-7 rounded-[var(--radius)] bg-[hsl(var(--panel))]
                 shadow-[var(--shadow-panel)] p-[var(--panel-padding)]">
    <h3 class="text-base font-semibold">Today</h3>
    <p class="mt-1 text-sm text-[hsl(var(--text)/0.7)]">3 items expiring soon.</p>
  </section>

  <section class="md:col-span-5 rounded-[var(--radius)] bg-[hsl(var(--panel))]
                 shadow-[var(--shadow-panel)] p-[var(--panel-padding)]">
    <h3 class="text-base font-semibold">Quick add</h3>
    <button class="mt-4 rounded-[12px] px-4 py-2 bg-[hsl(var(--accent))] text-white">Scan receipt</button>
  </section>
</div>
```

### Panel header pattern

Small icon + title + meta is the bento signature.

```svelte
<header class="flex items-start gap-3">
  <div class="h-9 w-9 rounded-[12px] bg-black/5 grid place-items-center">◎</div>
  <div>
    <h3 class="text-base font-semibold">Lists</h3>
    <p class="text-sm text-[hsl(var(--text)/0.7)]">Pantry • Freezer • Staples</p>
  </div>
</header>
```
## UX guardrails

- Maintain consistent gaps and padding to preserve calmness.
- Panels should have one primary action at most; avoid clutter.
- On mobile, collapse to single column with the same panel spacing.
## Blending guidance

- Bento is a structure—combine with Fluent (acrylic) or Swiss (type) for distinctiveness.
- Avoid adding both Bento + heavy Skeuo across all panels; keep skeuo to 1–2 panels.
