# Timeline

**Signature:** Time treated as a spatial, manipulatable axis. Events are mapped sequentially, where duration, sequence, and overlap are the primary visual indicators.

## When to Use & Why
Use the Timeline pattern for scheduling, historical logs, video/audio editors, tracking order history, or calendars.
**Why:** It translates abstract chronological data into physical space. Humans are excellent at spatial reasoning; seeing a wide block next to a narrow block instantly communicates duration better than comparing two timestamps textually.

## UX Rules

### Do
* **Zoom Levels:** Time is relative. Provide mechanisms to switch between Day / Week / Month granularity (or seconds/minutes for media editors).
* **"Now" Indicator:** Always render a distinct visual line (usually vertical and colored, like a red playhead) indicating the current time.
* **Clash Detection:** If overlapping events are problematic in the given domain (e.g., booking the same meeting room), make them visually distinct and obvious.

### Don't
* **Table Layouts:** Never use an HTML `<table>` for a continuous timeline. Time is fluid, not discrete. Use absolute positioning or CSS Grid to place time blocks accurately.
* **Tiny Targets:** A 5-minute event might render as 2 pixels wide. Enforce a minimum width/height for interaction (e.g., min 44px) so it remains clickable, even if visually it implies a slightly longer duration.

## Implementation Guide (Code & UX POV)

A Timeline relies heavily on absolute positioning within a relative container. The width of the container represents total time, and the `left` property of an event represents its start offset.

### Recommended shadcn-svelte Components
* `Card` or custom div (for the event blocks)
* `HoverCard` or `Tooltip` (to reveal detailed information about an event when space is tight)
* `ScrollArea` (for navigating long timelines)

### Component Recipe: `TimelineTrack.svelte`

```svelte
<script lang="ts">
  import { Tooltip, TooltipContent, TooltipTrigger } from "$lib/components/ui/tooltip";

  type Event = { id: string; startHour: number; duration: number; label: string; color?: string };
  let { events = [] } = $props<{ events: Event[] }>();
  
  const hourWidth = 120; // pixels per hour
  const totalWidth = 24 * hourWidth;

  const getLeft = (start: number) => `${start * hourWidth}px`;
  const getWidth = (duration: number) => `${duration * hourWidth}px`;
</script>

<div class="w-full overflow-x-auto border border-border rounded-lg bg-background p-4 shadow-sm">
  <div class="relative h-24 bg-muted/10 rounded-md border border-border" style="width: {totalWidth}px">
    
    <!-- Time Markers (Background Grid) -->
    {#each Array(24) as _, i}
      <div
        class="absolute top-0 bottom-0 border-l border-border/50 flex flex-col justify-between py-1"
        style="left: {i * hourWidth}px"
      >
        <span class="text-[10px] text-muted-foreground pl-1.5 font-medium">
          {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
        </span>
      </div>
    {/each}

    <!-- "Now" Indicator (Example static placement) -->
    <div 
      class="absolute top-0 bottom-0 border-l-2 border-destructive z-20 flex flex-col items-center"
      style="left: {10.5 * hourWidth}px"
    >
      <div class="size-2 bg-destructive rounded-full -translate-y-1"></div>
    </div>

    <!-- Events -->
    {#each events as event (event.id)}
      <Tooltip>
        <TooltipTrigger asChild let:builder>
          <button
            builders={[builder]}
            class="absolute top-6 bottom-4 rounded-md border shadow-sm p-2 text-left overflow-hidden hover:z-30 hover:brightness-95 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            style="
              left: {getLeft(event.startHour)}; 
              width: {getWidth(event.duration)};
              background-color: {event.color || 'hsl(var(--primary) / 0.1)'};
              border-color: {event.color ? 'transparent' : 'hsl(var(--primary) / 0.2)'};
              color: {event.color ? '#fff' : 'hsl(var(--foreground))'};
            "
          >
            <span class="font-medium text-xs truncate block">{event.label}</span>
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
