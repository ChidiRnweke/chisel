<script lang="ts">
  import { cn } from "$lib/utils";

  let { label, class: className = "" }: { label: string; class?: string } = $props();
</script>

<!-- The raw <button> is allowed here and nowhere else: components/ui/ is the
     design system's own floor, and the point of the ban elsewhere is that every
     button in the app inherits these decisions rather than restating them. -->
<button type="button" class={cn("rounded-md bg-primary px-3 py-2 text-primary-foreground", className)}>
  {label}
</button>
