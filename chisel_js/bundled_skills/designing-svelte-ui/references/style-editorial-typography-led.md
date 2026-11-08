# Editorial / Typography-led

## Table of Contents

- [Token defaults (starting point)](#token-defaults-starting-point)
- [Rules](#rules)
  - [Do](#do)
  - [Don’t](#dont)
- [Where to apply](#where-to-apply)
- [Component recipes](#component-recipes)
  - [Page header](#page-header)
  - [Editorial card](#editorial-card)
  - [Form field (keep it quiet)](#form-field-keep-it-quiet)
- [UX guardrails](#ux-guardrails)
- [Blending guidance](#blending-guidance)

**Signature:** big type, strong rhythm, magazine-like layouts

These notes are meant to be _agent-executable_: they translate a “style” into **tokens + rules + component recipes**.
Assume a token-driven system (CSS variables) and a component library (SvelteKit + Tailwind or similar).

## Token defaults (starting point)

```css
:root {
	/* Warm reading surfaces */
	--surface: 45 20% 97%;
	--surface-2: 45 18% 93%;
	--text: 30 10% 14%;
	--border: 45 12% 84%;
	--accent: 38 90% 52%;

	/* Type: serif display + neutral body */
	--font-display: 'Fraunces', ui-serif, Georgia, serif;
	--font-body: 'DM Sans', ui-sans-serif, system-ui;
	--leading-body: 1.65;
	--tracking-display: -0.02em;

	/* Shape and separation */
	--radius: 12px;
	--shadow-1: 0 1px 2px hsl(0 0% 0% / 0.06);
	--shadow-2: 0 8px 24px hsl(0 0% 0% / 0.1);
	--rule: 1px solid hsl(var(--border));
}
```

## Rules

### Do

- Use a strong typographic ladder (H1–H4, deck, caption).
- Treat pages like spreads: generous gutters, clear sections.
- Use small-caps/eyebrows/labels to create “editorial” structure.
- Use hairline rules and subtle paper surfaces for grouping.
- Let content lead; UI chrome stays quiet and consistent.

### Don’t

- Don’t shrink body text to fit—editorial needs breathing room.
- Don’t use neon accents; keep accent warm and controlled.
- Don’t put heavy skeuo on form fields; keep them readable and standard.

## Where to apply

**Primary (dominates):**

- Headers, page rhythm, typographic components, long-form content, dashboards with lots of text

**Secondary (allowed):**

- Cards, callouts, sidebars, navigation labels, dividers

**Banned / keep neutral:**

- Overly playful icons, loud gradients, excessive shadows

## Component recipes

### Page header

Eyebrow + hero headline + deck (magazine pattern).

```svelte
<header class="max-w-[72rem] px-6 py-10">
	<p
		class="text-xs font-[var(--font-body)] tracking-[0.12em] text-[hsl(var(--text)/0.65)] uppercase"
	>
		Pantry • Spring issue
	</p>
	<h1
		class="mt-2 text-4xl leading-tight font-[var(--font-display)] tracking-[var(--tracking-display)] text-[hsl(var(--text))]"
	>
		Stock smarter, waste less.
	</h1>
	<p
		class="mt-3 max-w-prose text-base leading-[var(--leading-body)] font-[var(--font-body)] text-[hsl(var(--text)/0.75)]"
	>
		A calm system for tracking ingredients, planning meals, and using what you already have.
	</p>
</header>
```

### Editorial card

Paper-like card with rule divider and a clear typographic hierarchy.

```svelte
<article
	class="rounded-[var(--radius)] border border-[hsl(var(--border))]
         bg-[hsl(var(--surface))] p-6 shadow-[var(--shadow-1)]"
>
	<div class="flex items-baseline justify-between">
		<h3 class="text-2xl font-[var(--font-display)] tracking-[var(--tracking-display)]">
			Weeknight recipes
		</h3>
		<span class="text-xs tracking-[0.12em] text-[hsl(var(--text)/0.6)] uppercase">New</span>
	</div>
	<hr class="my-4 border-[hsl(var(--border))]" />
	<p class="text-sm leading-[var(--leading-body)] text-[hsl(var(--text)/0.75)]">
		Fast, ingredient-first cooking with fewer steps.
	</p>
	<a
		class="mt-4 inline-block text-sm underline decoration-[hsl(var(--accent))] underline-offset-4"
		href="#"
	>
		Browse →
	</a>
</article>
```

### Form field (keep it quiet)

Editorial vibe comes from labels and spacing—inputs stay simple and legible.

```svelte
<label class="block">
	<span class="text-xs tracking-[0.12em] text-[hsl(var(--text)/0.65)] uppercase">Ingredient</span>
	<input
		class="mt-2 w-full rounded-[8px] border border-[hsl(var(--border))]
           bg-[hsl(var(--surface-2))] px-3 py-2 text-sm
           focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))] focus-visible:outline-none"
		placeholder="e.g., lentils"
	/>
</label>
```

## UX guardrails

- Long-form readability: body size ≥ 16px, line-height ~1.6–1.75.
- Keep form controls conventional; style through labels, spacing, and surfaces.
- Ensure headings remain scannable on mobile (avoid 2-line caps lock labels).

## Blending guidance

- Pairs well with **Selective Skeuomorphism** (paper motifs) if you cap ornament.
- If mixing with **Gradients/Aurora**, keep gradients behind hero only; keep content surfaces paper-warm.
