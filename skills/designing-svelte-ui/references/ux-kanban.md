# Kanban

## Table of Contents

- [When to Use & Why](#when-to-use--why)
- [UX Rules](#ux-rules)
  - [Do](#do)
  - [Don't](#dont)
- [Implementation Guide (Code & UX POV)](#implementation-guide-code--ux-pov)
  - [Recommended shadcn-svelte Components](#recommended-shadcn-svelte-components)
  - [Component Recipe: `KanbanBoard.svelte`](#component-recipe-kanbanboardsvelte)

**Signature:** Items represented as cards moving through explicit, sequential state columns. The lifecycle and status of an item are the primary concerns.

## When to Use & Why

Use the Kanban pattern for project management, issue tracking, sales pipelines, and structured workflows where items progress through defined phases.
**Why:** It provides an immediate, high-level visual summary of work in progress, bottlenecks, and overall throughput, mapped directly to a team's real-world process.

## UX Rules

### Do

- **Drag & Drop as Primary:** Moving cards visually between columns is the core interaction. Invest in a robust drag-and-drop library (like `@dnd-kit/core` or `svelte-dnd-action`).
- **Meaningful Columns:** Columns must represent a distinct status field (e.g., Todo → In Progress → Review → Done).
- **Quantify Work:** Always display the item count in the column header to help identify bottlenecks instantly.

### Don't

- **Overcrowd Columns:** Kanban breaks down when a single column has 100+ items. Enforce archiving, pagination, or strict filtering to keep boards manageable.
- **Hide Fallback Actions:** Drag and drop is not accessible to everyone. Provide a keyboard-accessible "Move to..." menu via a dropdown on every card.

## Implementation Guide (Code & UX POV)

Kanban requires a flex container for horizontal scrolling of columns, and vertical scrolling within the columns.

### Recommended shadcn-svelte Components

- `Card` (for the draggable items)
- `ScrollArea` (for the columns, if necessary, though native CSS `overflow-y-auto` is often better)
- `DropdownMenu` (for accessible "Move to" actions)
- `Badge` (for item labels or column counts)

### Component Recipe: `KanbanBoard.svelte`

```svelte
<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { MoreHorizontal, Plus } from 'lucide-svelte';

	type Task = { id: string; title: string; priority: string };
	type Column = { id: string; title: string; items: Task[] };

	let { columns = [] } = $props<{ columns: Column[] }>();

	// Note: Actual drag-and-drop wiring is omitted for brevity.
	// Use a library like `svelte-dnd-action` on the column containers.
</script>

<!-- Board Container: Horizontally scrollable -->
<div class="flex h-[calc(100vh-8rem)] w-full items-start gap-6 overflow-x-auto bg-muted/20 p-6">
	{#each columns as col (col.id)}
		<!-- Column -->
		<div class="flex max-h-full w-80 shrink-0 flex-col rounded-xl border border-border bg-muted/50">
			<!-- Column Header -->
			<div class="flex cursor-grab items-center justify-between p-4 active:cursor-grabbing">
				<div class="flex items-center gap-2">
					<h3 class="text-sm font-semibold text-foreground">{col.title}</h3>
					<Badge variant="secondary" class="rounded-full px-2 py-0 text-xs font-normal">
						{col.items.length}
					</Badge>
				</div>
				<Button variant="ghost" size="icon" class="size-6 text-muted-foreground">
					<MoreHorizontal class="size-4" />
				</Button>
			</div>

			<!-- Column Content (Dropzone) -->
			<div class="flex min-h-[150px] flex-1 flex-col gap-3 overflow-y-auto p-3 pt-0">
				{#each col.items as item (item.id)}
					<!-- Draggable Card -->
					<Card
						class="cursor-grab shadow-sm transition-colors hover:border-primary/50 active:cursor-grabbing"
					>
						<CardContent class="p-3">
							<p class="mb-3 text-sm font-medium text-foreground">{item.title}</p>
							<div class="flex items-center justify-between">
								<Badge
									variant="outline"
									class="px-1.5 py-0 text-[10px] tracking-wider text-muted-foreground uppercase"
								>
									{item.priority}
								</Badge>
								<!-- Avatar or assignee could go here -->
								<div class="size-5 rounded-full bg-border"></div>
							</div>
						</CardContent>
					</Card>
				{/each}

				<!-- Quick Add Action -->
				<Button
					variant="ghost"
					class="mt-1 h-auto w-full justify-start py-2 text-sm text-muted-foreground hover:text-foreground"
				>
					<Plus class="mr-2 size-4" />
					Add Card
				</Button>
			</div>
		</div>
	{/each}

	<!-- Add Column Button -->
	<button
		class="flex h-14 w-80 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground transition-all hover:border-foreground hover:bg-muted/50"
	>
		<Plus class="mr-2 size-4" />
		Add Column
	</button>
</div>
```
