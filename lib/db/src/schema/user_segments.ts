import { pgTable, serial, integer, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { segmentsTable } from "./segments";

export const userSegmentsTable = pgTable("user_segments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  segmentId: integer("segment_id").notNull().references(() => segmentsTable.id, { onDelete: "cascade" }),
}, (t) => [
  unique().on(t.userId, t.segmentId),
]);

export type UserSegment = typeof userSegmentsTable.$inferSelect;
