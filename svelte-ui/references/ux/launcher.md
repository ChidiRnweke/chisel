# Launcher

**Signature:** A hyper-focused input surface (often an overlay) designed to exit itself immediately upon use. The destination is the product; success is the launcher vanishing. Search-first, command-driven.

## When to Use & Why
Use the Launcher (or Command Palette) pattern for power-user navigation, global search, quick actions, or OS-level entry points (like Spotlight or Raycast).
**Why:** It dramatically speeds up workflows by bypassing visual navigation entirely. It relies on keyboard muscle memory and recognition rather than recall.

## UX Rules

### Do
* **Auto-focus is Mandatory:** The input MUST capture focus immediately on mount or when summoned via keyboard shortcut (e.g., `Cmd+K` or `Ctrl+K`).
* **Keyboard First:** Provide full Up/Down/Enter/Escape navigation. The mouse is strictly secondary.
* **Fuzzy Search:** Be forgiving with typos. Match user intent, not exact substrings (e.g., searching "pr" should match "Profile" and "Preferences").
* **Categorization:** Group results logically (e.g., "Pages", "Actions", "Recent") to help users parse the list quickly.

### Don't
* **Clutter with Dashboards:** Do not put charts, widgets, or dense paragraphs in a launcher. Show "Recent" or "Suggested" only when the query is empty.
* **Tolerate Latency:** It must render and search instantly. Latency destroys trust in a utility tool. Use optimistic rendering and pre-fetching.

## Implementation Guide (Code & UX POV)

A launcher is essentially a specialized dialog containing an input and a filterable list. Managing keyboard focus (roving tabindex or aria-activedescendant) is the hardest part, which is why a headless component is vital.

### Recommended shadcn-svelte Components
* `Command` (specifically designed for this exact pattern, based on `cmdk`)
* `Dialog` (to host the Command component as an overlay)
* `Badge` (for keyboard shortcut hints)

### Component Recipe: `GlobalLauncher.svelte`

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { Calculator, Calendar, CreditCard, Settings, Smile, User } from "lucide-svelte";
  import * as Command from "$lib/components/ui/command";

  let open = $state(false);

  onMount(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        open = !open;
      }
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  });

  function executeCommand(action: () => void) {
    action();
    open = false; // The launcher must vanish upon success
  }
</script>

<!-- The trigger button (optional, usually summoned by Cmd+K) -->
<button 
  class="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 border border-border rounded-md hover:bg-muted transition-colors w-64 max-w-full"
  onclick={() => open = true}
>
  Search documentation...
  <kbd class="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
    <span class="text-xs">⌘</span>K
  </kbd>
</button>

<!-- The Launcher Overlay -->
<Command.Dialog bind:open>
  <Command.Input placeholder="Type a command or search..." />
  <Command.List>
    <Command.Empty>No results found.</Command.Empty>
    
    <Command.Group heading="Suggestions">
      <Command.Item onSelect={() => executeCommand(() => console.log('Calendar'))}>
        <Calendar class="mr-2 h-4 w-4" />
        <span>Calendar</span>
      </Command.Item>
      <Command.Item onSelect={() => executeCommand(() => console.log('Emoji'))}>
        <Smile class="mr-2 h-4 w-4" />
        <span>Search Emoji</span>
      </Command.Item>
    </Command.Group>
    
    <Command.Separator />
    
    <Command.Group heading="Settings">
      <Command.Item onSelect={() => executeCommand(() => console.log('Profile'))}>
        <User class="mr-2 h-4 w-4" />
        <span>Profile</span>
        <Command.Shortcut>⌘P</Command.Shortcut>
      </Command.Item>
      <Command.Item onSelect={() => executeCommand(() => console.log('Settings'))}>
        <Settings class="mr-2 h-4 w-4" />
        <span>Settings</span>
        <Command.Shortcut>⌘S</Command.Shortcut>
      </Command.Item>
    </Command.Group>
  </Command.List>
</Command.Dialog>
```
