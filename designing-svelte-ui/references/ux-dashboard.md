# Dashboard

## Table of Contents

- [When to Use & Why](#when-to-use--why)
- [UX Rules](#ux-rules)
  - [Do](#do)
  - [Don't](#dont)
- [Implementation Guide (Code & UX POV)](#implementation-guide-code--ux-pov)
  - [Recommended shadcn-svelte Components](#recommended-shadcn-svelte-components)
  - [Component Recipe: `DashboardLayout.svelte` & `StatCard.svelte`](#component-recipe-dashboardlayoutsvelte--statcardsvelte)

**Signature:** Simultaneous overview of multiple data streams and key metrics. Read-heavy, allowing users to assess status at a glance and act from within. High-level signal, low-level noise.

## When to Use & Why
Use the Dashboard pattern for home screens, analytical views, and system monitoring. 
**Why:** It aggregates disparate information into a single cohesive view, enabling users to quickly identify anomalies, track progress, or understand overall health without navigating through multiple pages.

## UX Rules

### Do
* **Visual Hierarchy:** Place critical KPIs (single big numbers) at the top, charts/graphs in the middle, and detailed lists or recent activities at the bottom.
* **Grid Consistency:** All widgets must align to a grid and use consistent padding, typography, and border-radius.
* **Contextual Empty States:** A dashboard with no data looks broken. Provide "Setup" widgets or onboarding tasks to guide the user to populate the data.

### Don't
* **Endless Scrolling:** A dashboard should ideally fit above the fold or require minimal scrolling. If it's too long, break it into separate tabs or views.
* **Interactivity Overload:** Never embed complex, multi-step forms inside dashboard widgets. Link out to a dedicated view for deep actions.

## Implementation Guide (Code & UX POV)

Dashboards rely on a responsive grid layout. Use CSS Grid to automatically adjust widget placement based on screen size. Widgets should be modular, self-contained components.

### Recommended shadcn-svelte Components
* `Card` (the foundational container for every widget)
* `Skeleton` (for loading states of individual widgets)
* `Table` (for recent activity lists within a widget)
* `Tabs` (to separate different dashboard contexts, e.g., "Overview", "Analytics")

### Component Recipe: `DashboardLayout.svelte` & `StatCard.svelte`

```svelte
<!-- DashboardLayout.svelte -->
<script lang="ts">
  import StatCard from "./StatCard.svelte";
</script>

<div class="p-8 space-y-8 bg-background min-h-screen">
  <div>
    <h2 class="text-3xl font-bold tracking-tight text-foreground">Dashboard</h2>
    <p class="text-muted-foreground">Overview of your current metrics.</p>
  </div>

  <!-- KPIs Grid -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <StatCard label="Total Revenue" value="$45,231.89" trend="+20.1%" trendDir="up" />
    <StatCard label="Subscriptions" value="+2350" trend="+180.1%" trendDir="up" />
    <StatCard label="Sales" value="+12,234" trend="+19%" trendDir="up" />
    <StatCard label="Active Now" value="+573" trend="-201" trendDir="down" />
  </div>

  <!-- Charts & Lists Grid -->
  <div class="grid grid-cols-1 lg:grid-cols-7 gap-4">
    <div class="lg:col-span-4 border border-border rounded-xl p-6 bg-card text-card-foreground shadow-sm">
      <h3 class="font-semibold mb-4">Overview Chart</h3>
      <!-- Insert Chart Component Here -->
      <div class="h-[300px] w-full bg-muted/20 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground">Chart Area</div>
    </div>
    <div class="lg:col-span-3 border border-border rounded-xl p-6 bg-card text-card-foreground shadow-sm">
      <h3 class="font-semibold mb-4">Recent Sales</h3>
      <!-- Insert List/Table Component Here -->
      <div class="h-[300px] w-full bg-muted/20 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground">List Area</div>
    </div>
  </div>
</div>
```

```svelte
<!-- StatCard.svelte -->
<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { ArrowUpRight, ArrowDownRight } from "lucide-svelte";

  let { label, value, trend, trendDir = 'up' } = $props<{
    label: string;
    value: string;
    trend?: string;
    trendDir?: 'up' | 'down';
  }>();
</script>

<Card>
  <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
    <CardTitle class="text-sm font-medium text-muted-foreground">{label}</CardTitle>
    <!-- Optional Icon slot here -->
  </CardHeader>
  <CardContent>
    <div class="text-2xl font-bold text-foreground">{value}</div>
    {#if trend}
      <p class="text-xs text-muted-foreground flex items-center mt-1">
        <span class="mr-1 flex items-center {trendDir === 'up' ? 'text-emerald-500' : 'text-red-500'}">
          {#if trendDir === 'up'}
            <ArrowUpRight class="size-3 mr-0.5" />
          {:else}
            <ArrowDownRight class="size-3 mr-0.5" />
          {/if}
          {trend}
        </span>
        from last month
      </p>
    {/if}
  </CardContent>
</Card>
```
