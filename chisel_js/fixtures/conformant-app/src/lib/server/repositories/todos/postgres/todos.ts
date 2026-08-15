import type { ActorContext } from "$lib/models/projects";
import type { CreateTodoInput, Todo, TodoId, TodoListFilter } from "$lib/models/todos";
import type { TodoRepository } from "$lib/server/repositories/todos";
import type { Database } from "$lib/server/db/schema";

/** The adapter. Owns the SQL, and maps to a model before returning. */
export class TodoRecords implements TodoRepository {
  constructor(private readonly database: Database) {}

  async findById(actor: ActorContext, id: TodoId): Promise<Todo | undefined> {
    const rows = await this._select(actor);
    return rows.find(todo => todo.id === id);
  }

  async list(actor: ActorContext, filter: TodoListFilter): Promise<readonly Todo[]> {
    const rows = await this._select(actor);
    if (filter.status === undefined) return rows;
    return rows.filter(todo => todo.status === filter.status);
  }

  async insert(actor: ActorContext, input: CreateTodoInput): Promise<Todo> {
    const now = new Date().toISOString() as Todo["createdAt"];
    return {
      id: this.database.schema.id.name as TodoId,
      userId: actor.userId,
      projectId: input.projectId,
      title: input.title,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
  }

  private async _select(actor: ActorContext): Promise<readonly Todo[]> {
    return [];
  }
}
