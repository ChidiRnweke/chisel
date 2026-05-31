# Illustration-first / Brand character UI

**Signature:** playful visuals, friendly microcopy, distinct personality

These notes are meant to be *agent-executable*: they translate a “style” into **tokens + rules + component recipes**.
Assume a token-driven system (CSS variables) and a component library (SvelteKit + Tailwind or similar).

## Token defaults (starting point)

```css
:root {
  /* Illustration-first: UI is a stage for custom visuals and voice */
  --surface: 45 25% 97%;
  --surface-2: 45 22% 93%;
  --text: 30 10% 14%;
  --primary: 155 55% 35%;
  --accent: 38 90% 52%;
  --border: 45 12% 82%;

  --radius: 16px;
  --shadow-1: 0 6px 18px hsl(0 0% 0% / 0.10);
}
```
## Rules

### Do
- Design an illustration/icon style guide (stroke, fill, corners, shading).
- Reserve illustration for key moments: onboarding, empty states, success states.
- Match microcopy tone to visuals (warm, specific, human).
- Keep core components consistent; illustrations sit *around* them.

### Don’t
- Don’t scatter random illustrations everywhere; it becomes noise.
- Don’t mix mismatched icon styles (outline + 3D + emoji).
- Don’t let illustrations push important CTAs below the fold.
## Where to apply

**Primary (dominates):**
- Onboarding, empty states, success/celebration moments, marketing pages

**Secondary (allowed):**
- Section headers, help tips, lightweight dashboards

**Banned / keep neutral:**
- Dense settings where visuals distract from task completion
## Component recipes

### Empty state with illustration slot

Illustration + headline + explanation + CTA (classic pattern).

```svelte
<div class="rounded-[var(--radius)] border border-[hsl(var(--border))]
            bg-[hsl(var(--surface))] p-8 text-center shadow-[var(--shadow-1)]">
  <div class="mx-auto h-28 w-28 rounded-[24px] bg-[hsl(var(--surface-2))] grid place-items-center">
    <!-- Replace with your SVG illustration -->
    <span class="text-3xl">🥕</span>
  </div>
  <h3 class="mt-5 text-xl font-semibold">Your pantry is empty</h3>
  <p class="mt-2 text-sm text-[hsl(var(--text)/0.75)] max-w-sm mx-auto">
    Add a few staples and we’ll start suggesting meals you can make.
  </p>
  <button class="mt-5 rounded-[9999px] px-6 py-2.5 bg-[hsl(var(--accent))] text-[hsl(var(--text))] font-semibold">
    Add staples
  </button>
</div>
```

### Tip callout

Small character element + helpful copy (keeps UX supportive).

```svelte
<aside class="flex gap-3 rounded-[var(--radius)] border border-[hsl(var(--border))]
             bg-[hsl(var(--surface-2))] p-4">
  <div class="h-10 w-10 rounded-[12px] bg-white grid place-items-center">✨</div>
  <div>
    <p class="text-sm font-semibold">Tip</p>
    <p class="text-sm text-[hsl(var(--text)/0.75)]">Mark items as “Use soon” to get better suggestions.</p>
  </div>
</aside>
```
## UX guardrails

- Illustrations must never replace essential status indicators (use text + icon at minimum).
- Keep onboarding skippable; don’t gate core actions behind long illustrated flows.
- Ensure illustrations don’t cause layout shifts (reserve fixed aspect ratio slots).
## Blending guidance

- Pairs well with Editorial (warm reading surfaces) or Clay (playful depth).
- If blending with Swiss/Flat, keep UI minimal and let illustrations supply personality.
