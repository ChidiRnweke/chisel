import type { Database } from "./schema";
import { todos } from "./schema";

/**
 * The connection, built from a URL the caller supplies. The persistence layer
 * owns the handle; config owns the string that describes it.
 */
export function connect(url: string): Database {
  return { schema: todos, url };
}
