import { pgTable, text } from "drizzle-orm/pg-core";

export const notes = pgTable("notes", { id: text("id"), title: text("title") });
