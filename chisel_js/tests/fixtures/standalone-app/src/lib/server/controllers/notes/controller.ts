import type { Note } from "$lib/models/domain";

export class NotesController {
  async view(id: string): Promise<Note | undefined> {
    return { id, title: "ok" };
  }
}
