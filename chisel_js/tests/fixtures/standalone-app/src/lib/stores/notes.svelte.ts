// ANTI-PATTERN: a store importing a controller.
import { NotesController } from "$lib/server/controllers/notes/controller";

export const controller = new NotesController();
