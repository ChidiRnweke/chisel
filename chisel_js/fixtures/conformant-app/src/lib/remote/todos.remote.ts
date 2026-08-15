import type { Todo, TodoId } from "$lib/models/todos";
import { AppFactory } from "$lib/server/factories/app-factory";

// The client's sanctioned way in. The `.remote.ts` marker is what puts this file
// in the remote layer, so the server import above is a server-to-server call
// rather than a leak into the browser bundle.

export const getTodos = async (): Promise<readonly Todo[]> => {
  return AppFactory.controllers().todos().list(actor(), {});
};

export const createTodo = async (title: string): Promise<Todo> => {
  return AppFactory.controllers().todos().create(actor(), { projectId: projectId(), title });
};

function actor() {
  return { userId: "user-1" as Todo["userId"] };
}

function projectId() {
  return "project-1" as Todo["projectId"];
}
