/**
 * The shadcn class-merge helper, and nothing else. `utils.ts` earns its vague
 * name only by staying at exactly one entry; anything else belongs to a feature.
 */
export function cn(...classes: readonly (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
