---
name: designing-svelte-ui
description: Builds, improves, and reviews UI/UX in SvelteKit projects. Triggered for new pages, components, UX patterns, design systems, or Tailwind theming. Enforces visual consistency, accessibility, and structured UX patterns. Not for pure backend logic.
---

# SvelteKit UI Skill (Refactored: Style-Repo + UX-first)

Build opinionated, visually distinctive, and highly usable SvelteKit interfaces with a coherent design system and validated UX patterns underneath. Not just pretty — consistent, maintainable, accessible, and characterful.

---

## Blueprint

**First action:** ask whether to start coding now or invoke `planning-features` to plan.

If the user wants to build UI immediately, complete **Phase 0 (Style Commit)** and **Phase 1 (UX Pattern Strategy)** before writing components.

---

## Phase 0: Lock Global Visual Direction (Style Commit)

### 0.1 Determine context

- **New UI / new feature** → do Phase 0 fully.
- **Existing project / “make it less generic”** → run **Audit Mode** (later) but still do a Style Commit if none exists.

### 0.2 Style Picker (curated art directions)

Offer the user a constrained choice: **1 Primary style** (+ optional 1 Secondary) + optional **Modifiers**.

> Ask: “Pick **1 primary** style. Optionally add **1 secondary** style and up to **2 modifiers**.”

**Style registry (with reference files):**

| Style                                | What it looks like                                   | Best used for                         | Reference                                                    |
| ------------------------------------ | ---------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| Minimalism / Swiss                   | strict grid, whitespace, typographic hierarchy       | settings, dashboards, “quiet premium” | `references/style-minimalism-swiss.md`                      |
| Editorial / Typography-led           | big type, rhythm, magazine-like layouts              | content-heavy products, warm brands   | `references/style-editorial-typography-led.md`              |
| Flat design                          | solid fills, crisp borders, minimal depth            | clarity-first product UIs             | `references/style-flat-design.md`                           |
| Material Design                      | layered surfaces, consistent elevation, motion rules | app shells, mobile-first              | `references/style-material-design.md`                       |
| Fluent Design                        | depth + translucency (acrylic), blur, light          | chrome/overlays, modern OS feel       | `references/style-fluent-design.md`                         |
| Card-based / Modular                 | cards/tiles, reusable blocks, feed/dash patterns     | dashboards, collections               | `references/style-card-based-modular.md`                    |
| Bento / Panel grid                   | calm boxed sections, varied spans, rhythm            | home hubs, overview pages             | `references/style-bento-panel-grid.md`                      |
| Glassmorphism (modifier)             | frosted blur panels + glow                           | hero/overlays only                    | `references/style-glassmorphism.md`                         |
| Neumorphism (modifier)               | soft extruded/pressed surfaces                       | widgets only, risky                   | `references/style-neumorphism.md`                           |
| Claymorphism / Soft 3D               | puffy shapes, chunky depth                           | playful consumer/onboarding           | `references/style-claymorphism-soft-3d.md`                  |
| Gradients / Aurora (modifier)        | bold gradients/iridescent backdrops                  | hero/section backdrops                | `references/style-gradients-aurora.md`                      |
| Skeuomorphism (selective) (modifier) | paper/tape/pins used sparingly                       | editorial pairing, storytelling       | `references/style-skeuomorphism-selective.md`               |
| Brutalist / Neo-brutalist            | thick borders, loud contrast, raw                    | bold brand statements                 | `references/style-brutalist-neo-brutalist.md`               |
| Illustration-first / Brand character | custom visuals + friendly voice                      | onboarding/empty states               | `references/style-illustration-first-brand-character-ui.md` |
| Motion-rich (modifier)               | microinteractions as guidance                        | feedback/orientation layer            | `references/style-motion-rich-microinteraction-heavy.md`    |

**Important classification rule:**

- **Primary style** defines the _system_ (grid, type, spacing, surfaces).
- **Secondary style** may influence _some_ tokens + select components.
- **Modifiers** are **restricted** to specific zones (hero/overlays/widgets) and must not override UX guardrails.

### 0.3 Mandatory: Style Interview (fast, commitment-driven)

After the user picks styles, ask **at most 4–5 forced-choice questions total** (prioritise the primary style) to eliminate vagueness. Don't ask per-style; pick the highest-leverage unknowns only.

Example interview prompts (agent should adapt to chosen styles):

- Editorial: type mood (bookish serif / modern serif / sans-only), layout (single-col reading / magazine 2-col / bento editorial), hierarchy (hero-first / balanced / dense)
- Swiss: density (airy / balanced / compact), separators (rules / whitespace), accent usage (links-only / CTA+focus)
- Fluent/Glass: transparency budget (nav+overlays only / hero too / heavy), fallback (solid mode required?)
- Skeuo: metaphor (paper+tape / notebook / binder tabs), ornament budget (0–1 / 2 / 3 motifs per screen)
- Gradients: where (hero only / section backdrops / subtle accents), palette (2 hues / 3 hues)
- Motion-rich: where (nav transitions / expand-collapse / delight only), reduced-motion (strict / normal)

### 0.4 Produce a Style Application Plan (required output)

Before coding anything, the agent must write a concise plan:

- **Primary style (≈80%)**: what it controls (type, grid, spacing, core components)
- **Secondary style (≈20%)**: what it controls (surfaces, header patterns, select components)
- **Modifiers**: exact placement rules (hero only / overlays only / widgets only)
- **Banned zones** (default): **forms, tables, navigation scaffolding** stay conventional unless explicitly permitted
- **Ornament budget** (if applicable): e.g., “max 2 skeuo motifs per screen”
- **Dark mode**: decide explicitly — `prefers-color-scheme` auto, manual toggle, or light-only. If dark mode is in scope, add a `.dark` variant block to the token file now, not later.

### 0.5 Read style specs (always)

For every chosen style, the agent must open:

- `references/style-<chosen-style>.md`

The agent must **extract** from each chosen style's spec:

- token defaults,
- do/don’t rules,
- component recipes,
- UX guardrails,
  and incorporate them into the project’s design system + primitives.

---

## Phase 1: Feature UX & Layout Strategy

Style dictates how things look; **UX Patterns dictate how things work.** Before building any screen or major feature, you must lock in its structural UX pattern.

### 1.1 UX Pattern Registry

Identify the **1 primary UX pattern** that best serves the user's feature request. Do not invent custom layouts from scratch if a proven pattern exists.

| Pattern | Signature & Use Case | Reference |
| --- | --- | --- |
| **Canvas** | Freeform spatial workspace (Whiteboards, node editors) | `references/ux-canvas.md` |
| **Conversational** | Persistent chronological thread (Chatbots, AI assistants) | `references/ux-conversational.md` |
| **Dashboard** | High-density overview of metrics (Home screens, analytics) | `references/ux-dashboard.md` |
| **Document** | Continuous linear text flow (Long-form content, wikis) | `references/ux-document.md` |
| **Drill Down** | Strict hierarchy traversal (Deep settings, nested folders) | `references/ux-drill-down.md` |
| **Feed** | Vertical stream of items (Timelines, activity logs) | `references/ux-feed.md` |
| **Hub & Spoke** | Central dispatcher to isolated modes (Task-focused apps) | `references/ux-hub-spoke.md` |
| **Kanban** | Columns representing state (Project mgmt, pipelines) | `references/ux-kanban.md` |
| **Launcher** | Keyboard-first search overlay (Global search, cmd palettes) | `references/ux-launcher.md` |
| **Master-Detail** | Bifurcated list + content view (Email clients, dense logs) | `references/ux-master-detail.md` |
| **Matrix** | 2D data grid (Ledgers, bulk data entry) | `references/ux-matrix.md` |
| **Prog. Disclosure**| Depth on demand (Complex settings, advanced forms) | `references/ux-progressive-disclosure.md`|
| **Tabs** | Parallel contexts (Grouped peer settings) | `references/ux-tabs.md` |
| **Timeline** | Spatial representation of time (Schedules, video editors) | `references/ux-timeline.md` |
| **Wizard** | Linear sequential flow (Onboarding, complex forms) | `references/ux-wizard.md` |
| **Workbench** | Omnipresent unscrollable UI (Expert devtools, IDEs) | `references/ux-workbench.md` |

### 1.2 Mandatory Pattern Review
Once a pattern is identified, you **MUST read its corresponding markdown reference file** before writing code. 
These files contain:
- Recommended `shadcn-svelte` components to use.
- Strict `Do / Don't` interaction rules.
- A fully typed Svelte 5 Component Recipe.

---

## Phase 2: Persist Decisions (always)

Once the Style & UX plans are confirmed, write to the following files to persist state across sessions:

### 1) `DESIGN_SYSTEM.md` (project root)

Must include:

- chosen styles + Style Application Plan
- final palette + typography + spacing + radii + elevation/motion policies
- component conventions + "banned zones" decisions
- **Chosen UX Patterns** for core features (e.g., "Inbox uses Master-Detail, Settings uses Progressive Disclosure").
- ornament budget + any exceptions
- project-specific anti-patterns

### 2) `AGENTS.md` (project root)

Keep short — this file is loaded into every agent context, so don't pollute it with the full design system. It should only point to the right file:

```md
For UI design decisions (tokens, style, components) and UX patterns, see @DESIGN_SYSTEM.md.
```

### 3) `CLAUDE.md` (project root)

Short project context + `@AGENTS.md`

### 4) Tokens file

Put tokens at the top of `src/app.css` (or `src/lib/styles/tokens.css`), with a header:

```css
/* ============================================================
   DESIGN SYSTEM TOKENS — see DESIGN_SYSTEM.md for rationale
   ============================================================ */
```

---

## Phase 3 & 4: Tokens and Theming

Once tokens are defined, you **MUST read the detailed reference guide**:
- `references/tokens-theming.md`

This guide covers:
- The required **Phase 3: Tokens (Design System First)**
- The required **Phase 4: Tailwind + shadcn-svelte Theming**

---

## Phase 5: Component Architecture (Primitives & Patterns)

### 5.1 File conventions

```
src/lib/components/
├── ui/            # shadcn-svelte generated — don’t hand-edit
├── primitives/    # wrappers that encode tokens + visual conventions
│   ├── Button.svelte
│   ├── Card.svelte
│   ├── Input.svelte
│   ├── Badge.svelte
│   ├── Text.svelte        # typographic ladder
│   ├── Stack.svelte       # vertical rhythm / spacing
│   ├── Rule.svelte        # editorial rules/dividers
│   └── Panel.svelte       # bento/modular surface blocks
├── layout/        # Pattern-driven structures (from Phase 1 UX Patterns)
│   ├── MasterDetailLayout.svelte
│   ├── FeedLayout.svelte
│   ├── WizardLayout.svelte
│   ├── PageHeader.svelte
│   ├── Sidebar.svelte
│   ├── EmptyState.svelte
│   └── Skeletons.svelte
└── domain/
    └── feature-specific components...
```

### 5.2 Hard rules (consistency)

- Never use raw `<button>` → always `primitives/Button`
- Never use raw `<input>` → shadcn `Input` via `primitives/Input`
- Never hand-roll spacing ad-hoc → use `Stack` / tokens
- Never use Tailwind default palette as final colors → tokens only
- **Never hand-roll complex structural layouts** (like resizable panes or virtualized feeds) without consulting the matching UX Pattern spec in `references/ux-`.
- If a visual request conflicts with `DESIGN_SYSTEM.md`, **flag it** (don't silently change style).

### 5.3 Style repository integration in primitives

When styles are chosen:

1. read the style spec `.md` files
2. incorporate their rules into:
   - tokens (where appropriate)
   - primitive variants (Button/Card/Panel)
   - layout patterns (PageHeader/EmptyState)

3. keep UX guardrails intact (focus rings, contrast, tap targets)

---

## Phase 6: Svelte 5 + SvelteKit patterns (production-grade)

### 6.1 Svelte 5 runes

Use runes consistently (`$props`, `$state`, `$derived`). Prefer `onclick` etc.

### 6.2 Streaming + skeletons

Prefer streamed promises with **skeleton UIs** that match final layout (crucial for Feed/Dashboard patterns).

### 6.3 Form actions + progressive enhancement

Prefer SvelteKit actions + `use:enhance`.

---

## Phase 7: UX Guardrails (always on)

Regardless of style or pattern:

- **Focus rings** are visible and consistent
- **Contrast** targets AA for text
- **Tap targets** ≥ 44×44px
- **States** exist for hover/active/disabled/error/success
- **Keyboard** navigation works for menus/dialogs/forms
- **URL Sync** is respected for structural state (like active Tabs or Drill Down depth).
- **Reduced motion** respected (especially if Motion-rich modifier is used)

If a visual effect (glass/neo/skeuo) harms these, it must be limited, toned down, or replaced.

---

## Phase 8: Blandness, Style, and UX Drift Audit

When reviewing or improving UI, the agent must audit for:

### 8.1 Generic anti-patterns

- default Tailwind colors/typography
- pure white/gray soup
- inconsistent radii and shadows
- random spacing values
- unthemed shadcn defaults

### 8.2 Style & UX drift (new)

Compare code against `DESIGN_SYSTEM.md`:

- Is the Style Application Plan being followed?
- Are modifiers leaking into banned zones?
- Is ornament budget exceeded?
- Are core primitives bypassed?
- **Are UX Patterns being abused?** (e.g., nested tabs, paginated feeds instead of virtualized, master-detail scrolling coupled together).

When calling it out, be explicit:

> “This screen nests tabs inside tabs and uses default gray text. This conflicts with our design system and the Tabs UX pattern rules. I am migrating it to a Drill Down pattern and applying the token palette.”

---

## Audit Mode (Existing Projects)

If the user asks to improve/review an existing codebase:

- Read existing tokens, `app.css` `@theme` block, shadcn mapping, primitives
- Identify Violations (Visual AND Behavioral).
- Propose a migration plan referencing specific `references/style-` and `references/ux-` files.
- Only then change code incrementally

Use `references/audit.md` for the detailed workflow.

---

## Validation Loop

Before concluding any UI implementation:
1. Run the type-checker (`pnpm svelte-check`).
2. Run the linter to catch accessibility and syntax issues.
3. Review warnings in the terminal. If errors occur, autonomously fix them and repeat the loop until the checks pass.

## Checklist Before Shipping Any UI

Copy this checklist into your initial response scratchpad to track your progress:
- [ ] Style Application Plan exists in `DESIGN_SYSTEM.md` and matches implementation.
- [ ] **Primary UX Pattern identified** for the feature and Reference file read.
- [ ] UX Pattern Do/Don't rules strictly followed (e.g., proper scrolling, URL syncing, focus states).
- [ ] Tokens are full `hsl()` (or OKLCH) values, not bare triples.
- [ ] `@theme inline` block in `app.css` exposes all color/font/radius tokens to Tailwind utilities.
- [ ] Alpha variants use `bg-primary/50` syntax — no `<alpha-value>` strings anywhere.
- [ ] All colors come from tokens (no Tailwind defaults as final).
- [ ] shadcn variables remapped (no defaults).
- [ ] Typography ladder exists and is used (no random `text-*` choices).
- [ ] No raw `<button>` / `<input>` outside primitives.
- [ ] Spacing uses scale + layout helpers (no ad-hoc drift).
- [ ] Loading states use skeleton UIs matching the layout pattern.
- [ ] Empty states exist and follow the visual style rules (and ornament budget).
- [ ] Focus/contrast/tap targets pass accessibility guardrails.