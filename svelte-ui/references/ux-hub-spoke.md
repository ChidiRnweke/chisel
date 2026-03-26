# Hub & Spoke

**Signature:** One central Home (Hub) acting as a dispatcher, leading to isolated functional mode screens (Spokes). Navigation always retreats to the center—spokes do not connect directly to one another.

## When to Use & Why
Use the Hub & Spoke pattern for multifaceted applications where tasks are highly distinct and require focused attention (e.g., a creative suite launcher, a bank app with discrete functions like "Transfer", "Pay Bills", "Statements", or a smart home controller).
**Why:** It reduces cognitive load by strictly isolating workflows. Users don't have to keep track of where they are in a complex hierarchy; they are either "doing a specific task" or "at home".

## UX Rules

### Do
* **Isolate State:** Entering a spoke resets its internal state (or restores it explicitly from a URL/database). Never casually inherit transient state from another spoke.
* **Prominent Return:** Every spoke MUST have an unambiguous, prominent "Back to Hub" or "Home" affordance, typically in the top-left corner.
* **Deliberate Transitions:** Use visual transitions (like a scale-up or slide-over) when entering a spoke to convey entering a dedicated environment.

### Don't
* **Cross-linking:** Never link Spoke A directly to Spoke B. If a user needs to switch tasks, they must return to the Hub first.
* **Persistent Sidebars:** Do not carry a global application sidebar into a spoke. The spoke is a focused mode and should own the entire viewport.

## Implementation Guide (Code & UX POV)

The Hub is usually a grid of large cards or icons. The Spokes are full-page layouts that hijack the routing completely.

### Recommended shadcn-svelte Components
* `Card` (for the Hub entry points)
* `Button` (for the "Back to Hub" action in Spokes)

### Component Recipe: `HubLayout.svelte`

```svelte
<!-- Example of a single layout file handling both states via routing logic -->
<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ArrowLeft } from "lucide-svelte";
  
  let { children, isHome = false, title = 'Application Hub' } = $props<{
    children: any;
    isHome?: boolean;
    title?: string;
  }>();
</script>

<div class="min-h-screen bg-background">
  {#if isHome}
    <!-- Hub View -->
    <main class="container mx-auto max-w-5xl py-12 px-6">
      <div class="mb-10">
        <h1 class="text-4xl font-bold tracking-tight text-foreground">{title}</h1>
        <p class="text-muted-foreground mt-2 text-lg">Select a workspace to begin.</p>
      </div>
      <!-- Children here would be a grid of Cards routing to spokes -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {@render children()}
      </div>
    </main>
  {:else}
    <!-- Spoke View -->
    <div class="flex flex-col h-screen overflow-hidden">
      <!-- Dedicated Spoke Header -->
      <header class="h-16 border-b border-border flex items-center px-6 bg-background shrink-0 sticky top-0 z-10">
        <Button variant="ghost" size="sm" href="/" class="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft class="size-4" />
          Back to Hub
        </Button>
        <div class="mx-4 h-5 w-px bg-border"></div>
        <h2 class="text-lg font-semibold text-foreground">{title}</h2>
      </header>
      
      <!-- Spoke Content (Isolated) -->
      <main class="flex-1 overflow-y-auto bg-muted/10 p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div class="container mx-auto max-w-6xl bg-background rounded-xl border border-border shadow-sm min-h-full p-6">
          {@render children()}
        </div>
      </main>
    </div>
  {/if}
</div>
```
