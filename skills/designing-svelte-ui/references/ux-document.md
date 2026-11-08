# Document

**Signature:** Continuous linear flow of text and rich media. Content wraps within readable constraints. Edit-in-place, WYSIWYG experience.

## When to Use & Why

Use the Document pattern for long-form content creation, wikis, notes, article writing, and rich text editing.
**Why:** It models the physical real-world affordance of paper, minimizing UI overhead and keeping the user focused entirely on the content they are producing or consuming.

## UX Rules

### Do

- **The Paper Metaphor:** Visually distinguish the "page" from the "desk". A subtle background contrast helps frame the content boundaries.
- **Typography is UI:** The layout relies entirely on typography. Line-height must be generous (e.g., 1.6), and line length constrained (max-width ~65-70 characters) for readability.
- **Inline Actions:** Implement `/` commands for quick formatting (Notion-style) or selection-based bubble menus to keep the focus on the text, rather than distant toolbars.

### Don't

- **Layout Shifts:** Images and dynamic embeds loading must not cause the text to jump while the user is reading or typing. Reserve layout space.
- **Fixed Toolbars:** Avoid clunky, permanent top bars (like legacy Word processors) unless absolutely required by the user persona. Floating/contextual UI is superior.

## Implementation Guide (Code & UX POV)

A document requires a robust content-editable surface (like TipTap or ProseMirror) styled elegantly. Tailwind's Typography plugin (`@tailwindcss/typography`) is essential here.

### Recommended shadcn-svelte Components

- `Popover` or `Tooltip` (for the inline formatting bubble menu)
- `Command` (for the `/` slash command menu)
- `Separator` (for `<hr />` elements within the document)

### Component Recipe: `DocumentEditor.svelte`

```svelte
<script lang="ts">
	// In a real app, bind this to a rich-text editor instance like TipTap
	let { content = $bindable() } = $props<{ content?: string }>();
</script>

<!-- The "Desk" -->
<div class="flex min-h-screen justify-center bg-muted/30 px-4 py-12 sm:px-6 lg:px-8">
	<!-- The "Paper" -->
	<article
		class="min-h-[1056px] w-full max-w-3xl rounded-lg border border-border bg-background p-12 text-foreground shadow-sm transition-all outline-none focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 sm:p-24"
		contenteditable="true"
		role="textbox"
		aria-multiline="true"
		bind:innerHTML={content}
	>
		<!-- Use Tailwind Typography plugin for elegant prose styling -->
		<div class="prose max-w-none prose-slate dark:prose-invert">
			<h1>Untitled Document</h1>
			<p class="text-muted-foreground">Start typing, or press '/' for commands…</p>
			<!-- Editor content lives here -->
		</div>
	</article>
</div>
```
