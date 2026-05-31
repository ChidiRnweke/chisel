# Gradients / Aurora

**Signature:** bold gradients, iridescent backgrounds, vivid accents

These notes are meant to be *agent-executable*: they translate a “style” into **tokens + rules + component recipes**.
Assume a token-driven system (CSS variables) and a component library (SvelteKit + Tailwind or similar).

## Token defaults (starting point)

```css
:root {
  /* Aurora: gradients are the background, not the component */
  --surface: 0 0% 100%;
  --text: 210 15% 12%;
  --accent: 190 95% 55%;
  --accent-2: 280 90% 60%;

  /* Aurora gradient (used only on backgrounds/heroes) */
  --gradient-aurora: linear-gradient(
    135deg,
    hsl(var(--accent) / 0.25),
    hsl(var(--accent-2) / 0.20)
  );
  --radius: 16px;
  --shadow-1: 0 12px 30px hsl(0 0% 0% / 0.10);
}
```
## Rules

### Do
- Use gradients primarily on backgrounds, hero sections, and highlights.
- Keep content surfaces opaque/solid to preserve readability.
- Use gradients as a *directional light* (top-left → bottom-right).
- Keep palette tight: 2–3 related hues max.

### Don’t
- Don’t put gradients inside form fields or data tables.
- Don’t use multi-color rainbow gradients.
- Don’t combine gradient backgrounds with heavy drop shadows everywhere.
## Where to apply

**Primary (dominates):**
- Hero/landing areas, headers, empty states, subtle section separators

**Secondary (allowed):**
- Small accents (badges, progress), subtle borders

**Banned / keep neutral:**
- Core UI surfaces for reading/data entry
## Component recipes

### Aurora background section

Gradient behind; content on solid surfaces.

```svelte
<section class="relative overflow-hidden rounded-[24px] p-8">
<div class="absolute inset-0" style="background: var(--gradient-aurora)" />
  <div class="relative rounded-[16px] bg-[hsl(var(--surface))] shadow-[var(--shadow-1)] p-6">
    <h2 class="text-2xl font-semibold text-[hsl(var(--text))]">Plan your week</h2>
    <p class="mt-2 text-sm text-[hsl(var(--text)/0.7)]">Build menus from what you already have.</p>
    <button class="mt-4 rounded-[9999px] px-5 py-2 bg-[hsl(var(--accent))] text-black font-semibold">Try it</button>
  </div>
</section>
```

### Gradient badge

Use tiny gradients as accent, not as a main UI surface.

```svelte
<span class="inline-flex items-center rounded-[9999px] px-3 py-1 text-xs font-semibold
             bg-gradient-to-r from-cyan-500/30 to-violet-500/30 border border-black/10">
  New
</span>
```
## UX guardrails

- Contrast-check text against any gradient; prefer placing text on solid cards.
- Provide reduced-transparency/flat fallback if gradients are too strong.
- Keep gradients static or subtly animated only if motion is non-distracting.
## Blending guidance

- Best paired with **Glassmorphism** (glass panels over aurora) OR with **Swiss/Flat** (solid content over gradient).
- If blending with Editorial, keep gradients out of reading surfaces—use them as section backdrops.
