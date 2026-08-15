import type { Todo } from "$lib/models/todos";

/**
 * A browser-side adapter. It is named after the transport it owns, not after the
 * server-side layer it mirrors, so nothing here is mistaken for a repository
 * that reaches the database.
 */
export class TodoCache {
  private entries = new Map<string, Todo>();

  put(todo: Todo): void {
    this.entries.set(todo.id, todo);
  }

  all(): readonly Todo[] {
    return [...this.entries.values()];
  }
}
