# Workbench

## Table of Contents

- [When to Use & Why](#when-to-use--why)
- [UX Rules](#ux-rules)
  - [Do](#do)
  - [Don't](#dont)
- [Implementation Guide (Code & UX POV)](#implementation-guide-code--ux-pov)
  - [Recommended shadcn-svelte Components](#recommended-shadcn-svelte-components)
  - [Component Recipe: `ExpertWorkbench.svelte`](#component-recipe-expertworkbenchsvelte)

> ⚠️ **Warning:** Workbench is often an anti-pattern. Showing everything simultaneously usually means nothing is prioritized. If you are reaching for Workbench for a standard consumer app, go back and commit to a primary pattern first.
>
> The ONLY legitimate use case is highly specialized tooling for experts who already possess a complete mental model of the domain (e.g., IDEs, 3D software, video editors, advanced devtools).

**Signature:** Omnipresent UI. Multiple panels, toolbars, properties, and outputs co-exist on a fixed, unscrollable surface. Maximum data density.

## When to Use & Why

Use the Workbench pattern for professional creation tools (like VS Code, Blender, or Figma).
**Why:** Experts prioritize efficiency and spatial memory over simplicity. They need to see the canvas, tweak a property, and monitor the output simultaneously without switching tabs or losing context.

## UX Rules

### Do

- **Resizability:** Every panel MUST be resizable via draggable splitters. Experts have strong, specific preferences about screen real estate allocation.
- **Extreme Density:** Use small typography (12–13px), compact margins, and icons heavily. Efficiency is prioritized over airy aesthetics.
- **Keyboard Shortcuts:** Every meaningful action must have a keyboard binding. The mouse is too slow for workbench users.
- **Collapsibility:** Allow users to snap panels shut entirely to focus on the main workspace.

### Don't

- **Global Scrolling:** The main window should NEVER scroll. `100vh` and `overflow: hidden` are mandatory. Only specific internal panes (like a file tree or terminal) should scroll.
- **Slow Animations:** Disable long transitions. Snappiness and instant feedback are the entire point.

## Implementation Guide (Code & UX POV)

A Workbench is defined by nested, resizable panes covering the entire viewport. The `paneforge` library (underpinning shadcn's `Resizable`) is absolutely critical here.

### Recommended shadcn-svelte Components

- `Resizable` (`PaneGroup`, `Pane`, `Handle`) to build the grid.
- `ScrollArea` for internal panel scrolling.
- `Tabs` (often small, dense tabs for switching views within a specific pane).

### Component Recipe: `ExpertWorkbench.svelte`

```svelte
<script lang="ts">
	import * as Resizable from '$lib/components/ui/resizable';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { FileCode, Settings, Terminal, Play } from 'lucide-svelte';
</script>

<!-- The Workbench container must be strictly 100vh and block external scrolling -->
<div
	class="flex h-screen w-screen flex-col overflow-hidden bg-background text-[13px] selection:bg-primary/30"
>
	<!-- Tiny, dense top menu bar -->
	<header
		class="flex h-8 shrink-0 items-center gap-4 border-b border-border bg-muted/50 px-3 select-none"
	>
		<div class="flex gap-4 font-medium text-muted-foreground">
			<span class="cursor-pointer transition-colors hover:text-foreground">File</span>
			<span class="cursor-pointer transition-colors hover:text-foreground">Edit</span>
			<span class="cursor-pointer transition-colors hover:text-foreground">View</span>
			<span class="cursor-pointer transition-colors hover:text-foreground">Run</span>
		</div>
		<div class="ml-auto flex items-center gap-2">
			<button
				class="flex h-5 items-center gap-1 rounded bg-primary/20 px-2 font-medium text-primary transition-colors hover:bg-primary/30"
			>
				<Play class="size-3" /> Run Task
			</button>
		</div>
	</header>

	<div class="flex flex-1 overflow-hidden">
		<Resizable.PaneGroup direction="horizontal">
			<!-- Left Sidebar (Explorer) -->
			<Resizable.Pane defaultSize={20} minSize={15} maxSize={30} class="flex flex-col bg-muted/10">
				<div
					class="flex h-8 shrink-0 items-center border-b border-border bg-muted/30 px-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
				>
					Explorer
				</div>
				<ScrollArea class="flex-1">
					<div class="space-y-0.5 p-2">
						<div
							class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-foreground/90 hover:bg-muted/50"
						>
							<FileCode class="size-3.5 text-blue-500" /> index.ts
						</div>
						<div
							class="flex cursor-pointer items-center gap-2 rounded-sm bg-primary/10 px-2 py-1.5 font-medium text-primary"
						>
							<FileCode class="size-3.5 text-orange-500" /> app.svelte
						</div>
					</div>
				</ScrollArea>
			</Resizable.Pane>

			<Resizable.Handle withHandle class="w-1 bg-border transition-colors hover:bg-primary/50" />

			<!-- Center / Bottom Split -->
			<Resizable.Pane defaultSize={60}>
				<Resizable.PaneGroup direction="vertical">
					<!-- Main Editor Area -->
					<Resizable.Pane defaultSize={75} class="relative bg-background">
						<div
							class="absolute inset-0 m-4 flex items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/5 font-medium text-muted-foreground"
						>
							Editor Canvas
						</div>
					</Resizable.Pane>

					<Resizable.Handle
						withHandle
						class="h-1 bg-border transition-colors hover:bg-primary/50"
					/>

					<!-- Bottom Panel (Terminal/Output) -->
					<Resizable.Pane
						defaultSize={25}
						minSize={10}
						class="flex flex-col border-t border-border bg-card"
					>
						<div
							class="flex h-8 shrink-0 items-center gap-5 border-b border-border bg-muted/30 px-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
						>
							<span class="-mb-[3px] border-b-2 border-primary py-1.5 text-foreground"
								>Terminal</span
							>
							<span class="cursor-pointer hover:text-foreground">Output</span>
							<span class="cursor-pointer hover:text-foreground">Problems</span>
						</div>
						<ScrollArea
							class="flex-1 rounded-b-md bg-[#0d1117] p-3 font-mono text-[12px] text-green-400"
						>
							<span class="text-muted-foreground">~/project $</span> pnpm dev<br />
							> build started...<br />
							> compiled successfully in 124ms.<br />
							<span class="animate-pulse">_</span>
						</ScrollArea>
					</Resizable.Pane>
				</Resizable.PaneGroup>
			</Resizable.Pane>

			<Resizable.Handle withHandle class="w-1 bg-border transition-colors hover:bg-primary/50" />

			<!-- Right Sidebar (Properties) -->
			<Resizable.Pane defaultSize={20} minSize={15} maxSize={30} class="flex flex-col bg-muted/10">
				<div
					class="flex h-8 shrink-0 items-center border-b border-border bg-muted/30 px-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
				>
					Properties
				</div>
				<ScrollArea class="flex-1 p-4">
					<div class="space-y-5">
						<div class="space-y-1.5">
							<label class="text-[10px] font-semibold text-muted-foreground uppercase">Width</label>
							<input
								type="text"
								value="100%"
								class="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
							/>
						</div>
						<div class="space-y-1.5">
							<label class="text-[10px] font-semibold text-muted-foreground uppercase"
								>Display</label
							>
							<select
								class="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
							>
								<option>Flex</option>
								<option>Grid</option>
								<option>Block</option>
							</select>
						</div>
					</div>
				</ScrollArea>
			</Resizable.Pane>
		</Resizable.PaneGroup>
	</div>

	<!-- Status Bar -->
	<footer
		class="flex h-6 shrink-0 items-center justify-between bg-primary px-3 text-[11px] font-medium tracking-wide text-primary-foreground"
	>
		<div class="flex items-center gap-4">
			<span class="flex items-center gap-1.5"
				><div class="size-2 rounded-full bg-green-400"></div>
				Ready</span
			>
			<span class="flex cursor-pointer items-center gap-1.5 hover:opacity-80"
				><Settings class="size-3" /> Config</span
			>
		</div>
		<div class="flex items-center gap-4">
			<span class="cursor-pointer hover:underline">UTF-8</span>
			<span class="cursor-pointer hover:underline">Svelte</span>
		</div>
	</footer>
</div>
```
