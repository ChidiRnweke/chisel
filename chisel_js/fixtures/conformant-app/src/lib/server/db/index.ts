import type { Database } from "./schema";
import { todos } from "./schema";

/**
 * The connection, built from a URL the caller supplies. The persistence layer
 * owns the handle; config owns the string that describes it. A factory
 * constructs it; it does not call into persistence to get one.
 */
export class Connection implements Database {
  readonly schema = todos;
  constructor(readonly url: string) {}
}
