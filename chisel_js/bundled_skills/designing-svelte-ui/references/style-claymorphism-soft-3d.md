# Claymorphism / Soft 3D

**Signature:** puffy elements, chunky depth, toy-like UI

These notes are meant to be *agent-executable*: they translate a “style” into **tokens + rules + component recipes**.
Assume a token-driven system (CSS variables) and a component library (SvelteKit + Tailwind or similar).

## Token defaults (starting point)

```css
:root {
  /* Claymorphism: chunky depth + soft, puffy shapes */
  --surface: 45 25% 97%;
  --text: 30 12% 14%;
  --primary: 330 85% 58%;
  --primary-fg: 0 0% 100%;

  --radius: 20px;
  --shadow-clay: 0 14px 0 hsl(0 0% 0% / 0.10), 0 22px 40px hsl(0 0% 0% / 0.14);
  --border: 30 12% 80%;
}
```
## Rules

### Do
- Use thick, friendly shapes with obvious depth.
- Keep layouts simple; clay visuals are already loud.
- Reserve clay for primary CTAs and key cards; keep secondary UI flatter.

### Don’t
- Don’t apply clay shadows to every element (visual fatigue).
- Don’t use tiny type; clay wants bold typography.
- Don’t mix with neo-brutalist borders; pick one “loud” language.
## Where to apply

**Primary (dominates):**
- Kids/consumer apps, playful onboarding, marketing-focused flows

**Secondary (allowed):**
- Hero cards, primary CTAs, empty states

**Banned / keep neutral:**
- Dense admin dashboards, data-heavy tables, long settings pages
## Component recipes

### Clay CTA button

Chunky shadow and big radius; clear hover/active press.

```svelte
<button
  class="rounded-[var(--radius)] px-6 py-3 text-base font-bold
         bg-[hsl(var(--primary))] text-[hsl(var(--primary-fg))]
         shadow-[var(--shadow-clay)]
         hover:-translate-y-0.5 active:translate-y-0
         transition-transform
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]">
  Get started
</button>
```

### Clay card

Use clay depth on feature cards; keep content short.

```svelte
<div class="rounded-[var(--radius)] border border-[hsl(var(--border))]
            bg-[hsl(var(--surface))] shadow-[var(--shadow-clay)] p-6">
  <h3 class="text-xl font-extrabold">Welcome kit</h3>
  <p class="mt-2 text-sm text-[hsl(var(--text)/0.75)]">Set up your lists in under a minute.</p>
</div>
```
## UX guardrails

- Avoid motion sickness: limit bouncy animations; keep transitions short.
- Ensure focus rings are visible despite thick shadows.
- Use clay for *meaningful emphasis* (primary action), not decoration.
## Blending guidance

- Clay pairs well with Illustration-first; both are playful.
- If blending with Editorial, keep Editorial type/layout and use clay only for CTAs.
