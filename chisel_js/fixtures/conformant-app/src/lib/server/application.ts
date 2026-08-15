import type { Database } from "$lib/server/db/schema";
import type { ControllerFactory } from "$lib/server/factories/contracts";
import { createTodosCapability } from "$lib/server/factories/todos-capability-factory";
import { ProductionControllerFactory } from "$lib/server/factories/production-controller-factory";

export interface ApplicationConfig {
  readonly database: Database;
}

export interface Application {
  readonly controllers: ControllerFactory;
}

/**
 * The composition root: pure wiring against an explicit config, so an isolated
 * run can supply a different database and still exercise the real code paths.
 *
 * Three things it deliberately does not do. It imports no concrete service or
 * repository — capability factories own those. It constructs nothing but
 * factories. And it parks no placeholder: a cycle here would be a design
 * problem to restructure, not one to paper over with `undefined as unknown as`.
 */
export function createApplication(config: ApplicationConfig): Application {
  const todos = createTodosCapability({ database: config.database });

  return {
    controllers: new ProductionControllerFactory({
      todos: { todoCreator: todos.creator, todoLister: todos.lister },
    }),
  };
}
