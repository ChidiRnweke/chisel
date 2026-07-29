<script lang="ts">
  let { count }: { count: number } = $props();
</script>

<!-- ANTI-PATTERN: hardcoded palette colour instead of a semantic token. -->
<span class="text-red-500 ring-[2px]">{count}</span>
