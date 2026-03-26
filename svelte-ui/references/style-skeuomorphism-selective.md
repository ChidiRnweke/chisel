# Skeuomorphism (selective)

## Table of Contents

- [Token defaults (starting point)](#token-defaults-starting-point)
- [Rules](#rules)
  - [Do](#do)
  - [Don’t](#dont)
- [Where to apply](#where-to-apply)
- [Component recipes](#component-recipes)
  - [Paper card with tape](#paper-card-with-tape)
  - [Bookmark tabs](#bookmark-tabs)
  - [Keep inputs modern](#keep-inputs-modern)
- [UX guardrails](#ux-guardrails)
- [Blending guidance](#blending-guidance)

**Signature:** real-world cues used sparingly for clarity

These notes are meant to be *agent-executable*: they translate a “style” into **tokens + rules + component recipes**.
Assume a token-driven system (CSS variables) and a component library (SvelteKit + Tailwind or similar).

## Token defaults (starting point)

```css
:root {
  /* Selective skeuo = real-world cues as *ornament*, not structure */
  --surface: 45 20% 97%;
  --surface-paper: 45 22% 95%;
  --text: 30 10% 14%;
  --border: 45 12% 82%;
  --accent: 38 90% 52%;

  --radius: 14px;
  --shadow-paper: 0 2px 10px hsl(0 0% 0% / 0.08), 0 0 0 1px hsl(var(--border));
  --texture-opacity: 0.06; /* keep very subtle */
}
```
## Rules

### Do
- Pick 1–2 metaphors (paper/tape/pins/bookmarks) and repeat consistently.
- Use skeuo for hero cards, callouts, empty states—not for every control.
- Keep core controls (inputs, tables, nav) modern and accessible.
- Make skeuo elements structural (bookmark = current tab), not random decoration.

### Don’t
- Don’t put textures behind body text; it harms readability.
- Don’t use skeuo shadows + material elevation at the same time—choose one depth model.
- Don’t turn form fields into “real objects” (knobs, switches) unless essential.
## Where to apply

**Primary (dominates):**
- Hero panels, featured cards, callouts, empty states

**Secondary (allowed):**
- Section headers (bookmark tabs), subtle paper stacks

**Banned / keep neutral:**
- Dense forms, tables, navigation scaffolding, error states
## Component recipes

### Paper card with tape

A paper surface with a single skeuo motif (tape) and clean content.

```svelte
<article class="relative rounded-[var(--radius)] bg-[hsl(var(--surface-paper))]
                border border-[hsl(var(--border))] shadow-[var(--shadow-paper)] p-6">
  <span class="absolute -top-3 left-6 rotate-[-2deg] rounded-[6px]
               bg-[hsl(var(--accent)/0.35)] px-4 py-1 text-xs font-semibold text-[hsl(var(--text))]">
    Featured
  </span>

  <h3 class="text-2xl font-semibold">Grandma’s staples</h3>
  <p class="mt-2 text-sm text-[hsl(var(--text)/0.75)]">A ready-made list to start your pantry.</p>
  <button class="mt-4 rounded-[9999px] px-5 py-2 bg-[hsl(var(--accent))] text-[hsl(var(--text))] font-semibold">
    Add list
  </button>
</article>
```

### Bookmark tabs

Bookmark shape indicates active section; keep it minimal.

```svelte
<div class="flex gap-2">
  <button class="rounded-t-[12px] px-4 py-2 bg-[hsl(var(--surface-paper))]
                 border border-b-0 border-[hsl(var(--border))] font-semibold">
    Pantry
  </button>
  <button class="rounded-t-[12px] px-4 py-2 bg-[hsl(var(--surface))]
                 border border-[hsl(var(--border))] text-[hsl(var(--text)/0.7)]">
    Freezer
  </button>
</div>
```

### Keep inputs modern

Skeuo vibe comes from surroundings; inputs remain simple.

```svelte
<input class="w-full rounded-[10px] border border-[hsl(var(--border))]
             bg-[hsl(var(--surface))] px-3 py-2 text-sm
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]"
  placeholder="Search items…" />
```
## UX guardrails

- Set an ornament budget (e.g., max 2 skeuo motifs per screen).
- Skeuo must never reduce contrast or obscure text.
- Keep interaction patterns conventional unless the metaphor truly improves understanding.
## Blending guidance

- Pairs naturally with **Editorial / Typography-led** (paper + serif + rhythm).
- If blending with Bento/Card-based, apply skeuo only to 1–2 featured panels.
