// ANTI-PATTERN: composition root at a universal path. It imports concrete
// server implementations, so the client bundle can reach them.
import { PostgresNotes } from "$lib/server/repositories/postgres-notes";

export function build() {
  return new PostgresNotes();
}
