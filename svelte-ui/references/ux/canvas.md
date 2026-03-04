# Canvas

**Signature:** Freeform two-dimensional spatial workspace. Objects are placed, connected, moved, and manipulated. Position and spatial relationships convey meaning.

## When to Use & Why
Use the Canvas pattern when the primary task involves spatial reasoning, complex relationships, or unstructured brainstorming (e.g., whiteboards, node-based editors, design tools, map explorers). 
**Why:** It removes linear constraints, allowing users to build mental models by grouping and connecting concepts spatially. It is not suitable for structured data entry or linear reading.

## UX Rules

### Do
* **Infinite Pan/Zoom:** Users expect to drag the background to move and scroll/pinch to zoom seamlessly.
* **Minimap & Navigation:** If the canvas is large, provide a small overview map (minimap) in a corner to prevent users from getting lost.
* **Selection Mechanics:** Support standard OS-level interactions: click to select, drag to move, Shift+Click or drag-box to multi-select.
* **Contextual Tooling:** Keep a floating toolbar or context menu visible near the selection or at screen edges.

### Don't
* **Standard Scrollbars:** Browser scrollbars break the infinite canvas illusion. Use a grab cursor and custom panning logic.
* **Lose Context:** Never let the user pan so far they can't find their way back. Provide a "Fit to screen" or "Return to origin" button.

## Implementation Guide (Code & UX POV)

To implement a Canvas, you need to manage a global transform state (x, y, scale) and apply it to a container, while keeping UI controls fixed.

### Recommended shadcn-svelte Components
* `Button` (for floating toolbar controls)
* `Tooltip` (for explaining toolbar actions)
* `DropdownMenu` (for context menus on canvas elements)

### Component Recipe: `InfiniteCanvas.svelte`

```svelte
<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Plus, Minus, Maximize } from "lucide-svelte";

  let pos = $state({ x: 0, y: 0, scale: 1 });

  function handleWheel(e: WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoom = e.deltaY * -0.001;
      pos.scale = Math.min(Math.max(0.1, pos.scale + zoom), 5);
    } else {
      pos.x -= e.deltaX;
      pos.y -= e.deltaY;
    }
  }

  function fitToScreen() {
    pos = { x: 0, y: 0, scale: 1 };
  }
</script>

<div
  class="relative w-full h-screen overflow-hidden cursor-grab active:cursor-grabbing bg-background"
  onwheel={handleWheel}
  role="application"
  aria-label="Interactive Canvas"
>
  <!-- Grid Background (scales and pans with the canvas) -->
  <div
    class="absolute inset-0 pointer-events-none opacity-20"
    style="
      background-image: radial-gradient(circle, currentColor 1px, transparent 1px);
      background-size: {20 * pos.scale}px {20 * pos.scale}px;
      background-position: {pos.x}px {pos.y}px;
    "
  ></div>

  <!-- Transformed Canvas World -->
  <div
    class="absolute origin-top-left will-change-transform"
    style="transform: translate({pos.x}px, {pos.y}px) scale({pos.scale})"
  >
    <!-- Render canvas nodes, connections, etc. here -->
    <slot />
  </div>

  <!-- Fixed UI: Floating toolbar -->
  <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-2 bg-background/80 backdrop-blur-sm border border-border rounded-full shadow-lg">
    <Button variant="ghost" size="icon" class="rounded-full" onclick={() => pos.scale += 0.1} title="Zoom In">
      <Plus class="size-4" />
    </Button>
    <Button variant="ghost" size="icon" class="rounded-full" onclick={() => pos.scale -= 0.1} title="Zoom Out">
      <Minus class="size-4" />
    </Button>
    <div class="w-px h-4 bg-border mx-1"></div>
    <Button variant="ghost" size="icon" class="rounded-full" onclick={fitToScreen} title="Fit to screen">
      <Maximize class="size-4" />
    </Button>
  </div>
</div>
```
