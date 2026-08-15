import type { ActorContext } from "$lib/models/projects";
import type { CreateTodoInput, Todo, TodoListFilter } from "$lib/models/todos";
import type { TodoCreator, TodoLister } from "$lib/server/services/todos/contracts";

/**
 * The transport-shaped surface a route or remote function calls.
 *
 * It coordinates service contracts and holds no domain decisions of its own,
 * and it names no framework type: a controller that imports @sveltejs/kit can
 * only ever be called from one place.
 */
export interface TodosController {
  /** @throws ValidationError when the title is blank. */
  create(actor: ActorContext, input: CreateTodoInput): Promise<Todo>;
  list(actor: ActorContext, filter: TodoListFilter): Promise<readonly Todo[]>;
}

/** Exactly the capabilities this controller uses, and no more. */
export interface TodosDependencies {
  readonly todoCreator: TodoCreator;
  readonly todoLister: TodoLister;
}

export class Todos implements TodosController {
  constructor(private readonly dependencies: TodosDependencies) {}

  async create(actor: ActorContext, input: CreateTodoInput): Promise<Todo> {
    return this.dependencies.todoCreator.create(actor, input);
  }

  async list(actor: ActorContext, filter: TodoListFilter): Promise<readonly Todo[]> {
    return this.dependencies.todoLister.list(actor, filter);
  }
}
