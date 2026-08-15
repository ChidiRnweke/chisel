<script lang="ts">
  let { data } = $props();
</script>

<div class="flex flex-col gap-2 p-4">
  <h1 class="text-lg font-semibold text-foreground">Todos</h1>
  <p class="text-sm text-muted-foreground">{data.count} open</p>
</div>
