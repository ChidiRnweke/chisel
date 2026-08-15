/**
 * The one place that reads the environment.
 *
 * It imports nothing internal, deliberately: config is what everything else is
 * allowed to depend on, so giving it a dependency of its own would put a cycle
 * at the bottom of the graph.
 */
export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? "postgres://localhost:5432/app";
}
