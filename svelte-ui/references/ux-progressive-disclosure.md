# Progressive Disclosure

**Signature:** A single surface where depth is provided on demand. Everything exists, but complexity is hidden by default until explicitly requested by the user.

## When to Use & Why
Use the Progressive Disclosure pattern for complex settings panels, advanced search filters, form fields, and onboarding flows.
**Why:** It reduces initial cognitive load. It prevents overwhelming novice users while still offering the power and granularity required by expert users. It keeps the primary interface clean and focused.

## UX Rules

### Do
* **The 80/20 Rule:** Surface the 20% of options that are used 80% of the time as defaults. Hide the remaining 80% behind an "Advanced" or "More" toggle.
* **In-place Expansion:** When "More" is clicked, expand the content inline (e.g., via an Accordion or Collapsible) or open a Drawer. Do not navigate the user away to a completely different page for a minor setting.
* **Smart Defaults:** Pre-fill the hidden advanced settings with sensible, safe values. Most users shouldn't ever need to open the disclosure panel.

### Don't
* **Hide Critical Path:** Never hide primary actions ("Submit", "Save", "Delete") or mandatory form fields behind a disclosure toggle.
* **Accordion Hell:** Avoid nesting disclosures deeply (e.g., an accordion inside an accordion). If you need multiple levels, you probably need a Drill Down or Hub & Spoke pattern instead.

## Implementation Guide (Code & UX POV)

Implementation requires accessible toggle states tied to expandable containers. Smooth animation (measuring content height) makes the interaction feel polished rather than abrupt.

### Recommended shadcn-svelte Components
* `Collapsible` (for a single hidden section, like "Advanced Settings")
* `Accordion` (for multiple sections where only one or a few should be open at a time)
* `Switch` or `Checkbox` (if enabling a feature reveals its sub-settings)

### Component Recipe: `AdvancedSettings.svelte`

```svelte
<script lang="ts">
  import * as Collapsible from "$lib/components/ui/collapsible";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { ChevronDown, ChevronUp, Settings2 } from "lucide-svelte";

  let isOpen = $state(false);
</script>

<div class="max-w-xl mx-auto p-6 border border-border rounded-xl bg-card text-card-foreground shadow-sm">
  <div class="space-y-4">
    <div>
      <h3 class="text-lg font-semibold text-foreground">Database Connection</h3>
      <p class="text-sm text-muted-foreground">Configure your primary database URL.</p>
    </div>
    
    <!-- Primary (always visible) field -->
    <div class="space-y-2">
      <Label for="db-url">Connection String</Label>
      <Input id="db-url" placeholder="postgresql://user:pass@localhost:5432/db" />
    </div>

    <!-- Progressive Disclosure -->
    <Collapsible.Root bind:open={isOpen} class="w-full mt-6">
      <div class="flex items-center justify-between border-t border-border pt-4">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <Settings2 class="size-4" />
          <span>Advanced Configuration</span>
        </div>
        <Collapsible.Trigger asChild let:builder>
          <Button builders={[builder]} variant="ghost" size="sm" class="h-8 gap-1 text-muted-foreground hover:text-foreground">
            {isOpen ? 'Hide' : 'Show'}
            {#if isOpen}
              <ChevronUp class="size-4" />
            {:else}
              <ChevronDown class="size-4" />
            {/if}
          </Button>
        </Collapsible.Trigger>
      </div>
      
      <Collapsible.Content class="space-y-4 pt-4 animate-in slide-in-from-top-2 duration-200">
        <div class="grid grid-cols-2 gap-4 bg-muted/30 p-5 rounded-lg border border-border">
          <div class="space-y-2">
            <Label for="pool-size">Max Pool Size</Label>
            <Input id="pool-size" type="number" value="10" class="bg-background" />
          </div>
          <div class="space-y-2">
            <Label for="timeout">Idle Timeout (ms)</Label>
            <Input id="timeout" type="number" value="10000" class="bg-background" />
          </div>
          <div class="space-y-2 col-span-2 mt-2">
            <Label for="ssl">SSL Mode</Label>
            <Input id="ssl" value="require" class="bg-background" />
          </div>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  </div>
</div>
```
