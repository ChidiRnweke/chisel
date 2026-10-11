# Drill Down

**Signature:** Strict hierarchy traversal. Navigating from a broad list to a specific detail view, and potentially into sub-details. Breadcrumbs act as the primary map of depth.

## When to Use & Why
Use the Drill Down pattern for navigating deeply nested hierarchical data, complex settings menus, file systems, or organizational structures.
**Why:** It breaks complex, deep information architectures into digestible, step-by-step choices, preventing overwhelming the user with too many options on a single screen.

## UX Rules

### Do
* **URL Mirroring:** The URL structure MUST strictly mirror the UI depth (e.g., `/orgs/[id]/repos/[id]/settings`).
* **Breadcrumbs:** Keep breadcrumbs always visible and clickable at the top of the content area. The current page should be the last item, unlinked.
* **Reliable Back Behavior:** The browser's Back button must step up exactly one level of the hierarchy natively—no custom JavaScript routing hacks that break expectations.

### Don't
* **Modals for Depth:** Never open a full sub-detail view in a modal or dialog if it has its own distinct URL or deep data structure. Navigate to a full page instead.
* **Orphaned Pages:** Every page reached via Drill Down must have a traceable, clickable parent in the breadcrumb trail.

## Implementation Guide (Code & UX POV)

Drill downs rely heavily on your framework's router (e.g., SvelteKit's nested routing). The UI primarily consists of lists (for the parent view) and breadcrumbs (for context in the child view).

### Recommended shadcn-svelte Components
* `Breadcrumb` (essential for pathfinding)
* `Table` or `Command` list (for selecting the child to drill into)
* `Button` (with a back icon for mobile layouts)

### Component Recipe: `DrillDownHeader.svelte`

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, BreadcrumbList } from "$lib/components/ui/breadcrumb";
  import { ChevronRight, Home } from "lucide-svelte";

  // Example: split pathname into crumbs
  let crumbs = $derived($page.url.pathname.split('/').filter(Boolean));
</script>

<div class="mb-8">
  <Breadcrumb>
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink href="/" class="flex items-center gap-1">
          <Home class="size-3" />
          <span class="sr-only">Home</span>
        </BreadcrumbLink>
      </BreadcrumbItem>
      
      {#each crumbs as crumb, i}
        <BreadcrumbSeparator>
          <ChevronRight class="size-3.5" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          {#if i === crumbs.length - 1}
            <BreadcrumbPage class="capitalize">{crumb.replace(/-/g, ' ')}</BreadcrumbPage>
          {:else}
            <BreadcrumbLink href={'/' + crumbs.slice(0, i + 1).join('/')} class="capitalize">
              {crumb.replace(/-/g, ' ')}
            </BreadcrumbLink>
          {/if}
        </BreadcrumbItem>
      {/each}
    </BreadcrumbList>
  </Breadcrumb>
  
  <h1 class="text-3xl font-bold tracking-tight text-foreground mt-4 capitalize">
    {crumbs[crumbs.length - 1]?.replace(/-/g, ' ') || 'Home'}
  </h1>
</div>
```
