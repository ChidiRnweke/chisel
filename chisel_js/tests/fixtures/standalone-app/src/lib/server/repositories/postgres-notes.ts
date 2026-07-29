import type { Note } from "$lib/models/domain";
import { notes } from "$lib/server/db/schema";

export class PostgresNotes {
  async get(id: string): Promise<Note | undefined> {
    return { id, title: notes.title.name };
  }
}
