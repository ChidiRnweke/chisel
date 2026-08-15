// ANTI-PATTERN: a JSON endpoint serving our own UI. Should be a remote function.
import { json } from "@sveltejs/kit";

export const GET = () => json({ notes: [] });
