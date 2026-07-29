// `readable` here is a string formatter, not svelte/store's readable().
export function readable(name: string): string {
  return name.replace(/[-_]/g, " ");
}

export function label(name: string): string {
  return readable(name).toUpperCase();
}
