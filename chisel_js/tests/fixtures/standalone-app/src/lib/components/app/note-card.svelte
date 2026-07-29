<script lang="ts">
  // ANTI-PATTERN: a component importing a server-only repository.
  import { PostgresNotes } from "$lib/server/repositories/postgres-notes";
  // ANTI-PATTERN: a component importing a service directly.
  import { NoteManagement } from "$lib/server/services/notes/management";

  let repo = new PostgresNotes();
  let mgmt = new NoteManagement();
</script>

<div>{repo} {mgmt}</div>
