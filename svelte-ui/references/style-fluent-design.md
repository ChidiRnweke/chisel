# Fluent Design

**Signature:** depth + translucency, blur/acrylic, light effects

These notes are meant to be *agent-executable*: they translate a “style” into **tokens + rules + component recipes**.
Assume a token-driven system (CSS variables) and a component library (SvelteKit + Tailwind or similar).

## Token defaults (starting point)

```css
:root {
  /* Fluent: depth + translucency with crisp typography */
  --surface: 210 25% 98%;
  --surface-1: 0 0% 100%;
  --text: 210 15% 12%;
  --primary: 205 95% 46%;
  --border: 210 18% 86%;

  --radius: 12px;
  --shadow-1: 0 8px 24px hsl(0 0% 0% / 0.12);
  --acrylic-bg: hsl(var(--surface-1) / 0.72);
  --acrylic-border: hsl(var(--border) / 0.65);
}
```
## Rules

### Do
- Use translucency for overlays and nav surfaces (with solid fallback).
- Use depth sparingly: a few strong layers beat many subtle ones.
- Prefer crisp lines + soft blur (acrylic) + subtle lighting cues.
- Keep typography clean; let surfaces and lighting provide character.

### Don’t
- Don’t blur everything; blur is expensive and reduces readability.
- Don’t place text directly on complex backgrounds without a solid surface.
- Don’t use low-contrast borders with translucent panels—edges must be clear.
## Where to apply

**Primary (dominates):**
- App chrome: sidebars, top bars, overlays, cards on rich backgrounds

**Secondary (allowed):**
- Hero sections, settings panels, contextual menus

**Banned / keep neutral:**
- Dense tables over blur, long-form reading surfaces (prefer solid)
## Component recipes

### Acrylic top bar

Translucent bar with clear border and strong blur.

```svelte
<header
  class="sticky top-0 z-50 border-b border-[hsl(var(--acrylic-border))]
         bg-[var(--acrylic-bg)] backdrop-blur-xl">
  <div class="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
    <span class="font-semibold">Workbench</span>
    <button class="rounded-[9999px] px-4 py-2 bg-[hsl(var(--primary))] text-white">New</button>
  </div>
</header>
```

### Acrylic card

Use acrylic when the background has interest; otherwise keep it solid.

```svelte
<div class="rounded-[var(--radius)]
            border border-[hsl(var(--acrylic-border))]
            bg-[var(--acrylic-bg)] backdrop-blur-xl
            shadow-[var(--shadow-1)] p-5">
  <h3 class="text-base font-semibold">Recent files</h3>
  <p class="mt-1 text-sm text-[hsl(var(--text)/0.7)]">Pick up where you left off.</p>
</div>
```

### Context menu

Menus should feel “floating” and separated via blur + shadow.

```svelte
<div class="w-56 rounded-[12px] border border-[hsl(var(--acrylic-border))]
            bg-[var(--acrylic-bg)] backdrop-blur-xl shadow-[var(--shadow-1)] p-2">
  <button class="w-full text-left px-3 py-2 rounded-[10px] hover:bg-black/5">Rename</button>
  <button class="w-full text-left px-3 py-2 rounded-[10px] hover:bg-black/5">Duplicate</button>
  <div class="my-1 h-px bg-[hsl(var(--border))]" />
  <button class="w-full text-left px-3 py-2 rounded-[10px] text-red-600 hover:bg-red-500/10">Delete</button>
</div>
```
## UX guardrails

- Always provide a non-blur fallback (solid `--surface-1`) for browsers/perf modes.
- Contrast-check text on acrylic surfaces; consider strengthening text color.
- Blur + translucency should not be used behind form inputs or tables.
## Blending guidance

- Combine with **Bento / Panel grid** for calm structure + fluent surfaces.
- If you blend with **Gradients/Aurora**, keep gradients behind the acrylic layers, not inside components.
