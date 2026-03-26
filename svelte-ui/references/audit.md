# UI Audit Mode

## Table of Contents

- [Step 1: Reconnaissance](#step-1-reconnaissance)
- [Step 2: Diagnosis Report](#step-2-diagnosis-report)
- [UI Audit: [Project Name]](#ui-audit-project-name)
  - [What's working](#whats-working)
  - [Design System](#design-system)
  - [Anti-patterns found](#anti-patterns-found)
  - [Overall assessment](#overall-assessment)
- [Step 3: Propose a Migration Plan](#step-3-propose-a-migration-plan)
- [Step 4: Execute Incrementally](#step-4-execute-incrementally)
- [Step 5: Verify Consistency](#step-5-verify-consistency)
- [Tone During Audit](#tone-during-audit)

Use this workflow when the user wants to improve an existing SvelteKit project rather than build from scratch.

---

## Step 1: Reconnaissance


Before suggesting any changes, read the following files:

1. `src/app.css` — does a token system exist in `:root`? Is there an `@theme inline` block wiring tokens to Tailwind utilities?
2. A representative page component (e.g. `src/routes/+page.svelte`)
3. 2–3 shared components from `src/lib/components/`
4. `DESIGN_SYSTEM.md` if it exists

Form a picture of the current state before saying anything. Don't start listing fixes yet.

If `DESIGN_SYSTEM.md` doesn't exist, you will gather information to create it, map out the tokens and primitives you find, and propose a structure for it in the diagnosis report. You can also suggest running the `designing-svelte-ui` skill to create one based on the audit findings.


---

## Step 2: Diagnosis Report

Produce a structured diagnosis. Be specific — reference actual file paths and class names, not generalities.

```
## UI Audit: [Project Name]

### What's working
- [Genuine strengths — don't skip this, it sets a constructive tone]

### Design System
- [ ] Token system in `app.css` `:root`: EXISTS / MISSING / PARTIAL
- [ ] `@theme inline` block wiring tokens to Tailwind: YES / NO
- [ ] shadcn themed: YES / NO / NOT USED

### Anti-patterns found

| File | Issue | Severity |
|------|-------|----------|
| src/routes/+page.svelte:42 | Raw `<button class="bg-blue-500">` | High |
| src/lib/components/Card.svelte | bg-white, no border-radius token | Medium |
| src/app.css | No token system, Tailwind defaults only | High |
| src/app.css | No `@theme inline` block — tokens not wired to Tailwind | High |

### Overall assessment
[2–3 sentences on the dominant problems and what fixing them would achieve]
```

Severity guide:
- **High** — Affects consistency across the whole codebase (missing token system, raw HTML elements, unthemed shadcn)
- **Medium** — Localised inconsistency (one component using wrong spacing, one-off colour)
- **Low** — Polish (missing letter-spacing, could use a skeleton instead of spinner)

---

## Step 3: Propose a Migration Plan

Don't rewrite everything at once. Propose a phased approach:

**Phase A — Foundation (do this first, unblocks everything else)**
- Establish token system in `app.css`
- Wire tokens into Tailwind via `@theme inline`
- Remap shadcn variables if used

**Phase B — Primitives (do before touching pages)**
- Create/fix `Button`, `Card`, `Input`, `Badge` primitives
- Replace raw HTML tags with primitives across the codebase

**Phase C — Pages (do last)**
- Apply tokens and primitives to each page
- Fix spacing rhythm
- Fix typography

Ask the user which phase to start with, or if they want to tackle a specific component or page first.

---

## Step 4: Execute Incrementally

Work through one file or component at a time. For each change:

1. Show the before (the problematic code)
2. Explain the specific problem
3. Show the after (the fix)
4. Note what token/primitive/pattern it now uses

Example:

> **Before** (`src/routes/+page.svelte:42`):
> ```svelte
> <button class="bg-blue-500 text-white px-4 py-2 rounded">Add Item</button>
> ```
> Problem: raw `<button>` tag, Tailwind default blue (`bg-blue-500`), arbitrary padding not on spacing scale.
>
> **After**:
> ```svelte
> <Button variant="default">Add Item</Button>
> ```
> Now uses the `Button` primitive which pulls from `--color-primary` and `--space-*` tokens.

---

## Step 5: Verify Consistency

After changes, check:

- [ ] Does the updated component visually match the rest of the app?
- [ ] Are all new class values referencing tokens, not Tailwind defaults?
- [ ] Does `DESIGN_SYSTEM.md` need updating to reflect any new decisions made during the audit?
- [ ] Are there other files with the same anti-pattern that should be fixed in this session?

---

## Tone During Audit

Be constructive, not condescending. The existing code was written for reasons. Lead with what's working. Frame fixes as "moving toward the design system" rather than "this is wrong." The goal is to help the developer understand the system, not just produce corrected files.
