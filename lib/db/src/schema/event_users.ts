import { pgTable, serial, integer, unique } from "drizzle-orm/pg-core";
import { eventsTable } from "./events";
import { usersTable } from "./users";

export const eventUsersTable = pgTable("event_users", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
}, (t) => [
  unique().on(t.eventId, t.userId),
]);

export type EventUser = typeof eventUsersTable.$inferSelect;
