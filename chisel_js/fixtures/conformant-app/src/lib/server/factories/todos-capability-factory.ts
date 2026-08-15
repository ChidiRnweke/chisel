import type { Database } from "$lib/server/db/schema";
import type { TodoCreator, TodoLister, TodoReader } from "$lib/server/services/todos/contracts";
import { TodoCatalog } from "$lib/server/services/todos/catalog";
import { TodoRecords } from "$lib/server/repositories/todos/postgres/todos";

/**
 * One capability, wired once. The module exports exactly one value — the
 * creator — because the filename promises exactly one thing to build. The
 * interfaces beside it are types, erased at build, and name this factory's own
 * dependency shape rather than a second creator.
 */
export interface TodosCapabilityInput {
  readonly database: Database;
}

export interface TodosCapability {
  readonly reader: TodoReader;
  readonly lister: TodoLister;
  readonly creator: TodoCreator;
}

export const createTodosCapability = (input: TodosCapabilityInput): TodosCapability => {
  const catalog = new TodoCatalog(new TodoRecords(input.database));
  return { reader: catalog, lister: catalog, creator: catalog };
};
