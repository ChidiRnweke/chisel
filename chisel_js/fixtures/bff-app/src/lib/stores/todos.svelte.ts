// ANTI-PATTERN: a store constructs its own API client. Under BFF mode only the
// config and factory layers may name the constructor — otherwise every caller
// builds its own, each with its own base URL, auth handling and retry policy.
import createClient from "openapi-fetch";
import type { paths } from "$lib/api/schema";

const client = createClient<paths>({ baseUrl: "http://backend" });

export class TodoList {
  todos = $state<{ id: string }[]>([]);

  async load(): Promise<void> {
    const response = await client.GET("/todos");
    this.todos = response.data ?? [];
  }
}
