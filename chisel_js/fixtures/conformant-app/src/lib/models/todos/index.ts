type Brand<T, Name extends string> = T & { readonly __brand: Name };

// Foreign identifiers are re-declared here, unexported. A model capability is a
// leaf: importing $lib/models/projects to borrow ProjectId would make one model
// depend on another, and the layer would stop being pure data.
type UserId = Brand<string, "UserId">;
type ProjectId = Brand<string, "ProjectId">;
type DateTime = Brand<string, "DateTime">;

export type TodoId = Brand<string, "TodoId">;

export type TodoStatus = "open" | "in_progress" | "done";

/**
 * A tracked commitment. `completedAt` is set if and only if `status` is `done`,
 * and deletion is soft, so the history of a commitment survives it.
 */
export interface Todo {
  readonly id: TodoId;
  readonly userId: UserId;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly status: TodoStatus;
  readonly completedAt?: DateTime;
  readonly createdAt: DateTime;
  readonly updatedAt: DateTime;
}

export interface CreateTodoInput {
  readonly projectId: ProjectId;
  readonly title: string;
}

export interface TodoListFilter {
  readonly status?: TodoStatus;
}

/** Pure domain phrasing, inlined rather than imported down from the component layer. */
export function todoSummary(todo: Todo): string {
  return todo.status === "done" ? `${todo.title} (done)` : todo.title;
}
