import { pgTable, serial, integer, unique } from "drizzle-orm/pg-core";
import { eventsTable } from "./events";
import { segmentsTable } from "./segments";

export const eventSegmentsTable = pgTable("event_segments", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  segmentId: integer("segment_id").notNull().references(() => segmentsTable.id, { onDelete: "cascade" }),
}, (t) => [
  unique().on(t.eventId, t.segmentId),
]);

export type EventSegment = typeof eventSegmentsTable.$inferSelect;
