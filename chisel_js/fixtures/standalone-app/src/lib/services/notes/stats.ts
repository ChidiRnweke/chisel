// ANTI-PATTERN: Drizzle imported in the services layer.
import { count } from "drizzle-orm";

export const total = count;
