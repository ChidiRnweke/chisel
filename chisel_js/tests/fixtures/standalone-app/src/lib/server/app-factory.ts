import { NotesController } from "$lib/server/controllers/notes/controller";
import { NoteManagement } from "$lib/server/services/notes/management";
import { PostgresNotes } from "$lib/server/repositories/postgres-notes";

// An interface beside the factory. Its method signatures are NOT class methods
// and must not be reported as non-static factory methods.
export interface AppFactory {
  notes(): NotesController;
  management(): NoteManagement;
}

export function buildControllers() {
  return { notes: new NotesController(), management: new NoteManagement(), repo: new PostgresNotes() };
}
