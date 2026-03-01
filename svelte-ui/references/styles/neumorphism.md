# Neumorphism

**Signature:** soft “pressed/extruded” surfaces, low-contrast shadows

These notes are meant to be *agent-executable*: they translate a “style” into **tokens + rules + component recipes**.
Assume a token-driven system (CSS variables) and a component library (SvelteKit + Tailwind or similar).

## Token defaults (starting point)

```css
:root {
  /* Neumorphism is subtle depth on same-color surfaces */
  --surface: 210 20% 96%;
  --text: 210 15% 14%;
  --accent: 220 85% 52%;

  --radius: 16px;
  --neo-raised: 10px 10px 20px hsl(0 0% 0% / 0.12), -10px -10px 20px hsl(0 0% 100% / 0.65);
  --neo-pressed: inset 6px 6px 14px hsl(0 0% 0% / 0.12), inset -6px -6px 14px hsl(0 0% 100% / 0.7);
}
```
## Rules

### Do
- Use it sparingly on large controls (toggles, knobs, cards) with ample space.
- Keep surfaces close in color; depth comes from paired light/dark shadows.
- Add strong focus rings and readable text—neumorphism tends to wash out.

### Don’t
- Don’t use it for small text buttons or dense lists.
- Don’t rely on it as the only affordance—pair with labels/icons.
- Don’t use low-contrast palettes; it becomes inaccessible quickly.
## Where to apply

**Primary (dominates):**
- Toggles, media controls, small dashboards with few elements

**Secondary (allowed):**
- Hero widgets, playful settings

**Banned / keep neutral:**
- Forms, tables, long lists, enterprise/low-vision contexts
## Component recipes

### Raised card

Raised surface on same-color background; keep content minimal.

```svelte
<div class="rounded-[var(--radius)] bg-[hsl(var(--surface))]
            shadow-[var(--neo-raised)] p-6">
  <h3 class="text-base font-semibold text-[hsl(var(--text))]">Daily goal</h3>
  <p class="mt-1 text-sm text-[hsl(var(--text)/0.7)]">2 meals planned</p>
</div>
```

### Toggle (on/off states)

Use a data attribute to switch between raised and pressed shadows — don't nest shadow elements.

```svelte
<button
  data-pressed={isOn}
  class="rounded-[9999px] bg-[hsl(var(--surface))] px-5 py-2 text-sm font-semibold
         shadow-[var(--neo-raised)] data-[pressed=true]:shadow-[var(--neo-pressed)]
         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]"
  onclick={() => isOn = !isOn}>
  {isOn ? 'On' : 'Off'}
</button>
```

## UX guardrails

- Neumorphism is often **not accessible**; offer a “high-contrast” theme toggle.
- Always use clear focus rings and readable text colors.
- Limit to a handful of elements per screen; it collapses visually when dense.
## Blending guidance

- Use as a **micro-style** (controls/widgets) layered onto a Swiss or Flat base.
- Avoid combining with Glass or heavy Gradients—depth cues conflict.
