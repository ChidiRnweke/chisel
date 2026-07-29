<script lang="ts">
  import type { Note } from "$lib/models/domain";
  let { note }: { note: Note } = $props();
</script>

<h1>{note.title}</h1>
