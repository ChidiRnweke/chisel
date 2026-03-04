# Workbench

> ⚠️ **Warning:** Workbench is often an anti-pattern. Showing everything simultaneously usually means nothing is prioritized. If you are reaching for Workbench for a standard consumer app, go back and commit to a primary pattern first.
>
> The ONLY legitimate use case is highly specialized tooling for experts who already possess a complete mental model of the domain (e.g., IDEs, 3D software, video editors, advanced devtools).

**Signature:** Omnipresent UI. Multiple panels, toolbars, properties, and outputs co-exist on a fixed, unscrollable surface. Maximum data density.

## When to Use & Why
Use the Workbench pattern for professional creation tools (like VS Code, Blender, or Figma).
**Why:** Experts prioritize efficiency and spatial memory over simplicity. They need to see the canvas, tweak a property, and monitor the output simultaneously without switching tabs or losing context.

## UX Rules

### Do
* **Resizability:** Every panel MUST be resizable via draggable splitters. Experts have strong, specific preferences about screen real estate allocation.
* **Extreme Density:** Use small typography (12–13px), compact margins, and icons heavily. Efficiency is prioritized over airy aesthetics.
* **Keyboard Shortcuts:** Every meaningful action must have a keyboard binding. The mouse is too slow for workbench users.
* **Collapsibility:** Allow users to snap panels shut entirely to focus on the main workspace.

### Don't
* **Global Scrolling:** The main window should NEVER scroll. `100vh` and `overflow: hidden` are mandatory. Only specific internal panes (like a file tree or terminal) should scroll.
* **Slow Animations:** Disable long transitions. Snappiness and instant feedback are the entire point.

## Implementation Guide (Code & UX POV)

A Workbench is defined by nested, resizable panes covering the entire viewport. The `paneforge` library (underpinning shadcn's `Resizable`) is absolutely critical here.

### Recommended shadcn-svelte Components
* `Resizable` (`PaneGroup`, `Pane`, `Handle`) to build the grid.
* `ScrollArea` for internal panel scrolling.
* `Tabs` (often small, dense tabs for switching views within a specific pane).

### Component Recipe: `ExpertWorkbench.svelte`

```svelte
<script lang="ts">
  import * as Resizable from "$lib/components/ui/resizable";
  import { ScrollArea } from "$lib/components/ui/scroll-area";
  import { FileCode, Settings, Terminal, Play } from "lucide-svelte";
</script>

<!-- The Workbench container must be strictly 100vh and block external scrolling -->
<div class="flex flex-col h-screen w-screen bg-background text-[13px] overflow-hidden selection:bg-primary/30">
  
  <!-- Tiny, dense top menu bar -->
  <header class="h-8 border-b border-border flex items-center px-3 gap-4 bg-muted/50 shrink-0 select-none">
    <div class="flex gap-4 text-muted-foreground font-medium">
      <span class="hover:text-foreground cursor-pointer transition-colors">File</span>
      <span class="hover:text-foreground cursor-pointer transition-colors">Edit</span>
      <span class="hover:text-foreground cursor-pointer transition-colors">View</span>
      <span class="hover:text-foreground cursor-pointer transition-colors">Run</span>
    </div>
    <div class="ml-auto flex items-center gap-2">
      <button class="h-5 px-2 bg-primary/20 text-primary hover:bg-primary/30 rounded flex items-center gap-1 transition-colors font-medium">
        <Play class="size-3" /> Run Task
      </button>
    </div>
  </header>

  <div class="flex-1 flex overflow-hidden">
    <Resizable.PaneGroup direction="horizontal">
      
      <!-- Left Sidebar (Explorer) -->
      <Resizable.Pane defaultSize={20} minSize={15} maxSize={30} class="bg-muted/10 flex flex-col">
        <div class="h-8 border-b border-border flex items-center px-3 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground shrink-0 bg-muted/30">
          Explorer
        </div>
        <ScrollArea class="flex-1">
          <div class="p-2 space-y-0.5">
            <div class="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-muted/50 cursor-pointer text-foreground/90">
              <FileCode class="size-3.5 text-blue-500" /> index.ts
            </div>
            <div class="flex items-center gap-2 px-2 py-1.5 rounded-sm bg-primary/10 text-primary cursor-pointer font-medium">
              <FileCode class="size-3.5 text-orange-500" /> app.svelte
            </div>
          </div>
        </ScrollArea>
      </Resizable.Pane>

      <Resizable.Handle withHandle class="w-1 bg-border hover:bg-primary/50 transition-colors" />

      <!-- Center / Bottom Split -->
      <Resizable.Pane defaultSize={60}>
        <Resizable.PaneGroup direction="vertical">
          
          <!-- Main Editor Area -->
          <Resizable.Pane defaultSize={75} class="bg-background relative">
            <div class="absolute inset-0 flex items-center justify-center border-2 border-dashed border-border m-4 rounded-xl text-muted-foreground font-medium bg-muted/5">
              Editor Canvas
            </div>
          </Resizable.Pane>

          <Resizable.Handle withHandle class="h-1 bg-border hover:bg-primary/50 transition-colors" />

          <!-- Bottom Panel (Terminal/Output) -->
          <Resizable.Pane defaultSize={25} minSize={10} class="bg-card flex flex-col border-t border-border">
             <div class="h-8 border-b border-border flex items-center px-3 gap-5 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground shrink-0 bg-muted/30">
                <span class="text-foreground border-b-2 border-primary py-1.5 -mb-[3px]">Terminal</span>
                <span class="hover:text-foreground cursor-pointer">Output</span>
                <span class="hover:text-foreground cursor-pointer">Problems</span>
             </div>
             <ScrollArea class="flex-1 p-3 font-mono text-[12px] text-green-400 bg-[#0d1117] rounded-b-md">
               <span class="text-muted-foreground">~/project $</span> npm run dev<br>
               > build started...<br>
               > compiled successfully in 124ms.<br>
               <span class="animate-pulse">_</span>
             </ScrollArea>
          </Resizable.Pane>

        </Resizable.PaneGroup>
      </Resizable.Pane>

      <Resizable.Handle withHandle class="w-1 bg-border hover:bg-primary/50 transition-colors" />

      <!-- Right Sidebar (Properties) -->
      <Resizable.Pane defaultSize={20} minSize={15} maxSize={30} class="bg-muted/10 flex flex-col">
        <div class="h-8 border-b border-border flex items-center px-3 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground shrink-0 bg-muted/30">
          Properties
        </div>
        <ScrollArea class="flex-1 p-4">
          <div class="space-y-5">
             <div class="space-y-1.5">
               <label class="text-[10px] uppercase text-muted-foreground font-semibold">Width</label>
               <input type="text" value="100%" class="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm" />
             </div>
             <div class="space-y-1.5">
               <label class="text-[10px] uppercase text-muted-foreground font-semibold">Display</label>
               <select class="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm">
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
  <footer class="h-6 shrink-0 bg-primary text-primary-foreground flex items-center px-3 justify-between text-[11px] font-medium tracking-wide">
    <div class="flex items-center gap-4">
      <span class="flex items-center gap-1.5"><div class="size-2 bg-green-400 rounded-full"></div> Ready</span>
      <span class="flex items-center gap-1.5 hover:opacity-80 cursor-pointer"><Settings class="size-3" /> Config</span>
    </div>
    <div class="flex items-center gap-4">
      <span class="hover:underline cursor-pointer">UTF-8</span>
      <span class="hover:underline cursor-pointer">Svelte</span>
    </div>
  </footer>
</div>
```
