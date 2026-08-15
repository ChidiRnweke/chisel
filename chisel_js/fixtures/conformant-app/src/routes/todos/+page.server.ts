import type { TodoStatus } from "$lib/models/todos";
import { AppFactory } from "$lib/server/factories/app-factory";

/**
 * The loader delegates and shapes, and holds no domain decision of its own. It
 * reaches the controller through the factory rather than constructing anything,
 * so the page knows nothing about how the graph is assembled.
 */
export const load = async ({ url }: { url: URL }) => {
  const status = url.searchParams.get("status") as TodoStatus | null;
  const todos = await AppFactory.controllers()
    .todos()
    .list({ userId: "user-1" as never }, status === null ? {} : { status });

  return { todos };
};
