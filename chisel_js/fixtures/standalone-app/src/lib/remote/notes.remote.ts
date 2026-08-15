import { buildControllers } from "$lib/server/app-factory";

export const getNote = async (id: string) => buildControllers().notes.view(id);
