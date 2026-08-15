<script lang="ts">
  // ANTI-PATTERN: importing the whole models layer instead of one domain.
  import type { User } from "$lib/models";
  // ANTI-PATTERN: reaching past the notes feature's entry point.
  import NoteEditor from "$lib/components/notes/internal/editor.svelte";

  let { users = [] }: { users?: User[] } = $props();
</script>

<div class="text-fg">{users.length}<NoteEditor /></div>
