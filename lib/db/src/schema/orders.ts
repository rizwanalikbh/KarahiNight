import { pgTable, text, serial, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { eventsTable } from "./events";

export const PizzaItemSchema = z.object({
  pizzaChoice: z.string().min(1),
  quantity: z.number().int().min(1).max(50),
});
export type PizzaItem = z.infer<typeof PizzaItemSchema>;

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  pizzaItems: jsonb("pizza_items").notNull().$type<PizzaItem[]>(),
  quantity: integer("quantity").notNull(),
  pickupSlot: text("pickup_slot").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  paid: boolean("paid").notNull().default(false),
  orderCode: text("order_code").unique(),
  termsText: text("terms_text"),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
