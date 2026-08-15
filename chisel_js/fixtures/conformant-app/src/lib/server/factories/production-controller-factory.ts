import type { ControllerFactory } from "./contracts";
import type { TodosDependencies } from "$lib/server/controllers/todos/controller";
import type { TodosController } from "$lib/server/controllers/todos/controller";
import { Todos } from "$lib/server/controllers/todos/controller";

/** Every controller this application can hand out, keyed by capability. */
interface ProductionControllerDependencies {
  readonly todos: TodosDependencies;
}

export class ProductionControllerFactory implements ControllerFactory {
  constructor(private readonly dependencies: ProductionControllerDependencies) {}

  todos(): TodosController {
    return new Todos(this.dependencies.todos);
  }
}
