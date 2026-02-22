---
name: svelte-ui
description: Build distinctive, production-grade SvelteKit user interfaces with a cohesive design system.  Use this skill whenever the user asks to create, improve, or review UI in a SvelteKit project — including new pages, components, layouts, forms, or design systems. Also trigger when the user mentions shadcn-svelte, Tailwind theming, component libraries, or asks why their UI looks "bland", "generic", or "like every other SaaS". This skill establishes a design system from scratch (palette, type scale, spacing tokens) before writing any components, and enforces consistency across the entire codebase. It actively audits for and fixes generic anti-patterns.
---

# SvelteKit UI Skill

Build opinionated, visually distinctive SvelteKit interfaces with a proper design system underneath. Not just pretty — consistent, maintainable, and characterful.

---

## Blueprint

IMPORTANT: ask the user if they want you to start coding or explicitly invoke the `feature-blueprint` skill to write a detailed plan.

## Phase 0: Design System First

**Never write a component before the design system exists.** If there's no established palette or visual identity, stop and ask the user before proceeding:

> "Before I build anything, I need to understand the visual direction. What's the product about? Do you have a colour palette, brand references, or a mood you're going for? Or would you like me to propose something?"

Once you have direction, define the full token set in `src/app.css` (or a dedicated `src/lib/styles/tokens.css`). The system must include:

### Colour Tokens

```css
:root {
  /* Primary palette — pick ONE dominant hue family, not a rainbow */
  --color-primary: hsl(142 40% 28%); /* example: deep forest green */
  --color-primary-light: hsl(142 30% 92%);
  --color-primary-muted: hsl(142 20% 60%);

  /* Neutral scale — derive from primary hue, not pure grey */
  --color-surface: hsl(45 20% 97%); /* warm off-white, not #ffffff */
  --color-surface-2: hsl(45 15% 93%);
  --color-surface-3: hsl(45 12% 87%);
  --color-border: hsl(45 10% 82%);

  --color-text: hsl(30 10% 15%); /* warm near-black */
  --color-text-muted: hsl(30 8% 45%);
  --color-text-subtle: hsl(30 6% 65%);

  /* Semantic */
  --color-danger: hsl(0 65% 50%);
  --color-warning: hsl(38 90% 50%);
  --color-success: hsl(142 45% 40%);

  /* Accent — ONE punchy colour for CTAs, highlights */
  --color-accent: hsl(38 90% 52%); /* e.g. amber */
  --color-accent-fg: hsl(30 10% 10%); /* text on accent */
}
```

**Anti-patterns to call out and fix:**

- `--color-primary: #3b82f6` or any default Tailwind blue → generic SaaS
- Pure `#ffffff` backgrounds → flat and sterile
- More than 2 hue families in the neutral scale → incoherent

### Typography Tokens

```css
:root {
  /* Choose TWO fonts max: one display, one body. Never use Inter/Roboto/Arial. */
  --font-display: "Fraunces", Georgia, serif; /* personality, headings */
  --font-body: "DM Sans", "Helvetica Neue", sans-serif; /* legible, neutral */
  --font-mono: "JetBrains Mono", monospace;

  /* Modular scale (1.25 ratio is a good default) */
  --text-xs: 0.75rem; /* 12px */
  --text-sm: 0.875rem; /* 14px */
  --text-base: 1rem; /* 16px */
  --text-lg: 1.25rem; /* 20px */
  --text-xl: 1.5625rem; /* 25px */
  --text-2xl: 1.953rem; /* ~31px */
  --text-3xl: 2.441rem; /* ~39px */
  --text-4xl: 3.052rem; /* ~49px */

  /* Line heights */
  --leading-tight: 1.2;
  --leading-snug: 1.35;
  --leading-normal: 1.5;
  --leading-relaxed: 1.65;

  /* Letter spacing */
  --tracking-tight: -0.02em;
  --tracking-normal: 0em;
  --tracking-wide: 0.06em;
  --tracking-wider: 0.12em;
}
```

**Anti-patterns to call out and fix:**

- `font-family: Inter` anywhere → too ubiquitous, replace with something with character
- No letter-spacing on headings → headings need `tracking-tight` at large sizes
- Body text `font-size: 14px` with no line-height → cramped and unreadable

### Spacing Tokens

```css
:root {
  /* 4px base grid */
  --space-1: 0.25rem; /* 4px */
  --space-2: 0.5rem; /* 8px */
  --space-3: 0.75rem; /* 12px */
  --space-4: 1rem; /* 16px */
  --space-5: 1.25rem; /* 20px */
  --space-6: 1.5rem; /* 24px */
  --space-8: 2rem; /* 32px */
  --space-10: 2.5rem; /* 40px */
  --space-12: 3rem; /* 48px */
  --space-16: 4rem; /* 64px */
  --space-20: 5rem; /* 80px */
  --space-24: 6rem; /* 96px */

  /* Semantic spacing */
  --page-padding: var(--space-6); /* consistent page gutters */
  --card-padding: var(--space-5);
  --section-gap: var(--space-16);
  --stack-gap: var(--space-4);

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px hsl(0 0% 0% / 0.06);
  --shadow-md: 0 4px 12px hsl(0 0% 0% / 0.08);
  --shadow-lg: 0 8px 24px hsl(0 0% 0% / 0.1);
  --shadow-card: 0 2px 8px hsl(0 0% 0% / 0.06), 0 0 0 1px var(--color-border);
}
```

---

## Phase 0b: Persisting Design Decisions

Once the user confirms the design direction, Claude must write three files before any components are built:

### 1. `AGENTS.md` (project root)

The design system reference for all future Claude sessions. Written once, updated when decisions change. This is what `CLAUDE.md` points to via `@AGENTS.md`.

```markdown
# Design System

## Visual Direction

[One paragraph: mood, references, character. E.g. "Editorial and warm — think cookbook meets
field guide. Serif headings, generous whitespace, amber accents on a cream base."]

## Palette

- **Primary**: `hsl(142 40% 28%)` — deep forest green. [Reason for choice.]
- **Accent**: `hsl(38 90% 52%)` — amber. CTAs and highlights only — never decorative.
- **Neutrals**: Warm off-white base (`hsl 45°`). Never pure grey or `#ffffff`.
- **Text**: Near-black with warmth (`hsl(30 10% 15%)`). Muted at `hsl(30 8% 45%)`.

## Typography

- **Display**: Fraunces (serif) — headings, hero text, chapter-style labels
- **Body**: DM Sans — UI copy, labels, body text
- **Rationale**: [Why this pairing. What it communicates.]
- **Rules**: Headings always `tracking-tight`. Body `leading-relaxed`. No Inter.

## Spacing

- Base grid: 4px
- Page gutter: `--space-6` (24px)
- Card padding: `--space-5` (20px)
- Section gap: `--space-16` (64px)

## Radius

- Cards: `--radius-lg` (12px)
- Inputs: `--radius-md` (8px)
- Badges/pills: `--radius-full`

## Component Conventions

- [Decisions made during development — update as conventions are established]
- e.g. "Empty states always have an icon, headline, and CTA — never just text"
- e.g. "Status badges use colour + strikethrough for depleted items, not just label change"

## Anti-patterns for this project

- [Project-specific things that were tried and rejected]
```

### 2. `CLAUDE.md` (project root)

High-level project context. Kept brief — links to `AGENTS.md` for design detail.

```markdown
# [Project Name]

## Stack

- SvelteKit [version], TypeScript strict
- [shadcn-svelte / Tailwind / other UI deps]
- [Backend if BFF pattern]

## Architecture

[One line: "BFF — SvelteKit frontend + Python FastAPI backend" or "TypeScript monolith"]

## Key conventions

- [Any project-specific deviations from standard skill patterns]
- [Things Claude should know that aren't in the skills]

## Active skills

- svelte-ui — design system and UI components
- svelte-swe — frontend architecture
- [python-swe — backend, if applicable]

@AGENTS.md
```

The `@AGENTS.md` at the bottom pulls the design system into context automatically.

### 3. CSS tokens in `src/app.css`

Emit the full token block (as shown in Phase 0) as the _first thing_ in `app.css`, with a comment header:

```css
/* ============================================================
   DESIGN SYSTEM TOKENS — see AGENTS.md for rationale
   ============================================================ */
```

**At the start of future sessions:** Read `AGENTS.md` first. Operate within those decisions. If a new request conflicts with established decisions, flag it rather than silently overriding.

---

## Phase 1: Tailwind Config

Pipe all tokens into Tailwind so utilities work off the design system, not Tailwind defaults:

```js
// tailwind.config.js
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    extend: {
      colors: {
        primary: "hsl(var(--color-primary) / <alpha-value>)",
        surface: "hsl(var(--color-surface) / <alpha-value>)",
        accent: "hsl(var(--color-accent) / <alpha-value>)",
        // etc.
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      spacing: {
        // Map to CSS vars via arbitrary values or extend scale
      },
    },
  },
};
```

Prefer using CSS custom properties over Tailwind's hardcoded colour names for anything that might change between themes.

---

## Phase 2: shadcn-svelte Setup & Theming

shadcn-svelte components are the **floor**, not the ceiling. Install and then immediately override the default theme.

### shadcn-svelte theming

Map shadcn's semantic variables to your design tokens in `app.css`:

```css
:root {
  --background: var(--color-surface);
  --foreground: var(--color-text);
  --card: var(--color-surface-2);
  --card-foreground: var(--color-text);
  --primary: var(--color-primary);
  --primary-foreground: white;
  --secondary: var(--color-surface-3);
  --secondary-foreground: var(--color-text);
  --muted: var(--color-surface-2);
  --muted-foreground: var(--color-text-muted);
  --accent: var(--color-accent);
  --accent-foreground: var(--color-accent-fg);
  --destructive: var(--color-danger);
  --border: var(--color-border);
  --radius: var(--radius-md);
}
```

**Never leave shadcn variables at their defaults.** An unthemed shadcn project is immediately recognisable — flat, blue, and sterile.

### When to use shadcn vs custom

| Situation                           | Use                                                         |
| ----------------------------------- | ----------------------------------------------------------- |
| Form inputs, selects, checkboxes    | shadcn (accessibility is hard)                              |
| Dialogs, popovers, tooltips         | shadcn (focus trapping, ARIA)                               |
| Buttons                             | shadcn `<Button>` — but always with custom `variant` styles |
| Simple layout cards                 | Custom Svelte component wrapping a `<div>`                  |
| Navigation, headers, sidebars       | Custom — shadcn has no good opinions here                   |
| Data tables with sorting/pagination | shadcn `<Table>`                                            |
| Toast/notifications                 | shadcn `<Sonner>`                                           |

---

## Phase 3: Component Architecture

### File conventions

```
src/lib/components/
├── ui/           # shadcn-svelte auto-generated — don't hand-edit
├── primitives/   # Thin wrappers around shadcn with project theming baked in
│   ├── Button.svelte
│   ├── Card.svelte
│   ├── Input.svelte
│   └── Badge.svelte
├── layout/       # Page-level structural components
│   ├── PageHeader.svelte
│   ├── Sidebar.svelte
│   └── EmptyState.svelte
└── domain/       # Feature-specific components
    ├── RecipeCard.svelte
    └── CupboardItem.svelte
```

### Primitive wrappers

Create thin wrappers that bake in project conventions. Example:

```svelte
<!-- src/lib/components/primitives/Card.svelte -->
<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		padding?: 'sm' | 'md' | 'lg';
		elevated?: boolean;
	}

	let { padding = 'md', elevated = false, class: className, children, ...rest }: Props = $props();

	const padMap = { sm: 'p-4', md: 'p-5', lg: 'p-8' };
</script>

<div
	class="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)]
         {padMap[padding]} {elevated ? 'shadow-[var(--shadow-md)]' : 'shadow-[var(--shadow-card)]'}
         {className}"
	{...rest}
>
	{@render children?.()}
</div>
```

**Rules:**

- Never use raw `<div class="rounded-lg bg-white border p-4">` in a page — that's what `<Card>` is for
- Never use `<button>` directly — always `<Button>` from primitives
- Never use `<input>` directly — always `<Input>` from shadcn/primitives
- Never use `<p>` for UI chrome text — wrap in a typed text component or at minimum use semantic Tailwind prose classes

### Svelte 5 patterns

Use runes throughout:

```svelte
<script lang="ts">
	let { items = [] }: { items: Item[] } = $props();
	let query = $state('');
	let filtered = $derived(items.filter((i) => i.name.includes(query)));
</script>
```

For event handling, prefer `onclick` over `on:click` (Svelte 5 syntax).

---

## Phase 4: SvelteKit Patterns

### Streaming data

For slow data, use streamed promises so the UI is responsive:

```ts
// +page.server.ts
export const load: PageServerLoad = async ({ locals }) => {
  return {
    user: locals.user, // fast — resolve immediately
    streamed: {
      items: fetchItems(), // slow — stream it
    },
  };
};
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
	import { page } from '$app/stores';
	let { data } = $props();
</script>

{#await data.streamed.items}
	<SkeletonList /> <!-- Always show a skeleton, never a spinner alone -->
{:then items}
	<ItemList {items} />
{:catch}
	<ErrorState />
{/await}
```

### Form actions

Prefer SvelteKit form actions over manual fetch for mutations. Use `enhance` for progressive enhancement:

```svelte
<form method="POST" action="?/addItem" use:enhance>
	<Input name="name" placeholder="Item name" />
	<Button type="submit">Add</Button>
</form>
```

---

## Phase 5: Blandness Audit

When reviewing or building UI, actively check for these and fix them without being asked:

### Anti-pattern checklist

| Anti-pattern                       | Fix                                                               |
| ---------------------------------- | ----------------------------------------------------------------- |
| `font-family: Inter`               | Replace with characterful font from design system                 |
| `bg-white` or `bg-gray-*`          | Use `bg-[var(--color-surface)]` tokens                            |
| `text-blue-500` as primary         | Map to `--color-primary` token                                    |
| Raw `<button>` tag                 | Replace with `<Button>` primitive                                 |
| Raw `<input>` tag                  | Replace with shadcn `<Input>`                                     |
| `rounded-md` everywhere uniform    | Vary radius intentionally — small for inputs, larger for cards    |
| Uniform 16px spacing everywhere    | Use spacing scale — sections need `--space-16`, cards `--space-5` |
| No letter-spacing on headings      | Add `tracking-tight` to display text                              |
| Spinner-only loading states        | Add skeleton screens that mirror the real layout                  |
| `text-gray-500` for secondary text | Use `--color-text-muted` token                                    |
| Default shadcn blue button         | Apply themed `--color-primary` to shadcn's `--primary` variable   |

### Calling it out

When you spot a generic choice, say so clearly:

> "This uses `bg-white` and `text-gray-500` — that's the default Tailwind palette, which will make this feel generic. I'm replacing it with the design system tokens."

Don't silently fix it and say nothing. Making the reasoning explicit helps the developer internalise the system.

---

## Phase 6: Visual Character

After the system is in place and components are consistent, layer in personality. This is what separates "well-structured" from "memorable."

- **Typography contrast**: Pair a serif display font with a clean sans for body. Use the display font generously in headings — don't be shy.
- **Colour warmth**: Neutral palettes should have a hue. Pure grey neutrals feel cold. Derive neutrals from your primary hue.
- **Whitespace as design**: Use generous spacing in hero/header areas. Density is fine in data — not in navigation or page headers.
- **Micro-copy**: UI labels matter. "Add Item" is fine. "Stock your cupboard" is better. Push back on generic labels if they weaken the product voice.
- **Empty states**: Never leave an empty `<div>`. Every zero-state should have an illustration or icon, a headline, and a CTA.
- **Status badges**: Colour-coded badges (Fresh / Use Soon / Running Low) carry meaning — make sure they're visually distinct, not just label differences.

---

## Audit Mode (Existing Projects)

If the user asks to improve, review, or "make less generic" an existing SvelteKit codebase rather than build something new, switch to Audit Mode. Read `references/audit.md` for the full workflow.

The short version: read the existing code first, identify violations against the design system checklist, propose a migration plan, and only then start making changes — don't rewrite everything at once.

---

## Checklist Before Shipping Any UI

- [ ] All colours reference CSS custom property tokens, not Tailwind default colours
- [ ] Typography uses the two chosen fonts; no system font fallback used as primary
- [ ] No raw `<button>`, `<input>`, `<p>` (for UI chrome) tags outside of primitive components
- [ ] shadcn variables remapped to project tokens in `app.css`
- [ ] Streamed data has skeleton loading states
- [ ] Empty states exist for every list/grid that can be empty
- [ ] Spacing uses the defined scale — no arbitrary `mt-3`, `p-2` sprinkled everywhere
- [ ] Headings have `tracking-tight` and appropriate `leading-tight` / `leading-snug`
- [ ] No default blue primary colour unless it's intentional and themed
