import type { ActorContext } from "$lib/models/projects";
import type { CreateTodoInput, Todo, TodoId, TodoListFilter } from "$lib/models/todos";

/**
 * The port. Services depend on this and nothing below it, so the storage engine
 * can change without a single service edit.
 *
 * Every method takes the actor first: ownership is a storage-level concern here,
 * not something each caller is trusted to remember.
 */
export interface TodoRepository {
  findById(actor: ActorContext, id: TodoId): Promise<Todo | undefined>;
  list(actor: ActorContext, filter: TodoListFilter): Promise<readonly Todo[]>;
  insert(actor: ActorContext, input: CreateTodoInput): Promise<Todo>;
}
