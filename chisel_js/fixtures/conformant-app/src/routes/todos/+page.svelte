<script lang="ts">
  import PageShell from "$lib/components/layout/page-shell.svelte";
  // Through the feature's entry point, not into its internals.
  import { TodoList } from "$lib/components/todos";

  let { data } = $props();
</script>

<PageShell title="Todos">
  <TodoList todos={data.todos} />
</PageShell>
