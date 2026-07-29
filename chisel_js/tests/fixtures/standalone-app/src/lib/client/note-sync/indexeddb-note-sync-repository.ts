import type { Note } from "$lib/models/domain";

export class IndexedDbNoteSync {
  async put(note: Note): Promise<void> {}
}
