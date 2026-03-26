# Brutalist / Neo-brutalist

**Signature:** raw/high-contrast, thick borders, loud colors

These notes are meant to be *agent-executable*: they translate a “style” into **tokens + rules + component recipes**.
Assume a token-driven system (CSS variables) and a component library (SvelteKit + Tailwind or similar).

## Token defaults (starting point)

```css
:root {
  /* Neo-brutalist: loud contrast, thick borders, simple shapes */
  --surface: 60 100% 98%;
  --text: 0 0% 6%;
  --primary: 240 100% 50%;
  --accent: 50 100% 50%;
  --border: 0 0% 8%;

  --radius: 10px; /* keep shapes chunky, not delicate */
  --border-width: 2px;
  --shadow-hard: 6px 6px 0 hsl(var(--border));
}
```
## Rules

### Do
- Use thick outlines, hard drop shadows, and bold type.
- Keep layouts simple and geometric; embrace imperfection intentionally.
- Use high-contrast color blocking with 1–2 loud accents max.
- Make primary actions unmistakable (big, loud buttons).

### Don’t
- Don’t use subtle shadows or low-contrast gray UI.
- Don’t add glass blur or soft gradients; it fights the language.
- Don’t overuse typefaces; 1–2 weights are enough when contrast is high.
## Where to apply

**Primary (dominates):**
- Marketing pages, creator tools, playful consumer products, event/launch microsites

**Secondary (allowed):**
- Dashboards if data is not too dense (chunky modules)

**Banned / keep neutral:**
- Medical/finance/enterprise contexts where calmness is required
## Component recipes

### Neo-brutalist button

Chunky border + hard shadow; press state reduces shadow.

```svelte
<button
  class="rounded-[var(--radius)] border-[length:var(--border-width)] border-[hsl(var(--border))]
         bg-[hsl(var(--primary))] text-white px-5 py-2.5 font-extrabold
         shadow-[var(--shadow-hard)]
         active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_hsl(var(--border))]
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]">
  Publish
</button>
```

### Card

Color-blocked panel with thick border; minimal internal styling.

```svelte
<section class="rounded-[var(--radius)] border-[length:var(--border-width)] border-[hsl(var(--border))]
                bg-[hsl(var(--surface))] p-6 shadow-[var(--shadow-hard)]">
  <h3 class="text-xl font-black">Your week</h3>
  <p class="mt-2 text-sm font-semibold">3 meals planned • 2 items expiring</p>
</section>
```

### Input

Inputs should be loud and legible; avoid subtle placeholder-only labeling.

```svelte
<label class="block">
  <span class="text-sm font-black">Search</span>
  <input class="mt-2 w-full rounded-[var(--radius)]
               border-[length:var(--border-width)] border-[hsl(var(--border))]
               bg-white px-3 py-2.5 text-base
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]"
         placeholder="Type…" />
</label>
```
## UX guardrails

- High contrast is good, but keep spacing generous to reduce fatigue.
- Ensure error/warning colors remain distinguishable (don’t rely on one loud accent).
- Don’t sacrifice form labeling or hierarchy for “rawness”.
## Blending guidance

- Neo-brutalism is a **dominant** style — if it's primary, it controls borders, shadows, and color blocking.
- The one safe blend: use **Flat design** as a base and apply neo-brutalist treatment only to hero and CTAs. Keep data regions flat.
