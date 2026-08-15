import { describe, expect, it } from "vitest";
import { Todos } from "./controller";
import type { TodosDependencies } from "./controller";
import { InMemoryTodos, testActor, testProjectId } from "$lib/testing/todos/fakes/in-memory-todos";
import { TodoCatalog } from "$lib/server/services/todos/catalog";

/**
 * The dependency bundle is built with its real type rather than cast into shape.
 * A `as unknown as TodosDependencies` would compile today and keep compiling
 * after the interface grows a member nothing supplies.
 */
const setup = () => {
  const catalog = new TodoCatalog(new InMemoryTodos());
  const dependencies: TodosDependencies = { todoCreator: catalog, todoLister: catalog };
  return { controller: new Todos(dependencies) };
};

describe("Todos controller invariants", () => {
  it("hands the created todo back to the caller unchanged", async () => {
    const { controller } = setup();
    const todo = await controller.create(testActor(), { projectId: testProjectId(), title: "Ship it" });
    expect(todo.title).toBe("Ship it");
  });

  it("propagates a domain failure rather than translating it", async () => {
    const { controller } = setup();
    await expect(controller.create(testActor(), { projectId: testProjectId(), title: "" }))
      .rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("lists nothing for an actor who has created nothing", async () => {
    const { controller } = setup();
    expect(await controller.list(testActor(), {})).toEqual([]);
  });
});
