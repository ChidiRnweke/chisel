import { NotesController } from "$lib/server/controllers/notes/controller";
import { NoteManagement } from "$lib/server/services/notes/management";
import { PostgresNotes } from "$lib/server/repositories/postgres-notes";

// CORRECT: wiring grouped under factories/ rather than left flat at the server
// root. The folder is a layer location, so nothing here is exempt from the
// boundary rules, and the module exports exactly one creator.
export interface NotesCapability {
  readonly controller: NotesController;
}

export const createNotesCapability = (): NotesCapability => ({
  controller: new NotesController(new NoteManagement(new PostgresNotes())),
});
