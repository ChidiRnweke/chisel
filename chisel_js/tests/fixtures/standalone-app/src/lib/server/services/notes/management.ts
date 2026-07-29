import type { Note } from "$lib/models/domain";

export class NoteManagement {
  async load(id: string): Promise<Note | undefined> {
    return { id, title: "ok" };
  }
}
