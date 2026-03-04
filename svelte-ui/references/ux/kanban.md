# Kanban

**Signature:** Items represented as cards moving through explicit, sequential state columns. The lifecycle and status of an item are the primary concerns.

## When to Use & Why
Use the Kanban pattern for project management, issue tracking, sales pipelines, and structured workflows where items progress through defined phases.
**Why:** It provides an immediate, high-level visual summary of work in progress, bottlenecks, and overall throughput, mapped directly to a team's real-world process.

## UX Rules

### Do
* **Drag & Drop as Primary:** Moving cards visually between columns is the core interaction. Invest in a robust drag-and-drop library (like `@dnd-kit/core` or `svelte-dnd-action`).
* **Meaningful Columns:** Columns must represent a distinct status field (e.g., Todo → In Progress → Review → Done).
* **Quantify Work:** Always display the item count in the column header to help identify bottlenecks instantly.

### Don't
* **Overcrowd Columns:** Kanban breaks down when a single column has 100+ items. Enforce archiving, pagination, or strict filtering to keep boards manageable.
* **Hide Fallback Actions:** Drag and drop is not accessible to everyone. Provide a keyboard-accessible "Move to..." menu via a dropdown on every card.

## Implementation Guide (Code & UX POV)

Kanban requires a flex container for horizontal scrolling of columns, and vertical scrolling within the columns.

### Recommended shadcn-svelte Components
* `Card` (for the draggable items)
* `ScrollArea` (for the columns, if necessary, though native CSS `overflow-y-auto` is often better)
* `DropdownMenu` (for accessible "Move to" actions)
* `Badge` (for item labels or column counts)

### Component Recipe: `KanbanBoard.svelte`

```svelte
<script lang="ts">
  import { Card, CardContent } from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { MoreHorizontal, Plus } from "lucide-svelte";

  type Task = { id: string; title: string; priority: string };
  type Column = { id: string; title: string; items: Task[] };
  
  let { columns = [] } = $props<{ columns: Column[] }>();
  
  // Note: Actual drag-and-drop wiring is omitted for brevity.
  // Use a library like `svelte-dnd-action` on the column containers.
</script>

<!-- Board Container: Horizontally scrollable -->
<div class="flex h-[calc(100vh-8rem)] w-full gap-6 overflow-x-auto p-6 bg-muted/20 items-start">
  
  {#each columns as col (col.id)}
    <!-- Column -->
    <div class="w-80 shrink-0 flex flex-col max-h-full bg-muted/50 rounded-xl border border-border">
      
      <!-- Column Header -->
      <div class="flex items-center justify-between p-4 cursor-grab active:cursor-grabbing">
        <div class="flex items-center gap-2">
          <h3 class="font-semibold text-foreground text-sm">{col.title}</h3>
          <Badge variant="secondary" class="rounded-full px-2 py-0 text-xs font-normal">
            {col.items.length}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" class="size-6 text-muted-foreground">
          <MoreHorizontal class="size-4" />
        </Button>
      </div>

      <!-- Column Content (Dropzone) -->
      <div class="flex-1 overflow-y-auto p-3 pt-0 flex flex-col gap-3 min-h-[150px]">
        {#each col.items as item (item.id)}
          <!-- Draggable Card -->
          <Card class="cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors shadow-sm">
            <CardContent class="p-3">
              <p class="text-sm font-medium text-foreground mb-3">{item.title}</p>
              <div class="flex items-center justify-between">
                <Badge variant="outline" class="text-[10px] px-1.5 py-0 uppercase tracking-wider text-muted-foreground">
                  {item.priority}
                </Badge>
                <!-- Avatar or assignee could go here -->
                <div class="size-5 rounded-full bg-border"></div>
              </div>
            </CardContent>
          </Card>
        {/each}
        
        <!-- Quick Add Action -->
        <Button variant="ghost" class="w-full justify-start text-muted-foreground hover:text-foreground text-sm py-2 h-auto mt-1">
          <Plus class="size-4 mr-2" />
          Add Card
        </Button>
      </div>
    </div>
  {/each}

  <!-- Add Column Button -->
  <button class="w-80 shrink-0 h-14 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-foreground hover:bg-muted/50 transition-all font-medium text-sm">
    <Plus class="size-4 mr-2" />
    Add Column
  </button>
</div>
```
