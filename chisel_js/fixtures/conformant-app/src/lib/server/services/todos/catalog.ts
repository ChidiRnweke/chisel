import type { ActorContext } from "$lib/models/projects";
import type { CreateTodoInput, Todo, TodoId, TodoListFilter } from "$lib/models/todos";
import type { TodoRepository } from "$lib/server/repositories/todos";
import { NotFoundError, ValidationError } from "$lib/errors";

// One role per interface. A controller then declares exactly the capabilities it
// uses, and a test fake implements exactly those — rather than everything the
// service happens to expose. They are declared beside the service that offers
// them: a sibling contracts.ts would be a services-to-services edge.

export interface TodoReader {
  get(actor: ActorContext, id: TodoId): Promise<Todo>;
}

export interface TodoLister {
  list(actor: ActorContext, filter: TodoListFilter): Promise<readonly Todo[]>;
}

export interface TodoCreator {
  create(actor: ActorContext, input: CreateTodoInput): Promise<Todo>;
}

/**
 * Where the domain decisions live: what a valid title is, and what it means for
 * a todo to be missing.
 *
 * It depends on the repository *contract* and on models, and on no other
 * service. A service that calls another service has become a controller under a
 * different name. It implements its capability interfaces explicitly, so a
 * signature that drifts fails here rather than where the factory wires it.
 */
export class TodoCatalog implements TodoReader, TodoLister, TodoCreator {
  constructor(private readonly todos: TodoRepository) {}

  async get(actor: ActorContext, id: TodoId): Promise<Todo> {
    const todo = await this.todos.findById(actor, id);
    if (todo === undefined) throw new NotFoundError(`No todo ${id}`);
    return todo;
  }

  async list(actor: ActorContext, filter: TodoListFilter): Promise<readonly Todo[]> {
    return this.todos.list(actor, filter);
  }

  async create(actor: ActorContext, input: CreateTodoInput): Promise<Todo> {
    const title = input.title.trim();
    if (title.length === 0) throw new ValidationError("Todo title is required");
    return this.todos.insert(actor, { ...input, title });
  }
}
