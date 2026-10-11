# Glassmorphism

**Signature:** frosted translucent panels, blur, subtle glow

These notes are meant to be *agent-executable*: they translate a “style” into **tokens + rules + component recipes**.
Assume a token-driven system (CSS variables) and a component library (SvelteKit + Tailwind or similar).

## Token defaults (starting point)

```css
:root {
  /* Glass needs a rich background and strong text contrast */
  --bg: 250 30% 12%;         /* often a dark, saturated backdrop */
  --glass: 0 0% 100% / 0.10; /* translucent */
  --glass-strong: 0 0% 100% / 0.16;
  --text: 0 0% 100%;
  --border: 0 0% 100% / 0.18;
  --accent: 190 95% 55%;

  --radius: 18px;
  --shadow-1: 0 12px 30px hsl(0 0% 0% / 0.35);
}
```
## Rules

### Do
- Use glass panels on top of a gradient/photo background (otherwise it looks pointless).
- Always add a border + blur to define edges.
- Keep glass to key surfaces (nav, hero cards, dialogs).
- Use strong typography and generous spacing to maintain legibility.

### Don’t
- Don’t put long paragraphs or dense tables on glass.
- Don’t stack multiple glass layers; it turns muddy.
- Don’t rely on subtle contrast—glass demands explicit contrast checks.
## Where to apply

**Primary (dominates):**
- Hero areas, navigation overlays, modals, media players, lightweight dashboards

**Secondary (allowed):**
- Secondary cards, pill filters

**Banned / keep neutral:**
- Forms with many fields, detailed data tables, long-form reading
## Component recipes

### Glass card

Blur + border + shadow; text stays bright and high-contrast.

```svelte
<div class="rounded-[var(--radius)] border border-[hsl(var(--border))]
            bg-[hsl(var(--glass-strong))] backdrop-blur-xl shadow-[var(--shadow-1)] p-6">
  <h3 class="text-lg font-semibold text-[hsl(var(--text))]">Now cooking</h3>
  <p class="mt-1 text-sm text-white/75">Timer, steps, and ingredients in one place.</p>
  <button class="mt-4 rounded-[9999px] px-5 py-2 bg-[hsl(var(--accent))] text-black font-semibold">
    Start
  </button>
</div>
```

### Glass nav

Sticky navigation works well with glass if contrast is maintained.

```svelte
<nav class="sticky top-4 mx-auto max-w-6xl px-4">
  <div class="rounded-[9999px] border border-white/15 bg-white/10 backdrop-blur-xl
              shadow-[0_10px_30px_rgba(0,0,0,0.35)] px-4 py-2 flex items-center gap-3">
    <a class="text-white/90 text-sm" href="#">Home</a>
    <a class="text-white/60 text-sm" href="#">Recipes</a>
    <div class="ml-auto">
      <button class="rounded-[9999px] bg-white/15 px-4 py-2 text-sm text-white/90 hover:bg-white/20">Sign in</button>
    </div>
  </div>
</nav>
```
## UX guardrails

-  Provide a solid/opaque fallback using `@supports not (backdrop-filter: blur(1px))` — swap `bg-[hsl(var(--glass-strong))]` for `bg-[hsl(var(--bg))]` and remove `backdrop-blur-*`.
- Keep text contrast ≥ WCAG AA; consider darkening the background behind glass if needed.
- Avoid placing critical inputs on transparent surfaces; use opaque form panels.
## Blending guidance

- Glass works best as an **accent layer** on top of a strong background (often Gradients/Aurora).
- If you blend with Fluent, pick one: acrylic OR glass; don’t double-blur.
