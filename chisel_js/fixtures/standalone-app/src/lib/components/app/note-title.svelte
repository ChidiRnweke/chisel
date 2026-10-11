<script lang="ts">
  import type { Note } from "$lib/models/domain";
  let { note }: { note: Note } = $props();
</script>

<h1 class="text-2xl font-semibold">{note.title}</h1>
