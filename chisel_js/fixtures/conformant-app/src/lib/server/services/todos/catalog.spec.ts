import { describe, expect, it } from "vitest";
import { TodoCatalog } from "./catalog";
import { InMemoryTodos, testActor, testProjectId } from "$lib/testing/todos/fakes/in-memory-todos";

const setup = () => {
  const todos = new InMemoryTodos();
  return { todos, service: new TodoCatalog(todos) };
};

describe("Todo catalog invariants", () => {
  it("trims a title before storing it", async () => {
    const { service } = setup();
    const todo = await service.create(testActor(), { projectId: testProjectId(), title: "  Send design  " });
    expect(todo.title).toBe("Send design");
  });

  it("refuses a title that is only whitespace", async () => {
    const { service } = setup();
    await expect(service.create(testActor(), { projectId: testProjectId(), title: "   " }))
      .rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("does not reveal a todo belonging to another actor", async () => {
    const { todos, service } = setup();
    const mine = await service.create(testActor(1), { projectId: testProjectId(), title: "Mine" });
    await expect(service.get(testActor(2), mine.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns only the todos matching the requested status", async () => {
    const { todos, service } = setup();
    await service.create(testActor(), { projectId: testProjectId(), title: "Open one" });
    expect(await service.list(testActor(), { status: "done" })).toEqual([]);
  });
});
