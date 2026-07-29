import { buildControllers } from "$lib/server/app-factory";

export async function load() {
  return { note: await buildControllers().notes.view("1") };
}
