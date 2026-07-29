/**
 * The project topology chisel is checking.
 *
 * - `sveltekit-standalone` — SvelteKit owns its own data layer (Drizzle under
 *   `$lib/server`). There is no separate backend.
 * - `sveltekit-bff` — SvelteKit is a backend-for-frontend in front of a
 *   separate API, talking to it through a generated `openapi-fetch` client.
 *
 * Detected once by `chisel-js init` and written to `chisel.config.json`. It is
 * never re-derived at check time: a rule set that changes because someone
 * edited a dependency is a rule set nobody can trust.
 */
export const CheckerMode = {
  STANDALONE: "sveltekit-standalone",
  BFF: "sveltekit-bff",
} as const;

export type CheckerMode = (typeof CheckerMode)[keyof typeof CheckerMode];

export const CHECKER_MODES: readonly CheckerMode[] = [
  CheckerMode.STANDALONE,
  CheckerMode.BFF,
];

export function isCheckerMode(value: unknown): value is CheckerMode {
  return typeof value === "string" && (CHECKER_MODES as readonly string[]).includes(value);
}
