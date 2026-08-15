import type { ActorContext } from "$lib/models/projects";
import type { CreateTodoInput, Todo, TodoId, TodoListFilter } from "$lib/models/todos";

// One role per interface. A controller then declares exactly the capabilities it
// uses, and a test fake implements exactly those — rather than everything the
// service happens to expose.

export interface TodoReader {
  get(actor: ActorContext, id: TodoId): Promise<Todo>;
}

export interface TodoLister {
  list(actor: ActorContext, filter: TodoListFilter): Promise<readonly Todo[]>;
}

export interface TodoCreator {
  create(actor: ActorContext, input: CreateTodoInput): Promise<Todo>;
}
