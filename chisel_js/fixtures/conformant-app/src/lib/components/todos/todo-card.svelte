<script lang="ts">
  import type { Todo } from "$lib/models/todos";

  let { todo }: { todo: Todo } = $props();
</script>

<article class="rounded-lg border border-border bg-card p-4">
  <h3 class="text-sm font-medium text-card-foreground">{todo.title}{todo.status === "done" ? " (done)" : ""}</h3>
  <p class="text-xs text-muted-foreground">{todo.status}</p>
</article>
