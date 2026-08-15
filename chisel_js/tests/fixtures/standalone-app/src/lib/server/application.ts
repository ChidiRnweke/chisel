// ANTI-PATTERN: the composition root reaching for concrete implementations.
import { PostgresNotes } from "$lib/server/repositories/postgres-notes";
import type { NotesController } from "$lib/server/controllers/notes/controller";

export interface Application {
  readonly controllers: NotesController;
}

export const createApplication = () => ({
  // ANTI-PATTERN: constructing something other than a factory.
  repository: new PostgresNotes(),
  // ANTI-PATTERN: a placeholder parked where a real dependency belongs.
  controllers: undefined as unknown as NotesController,
});
