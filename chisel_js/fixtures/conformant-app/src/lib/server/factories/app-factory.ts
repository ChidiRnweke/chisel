import type { ControllerFactory } from "./contracts";
import { createApplication } from "$lib/server/application";
import { connect } from "$lib/server/db";
import { databaseUrl } from "$lib/server/config";

/** Built on first use, then reused: the graph is assembled once per process. */
class DeferredValue<T> {
  private value: T | undefined;
  constructor(private readonly create: () => T) {}
  get(): T {
    return (this.value ??= this.create());
  }
}

const application = new DeferredValue(() => createApplication({ database: connect(databaseUrl()) }));

/**
 * The one entry point routes and remote functions use. Keeping it static means
 * no page has to know how the graph is built, only that it is.
 */
export class AppFactory {
  static controllers(): ControllerFactory {
    return application.get().controllers;
  }
}
