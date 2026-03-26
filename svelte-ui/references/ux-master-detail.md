# Master-Detail

## Table of Contents

- [When to Use & Why](#when-to-use--why)
- [UX Rules](#ux-rules)
  - [Do](#do)
  - [Don't](#dont)
- [Implementation Guide (Code & UX POV)](#implementation-guide-code--ux-pov)
  - [Recommended shadcn-svelte Components](#recommended-shadcn-svelte-components)
  - [Component Recipe: `MasterDetailLayout.svelte`](#component-recipe-masterdetaillayoutsvelte)

**Signature:** A bifurcated view layout—a list or table on the left (Master), and the specific content of the selected item on the right (Detail). Scanning and reading happen simultaneously.

## When to Use & Why
Use the Master-Detail pattern for email clients, note-taking apps, system logs, or dense administrative panels.
**Why:** It eliminates the "pogo-sticking" effect (clicking into an item, reading, clicking back, clicking the next item). Users can rapidly triage a list without losing context.

## UX Rules

### Do
* **Deep Linking:** The URL must reflect the selected item in the detail view (e.g., `/inbox/msg-123`).
* **Responsive Collapse:** On mobile screens, Master-Detail MUST collapse into a Drill Down pattern (List → full-page Detail). Side-by-side is strictly for desktop/tablet.
* **Persistent Active State:** Clearly highlight the currently selected item in the master list so the user never loses their place.

### Don't
* **Coupled Scrolling:** The master list and the detail panel must scroll entirely independently of each other.
* **Full Screen Blanks:** When switching items, never blank out the entire view. Keep the master list interactive while the new detail content loads (use skeletons in the detail pane).

## Implementation Guide (Code & UX POV)

Master-Detail is an exercise in CSS layout (Flexbox or CSS Grid) to ensure constrained heights (`100vh`) and independent `overflow-y-auto` panes.

### Recommended shadcn-svelte Components
* `Resizable` panels (using `paneforge`) to allow users to adjust the split width.
* `ScrollArea` (to manage the independent scrolling panes neatly).
* `Separator` (for dividing items in the master list).

### Component Recipe: `MasterDetailLayout.svelte`

```svelte
<script lang="ts">
  import * as Resizable from "$lib/components/ui/resizable";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { Inbox, FileText, Send } from "lucide-svelte";
  
  // In a real app, this would be reactive based on $page.url
  let selectedId = $state("2"); 
  
  let items = [
    { id: "1", title: "Project Update", preview: "Here is the latest..." },
    { id: "2", title: "Invoice Attached", preview: "Please see the attached..." },
    { id: "3", title: "Welcome to the team", preview: "We are excited to have you..." },
  ];
</script>

<div class="h-[calc(100vh-2rem)] w-full flex flex-col bg-background overflow-hidden border border-border rounded-xl shadow-sm">
  <!-- Top App Bar -->
  <header class="h-14 border-b border-border flex items-center px-4 shrink-0 bg-muted/30">
    <h1 class="font-semibold text-foreground flex items-center gap-2">
      <Inbox class="size-5 text-muted-foreground" />
      Inbox
    </h1>
  </header>

  <!-- Split View -->
  <Resizable.PaneGroup direction="horizontal" class="flex-1">
    
    <!-- Master List Pane -->
    <Resizable.Pane defaultSize={30} minSize={20} maxSize={40} class="bg-muted/10">
      <ScrollArea class="h-full">
        <div class="flex flex-col">
          {#each items as item (item.id)}
            <button 
              onclick={() => selectedId = item.id}
              class="
                text-left p-4 border-b border-border transition-colors relative
                {selectedId === item.id ? 'bg-background shadow-[inset_4px_0_0_0_hsl(var(--primary))]' : 'hover:bg-muted/50'}
              "
            >
              <h3 class="font-medium text-sm text-foreground">{item.title}</h3>
              <p class="text-xs text-muted-foreground truncate mt-1">{item.preview}</p>
            </button>
          {/each}
        </div>
      </ScrollArea>
    </Resizable.Pane>
    
    <Resizable.Handle withHandle class="bg-border/50" />
    
    <!-- Detail Content Pane -->
    <Resizable.Pane defaultSize={70}>
      <ScrollArea class="h-full bg-background relative">
        {#if selectedId}
          {@const activeItem = items.find(i => i.id === selectedId)}
          <div class="p-8 max-w-3xl mx-auto animate-in fade-in duration-300">
            <h2 class="text-2xl font-bold tracking-tight mb-6 text-foreground">{activeItem?.title}</h2>
            <div class="prose prose-slate dark:prose-invert prose-sm sm:prose-base max-w-none text-foreground/90">
              <p>{activeItem?.preview}</p>
              <p>Phasellus viverra nulla ut metus varius laoreet. Quisque rutrum. Aenean imperdiet. Etiam ultricies nisi vel augue. Curabitur ullamcorper ultricies nisi. Nam eget dui. Etiam rhoncus.</p>
              <p>Maecenas tempus, tellus eget condimentum rhoncus, sem quam semper libero, sit amet adipiscing sem neque sed ipsum. Nam quam nunc, blandit vel, luctus pulvinar, hendrerit id, lorem.</p>
            </div>
          </div>
        {:else}
          <div class="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground text-sm bg-muted/5">
            <FileText class="size-12 mb-4 opacity-20" />
            <p>Select an item to read.</p>
          </div>
        {/if}
      </ScrollArea>
    </Resizable.Pane>
    
  </Resizable.PaneGroup>
</div>
```
