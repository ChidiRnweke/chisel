// ANTI-PATTERN: unresolved alias — this module does not exist.
import { buildIndex } from "$lib/server/search/indexer";

export function search(q: string) {
  return buildIndex(q);
}
