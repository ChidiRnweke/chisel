import { DomainError } from "$lib/errors";

/** One place maps domain failures to a transport shape, so no route repeats it. */
export function handleError({ error }: { error: unknown }) {
  if (error instanceof DomainError) return { message: error.message, code: error.code };
  return { message: "Unexpected error", code: "INTERNAL" };
}
