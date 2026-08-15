import type { ActorContext } from "$lib/models/projects";
import type { CreateTodoInput, Todo, TodoId, TodoListFilter } from "$lib/models/todos";
import type { TodoRepository } from "$lib/server/repositories/todos";
import { NotFoundError, ValidationError } from "$lib/errors";

/**
 * Where the domain decisions live: what a valid title is, and what it means for
 * a todo to be missing.
 *
 * It depends on the repository *contract* and on models, and on no other
 * service. A service that calls another service has become a controller under a
 * different name.
 *
 * It satisfies `TodoReader`, `TodoLister` and `TodoCreator` structurally rather
 * than with an `implements` clause: importing `./contracts` would be a
 * services-to-services edge, and the roles exist for the *consumer's* benefit —
 * the controller names the slice it uses, and the compiler checks the fit where
 * the two are wired together.
 */
export class TodoCatalog {
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
