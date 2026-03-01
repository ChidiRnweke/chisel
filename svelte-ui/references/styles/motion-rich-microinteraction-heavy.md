# Motion-rich / Microinteraction-heavy

**Signature:** animated feedback, transitions as guidance

These notes are meant to be *agent-executable*: they translate a “style” into **tokens + rules + component recipes**.
Assume a token-driven system (CSS variables) and a component library (SvelteKit + Tailwind or similar).

## What it is

Motion-rich UI treats animation as part of the interface language: feedback, causality, orientation, and delight.

## Token defaults (starting point)

```css
:root {
  /* Motion tokens (durations in ms) */
  --dur-1: 120ms; /* micro */
  --dur-2: 180ms; /* standard */
  --dur-3: 240ms; /* enter/exit */
  --ease-standard: cubic-bezier(.2,.8,.2,1);
  --ease-emphasized: cubic-bezier(.2,1,.2,1);

  /* Motion safety */
  --motion-ok: 1; /* set to 0 in prefers-reduced-motion */
}
```
## Rules

### Do
- Animate state changes (hover/press, expand/collapse, reorder) so users understand what changed.
- Use consistent durations/easings across the app.
- Prefer transforms/opacity over layout-affecting properties for performance.
- Use motion to preserve context (menus originate from triggers; items move, not teleport).

### Don’t
- Don’t animate everything; pick a few high-value moments.
- Don’t use long easing for basic UI (no 600ms fades).
- Don’t violate reduced-motion preferences.
## Where to apply

**Primary (dominates):**
- Navigation transitions, expanding panels, drag/reorder, feedback on actions

**Secondary (allowed):**
- Delight moments (success), subtle hover/press interactions

**Banned / keep neutral:**
- Critical flows where motion could delay task completion (checkout/forms)
## Component recipes

### Animated accordion

Use height animation carefully; prefer transform/opacity for content.

```svelte
<script lang="ts">
  let open = $state(false);
  const rowClass = $derived(
    open
      ? 'grid [grid-template-rows:1fr] transition-[grid-template-rows] duration-[var(--dur-3)]'
      : 'grid [grid-template-rows:0fr] transition-[grid-template-rows] duration-[var(--dur-3)]'
  );
</script>

<button
  class="w-full text-left rounded-[12px] px-4 py-3 border border-black/10"
  onclick={() => (open = !open)}>
  <span class="font-semibold">Ingredients</span>
</button>

<div class={rowClass}>
  <div class="overflow-hidden">
    <div class="px-4 py-3 text-sm text-black/70">Lentils, tomatoes, onion…</div>
  </div>
</div>
```

### Button press feedback

A tiny transform communicates press without being gimmicky.

```svelte
<button
  class="rounded-[9999px] px-5 py-2 bg-black text-white font-semibold
         transition-transform duration-[var(--dur-1)] [transition-timing-function:var(--ease-standard)]
         active:scale-[0.98]
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60">
  Save
</button>
```

### Reduced motion safety

Always include a reduced-motion rule.

```svelte
<style>
@media (prefers-reduced-motion: reduce) {
  :global(*) {
    transition-duration: 0.001ms !important;
    animation-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
</style>
```
## UX guardrails

- Motion must never block input; keep UI responsive.
- Use motion to explain causality and preserve context, not to decorate.
- Respect reduced motion; offer in-app toggle if you lean heavily on animation.
## Blending guidance

- Motion is best treated as a **modifier layer** on top of a visual style (Swiss/Material/Editorial).
- If combining with Glass/Clay, keep motion subtle to avoid overwhelming the user.
