# Timeline

**Signature:** Time treated as a spatial, manipulatable axis. Events are mapped sequentially, where duration, sequence, and overlap are the primary visual indicators.

## When to Use & Why

Use the Timeline pattern for scheduling, historical logs, video/audio editors, tracking order history, or calendars.
**Why:** It translates abstract chronological data into physical space. Humans are excellent at spatial reasoning; seeing a wide block next to a narrow block instantly communicates duration better than comparing two timestamps textually.

## UX Rules

### Do

- **Zoom Levels:** Time is relative. Provide mechanisms to switch between Day / Week / Month granularity (or seconds/minutes for media editors).
- **"Now" Indicator:** Always render a distinct visual line (usually vertical and colored, like a red playhead) indicating the current time.
- **Clash Detection:** If overlapping events are problematic in the given domain (e.g., booking the same meeting room), make them visually distinct and obvious.

### Don't

- **Table Layouts:** Never use an HTML `<table>` for a continuous timeline. Time is fluid, not discrete. Use absolute positioning or CSS Grid to place time blocks accurately.
- **Tiny Targets:** A 5-minute event might render as 2 pixels wide. Enforce a minimum width/height for interaction (e.g., min 44px) so it remains clickable, even if visually it implies a slightly longer duration.

## Implementation Guide (Code & UX POV)

A Timeline relies heavily on absolute positioning within a relative container. The width of the container represents total time, and the `left` property of an event represents its start offset.

### Recommended shadcn-svelte Components

- `Card` or custom div (for the event blocks)
- `HoverCard` or `Tooltip` (to reveal detailed information about an event when space is tight)
- `ScrollArea` (for navigating long timelines)

### Component Recipe: `TimelineTrack.svelte`

```svelte
<script lang="ts">
	import { Tooltip, TooltipContent, TooltipTrigger } from '$lib/components/ui/tooltip';

	type Event = { id: string; startHour: number; duration: number; label: string; color?: string };
	let { events = [] } = $props<{ events: Event[] }>();

	const hourWidth = 120; // pixels per hour
	const totalWidth = 24 * hourWidth;

	const getLeft = (start: number) => `${start * hourWidth}px`;
	const getWidth = (duration: number) => `${duration * hourWidth}px`;
</script>

<div class="w-full overflow-x-auto rounded-lg border border-border bg-background p-4 shadow-sm">
	<div
		class="relative h-24 rounded-md border border-border bg-muted/10"
		style="width: {totalWidth}px"
	>
		<!-- Time Markers (Background Grid) -->
		{#each Array(24) as _, i}
			<div
				class="absolute top-0 bottom-0 flex flex-col justify-between border-l border-border/50 py-1"
				style="left: {i * hourWidth}px"
			>
				<span class="pl-1.5 text-[10px] font-medium text-muted-foreground">
					{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
				</span>
			</div>
		{/each}

		<!-- "Now" Indicator (Example static placement) -->
		<div
			class="absolute top-0 bottom-0 z-20 flex flex-col items-center border-l-2 border-destructive"
			style="left: {10.5 * hourWidth}px"
		>
			<div class="size-2 -translate-y-1 rounded-full bg-destructive"></div>
		</div>

		<!-- Events -->
		{#each events as event (event.id)}
			<Tooltip>
				<TooltipTrigger asChild let:builder>
					<button
						builders={[builder]}
						class="absolute top-6 bottom-4 overflow-hidden rounded-md border p-2 text-left shadow-sm transition-all hover:z-30 hover:brightness-95 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
						style="
              left: {getLeft(event.startHour)}; 
              width: {getWidth(event.duration)};
              background-color: {event.color || 'hsl(var(--primary) / 0.1)'};
              border-color: {event.color ? 'transparent' : 'hsl(var(--primary) / 0.2)'};
              color: {event.color ? '#fff' : 'hsl(var(--foreground))'};
            "
					>
						<span class="block truncate text-xs font-medium">{event.label}</span>
					</button>
				</TooltipTrigger>
				<TooltipContent>
					<p class="font-semibold text-foreground">{event.label}</p>
					<p class="text-xs text-muted-foreground">Duration: {event.duration} hours</p>
				</TooltipContent>
			</Tooltip>
		{/each}
	</div>
</div>
```
