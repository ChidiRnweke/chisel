import type { ActorContext } from "$lib/models/projects";
import type { CreateTodoInput, Todo, TodoId, TodoListFilter } from "$lib/models/todos";
import type { TodoRepository } from "$lib/server/repositories/todos";

/**
 * A fake that declares the interface it stands in for, so the compiler keeps it
 * honest when the port changes. An untyped stand-in drifts silently: the test
 * keeps passing against a shape production no longer has.
 *
 * It enforces the same invariants as the adapter — ownership included — because
 * a fake that is more permissive than production tests nothing.
 */
export class InMemoryTodos implements TodoRepository {
  todos: Todo[] = [];

  async findById(actor: ActorContext, id: TodoId): Promise<Todo | undefined> {
    return this.todos.find(todo => todo.id === id && todo.userId === actor.userId);
  }

  async list(actor: ActorContext, filter: TodoListFilter): Promise<readonly Todo[]> {
    return this.todos.filter(todo =>
      todo.userId === actor.userId
      && (filter.status === undefined || todo.status === filter.status));
  }

  async insert(actor: ActorContext, input: CreateTodoInput): Promise<Todo> {
    const todo = todoBuilder({
      userId: actor.userId,
      projectId: input.projectId,
      title: input.title,
    });
    this.todos.push(todo);
    return todo;
  }
}

const identifier = (kind: number, value: number): string =>
  `00000000-0000-4000-${String(kind).padStart(4, "0")}-${String(value).padStart(12, "0")}`;

export const testNow = "2026-08-15T09:00:00.000Z" as Todo["createdAt"];
export const testActor = (value = 1): ActorContext => ({ userId: identifier(1, value) as ActorContext["userId"] });
export const testProjectId = (value = 1) => identifier(2, value) as Todo["projectId"];
export const testTodoId = (value = 1) => identifier(5, value) as TodoId;

/** Deterministic by default, overridable per field: a test states only what it cares about. */
export const todoBuilder = (overrides: Partial<Todo> = {}): Todo => ({
  id: testTodoId(),
  userId: testActor().userId,
  projectId: testProjectId(),
  title: "Send the design",
  status: "open",
  createdAt: testNow,
  updatedAt: testNow,
  ...overrides,
});
