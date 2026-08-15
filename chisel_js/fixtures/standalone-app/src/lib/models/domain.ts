// ANTI-PATTERN: models are pure data and may not import even another model.
import type { User } from "$lib/models/user";

export interface Note {
  id: string;
  title: string;
  author: User;
}
