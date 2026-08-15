<script lang="ts">
  import type { Todo } from "$lib/models/todos";
  // Inside the feature its own layout is its business, so a relative import here
  // is correct — the index.ts contract is for callers outside the folder.
  import TodoCard from "./todo-card.svelte";

  let { todos }: { todos: readonly Todo[] } = $props();
</script>

<ul class="flex flex-col gap-2">
  {#each todos as todo (todo.id)}
    <li><TodoCard {todo} /></li>
  {/each}
</ul>
