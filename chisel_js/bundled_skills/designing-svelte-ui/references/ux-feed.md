# Feed

## Table of Contents

- [When to Use & Why](#when-to-use--why)
- [UX Rules](#ux-rules)
  - [Do](#do)
  - [Don't](#dont)
- [Implementation Guide (Code & UX POV)](#implementation-guide-code--ux-pov)
  - [Recommended shadcn-svelte Components](#recommended-shadcn-svelte-components)
  - [Component Recipe: `FeedLayout.svelte` & `FeedItem.svelte`](#component-recipe-feedlayoutsvelte--feeditemsvelte)

**Signature:** A vertical stream of discrete items, heavily triage-oriented. Items are either acted upon within the stream inline, or expanded for deeper engagement.

## When to Use & Why

Use the Feed pattern for social timelines, activity logs, notification centers, or news aggregators.
**Why:** It is optimized for continuous consumption and rapid scanning of chronologically or algorithmically sorted updates, encouraging high user engagement and retention.

## UX Rules

### Do

- **Virtualization:** If the feed has the potential to grow indefinitely, implement a virtual list (e.g., `@tanstack/svelte-virtual`) to maintain 60fps scrolling performance.
- **Skeleton Loading:** Never show a blank screen while loading more items. Show skeleton cards that match the shape of the feed items.
- **Scroll Restoration:** When a user clicks an item and then navigates back, their exact scroll position MUST be preserved. (Use SvelteKit snapshots).

### Don't

- **Pagination Links:** Use "Load More" buttons or infinite scrolling. Never use standard "Page 1, 2, 3" links for a continuous feed of transient data.
- **Trapped Gestures:** Avoid nesting vertically scrolling elements inside the main feed. Horizontal scrollers (carousels) are okay, but ensure they don't hijack vertical swipes on mobile.

## Implementation Guide (Code & UX POV)

A Feed is a repetitive list of cards. The complexity lies in performance (virtualization) and asynchronous data fetching (infinite query).

### Recommended shadcn-svelte Components

- `Card` (for rich feed items) or standard semantic HTML for simpler items.
- `Skeleton` (for the loading state at the bottom of the feed).
- `Avatar` (for user profiles attached to feed items).
- `Separator` (to divide distinct feed entries if not using cards).

### Component Recipe: `FeedLayout.svelte` & `FeedItem.svelte`

```svelte
<!-- FeedLayout.svelte -->
<script lang="ts">
	import FeedItem from './FeedItem.svelte';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { Button } from '$lib/components/ui/button';

	let { items, isLoading, onLoadMore } = $props<{
		items: any[];
		isLoading: boolean;
		onLoadMore: () => void;
	}>();
</script>

<div class="mx-auto flex min-h-screen max-w-xl flex-col border-x border-border bg-background">
	<header class="sticky top-0 z-10 border-b border-border bg-background/80 p-4 backdrop-blur-md">
		<h2 class="text-lg font-semibold text-foreground">Activity Feed</h2>
	</header>

	<div class="flex-1 divide-y divide-border">
		{#each items as item}
			<FeedItem {...item} />
		{/each}

		{#if isLoading}
			<div class="space-y-4 p-4">
				<div class="flex items-center space-x-4">
					<Skeleton class="h-10 w-10 rounded-full" />
					<div class="flex-1 space-y-2">
						<Skeleton class="h-4 w-full" />
						<Skeleton class="h-4 w-[80%]" />
					</div>
				</div>
			</div>
		{:else}
			<div class="p-6 text-center">
				<Button variant="outline" onclick={onLoadMore}>Load More</Button>
			</div>
		{/if}
	</div>
</div>
```

```svelte
<!-- FeedItem.svelte -->
<script lang="ts">
	import { Avatar, AvatarFallback, AvatarImage } from '$lib/components/ui/avatar';
	import { MessageSquare, Heart, Share } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	let { title, subtitle, date, avatar } = $props<{
		title: string;
		subtitle: string;
		date: string;
		avatar?: string;
	}>();
</script>

<article class="group cursor-pointer p-4 transition-colors hover:bg-muted/30">
	<div class="flex gap-4">
		<Avatar class="size-10 shrink-0">
			<AvatarImage src={avatar} alt={title} />
			<AvatarFallback>{title.charAt(0)}</AvatarFallback>
		</Avatar>

		<div class="min-w-0 flex-1">
			<div class="flex items-baseline justify-between gap-2">
				<h3
					class="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary"
				>
					{title}
				</h3>
				<time class="text-xs whitespace-nowrap text-muted-foreground">{date}</time>
			</div>

			<p class="mt-1 line-clamp-3 text-sm leading-relaxed text-foreground/90">
				{subtitle}
			</p>

			<!-- Inline Actions -->
			<div class="mt-3 flex gap-4 text-muted-foreground">
				<Button
					variant="ghost"
					size="sm"
					class="-ml-2 h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
				>
					<MessageSquare class="mr-1.5 size-3.5" /> Reply
				</Button>
				<Button
					variant="ghost"
					size="sm"
					class="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
				>
					<Heart class="mr-1.5 size-3.5" /> Like
				</Button>
				<Button
					variant="ghost"
					size="sm"
					class="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
				>
					<Share class="mr-1.5 size-3.5" /> Share
				</Button>
			</div>
		</div>
	</div>
</article>
```
