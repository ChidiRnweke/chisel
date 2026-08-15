<script lang="ts">
  import type { Snippet } from "svelte";

  let { title, children }: { title: string; children: Snippet } = $props();
</script>

<!-- Presentation infrastructure: layout/ publishes no index.ts on purpose, so it
     is imported by deep path. It names a real role rather than collecting
     whatever had no home. -->
<div class="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
  <header>
    <h1 class="text-xl font-semibold text-foreground">{title}</h1>
  </header>
  {@render children()}
</div>
