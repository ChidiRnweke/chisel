import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Drizzle stops here. A service that imports this file has reached past the
// repository contract and taken a dependency on the storage engine.
export const todos = pgTable("todos", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

/** The handle a repository adapter is constructed with. */
export interface Database {
  readonly schema: typeof todos;
  readonly url: string;
}
