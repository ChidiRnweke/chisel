import type { TodosController } from "$lib/server/controllers/todos/controller";

/**
 * What the wiring hands back. Deliberately not named `*-factory.ts`: that suffix
 * promises a module exporting one creator, and a module of pure interfaces
 * exports no value at all.
 */
export interface ControllerFactory {
  todos(): TodosController;
}
