import type { Todo } from "$lib/models/todos";

/**
 * View state, held in runes rather than a writable store. A store reaches no
 * further than models: it holds what the UI is currently showing, and asks a
 * remote function when it needs more.
 */
export class TodoSelection {
  selected = $state<Todo | undefined>(undefined);

  select(todo: Todo): void {
    this.selected = todo;
  }

  clear(): void {
    this.selected = undefined;
  }
}
