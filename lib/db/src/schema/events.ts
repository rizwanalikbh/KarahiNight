import { pgTable, text, serial, integer, boolean, timestamp, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type PizzaType = { name: string; price: number; discountedPrice?: number };

const DEFAULT_SLOTS = ["16:00-16:30","16:30-17:00","17:00-17:30","17:30-18:00","18:00-18:30","18:30-19:00"];
const DEFAULT_PIZZA_TYPES: PizzaType[] = [
  { name: "Margherita", price: 70 },
  { name: "Pepperoni", price: 70 },
  { name: "Special", price: 70 },
];

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  date: date("date").notNull(),
  totalCapacity: integer("total_capacity").notNull().default(10),
  slotCapacity: integer("slot_capacity").notNull().default(3),
  description: text("description"),
  slots: jsonb("slots").$type<string[]>().notNull().default(DEFAULT_SLOTS),
  pizzaTypes: jsonb("pizza_types").$type<PizzaType[]>().notNull().default(DEFAULT_PIZZA_TYPES),
  maxPerGuest: integer("max_per_guest"),
  orderDeadline: timestamp("order_deadline", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
