import { pgTable, text, serial, integer, boolean, timestamp, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type PizzaCategory = "Main" | "Staples" | "Sides" | "Drinks" | "Dessert";
export type PizzaType = { name: string; price: number; discountedPrice?: number; category?: PizzaCategory; portionDescription?: string };
export type EventType = "regular" | "special";

const DEFAULT_SLOTS = ["16:00-16:30","16:30-17:00","17:00-17:30","17:30-18:00","18:00-18:30","18:30-19:00"];
const DEFAULT_PORTION_DESCRIPTION = "Medium Family Size - enough for two adults and two children";
const DEFAULT_PIZZA_TYPES: PizzaType[] = [
  { name: "Lamb Karahi", price: 429, category: "Main", portionDescription: DEFAULT_PORTION_DESCRIPTION },
  { name: "Chicken Karahi", price: 279, category: "Main", portionDescription: DEFAULT_PORTION_DESCRIPTION },
  { name: "Beef Karahi", price: 339, category: "Main", portionDescription: DEFAULT_PORTION_DESCRIPTION },
  { name: "Plain Naan", price: 15, category: "Staples" },
];

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  date: date("date").notNull(),
  totalCapacity: integer("total_capacity").notNull().default(10),
  slotCapacity: integer("slot_capacity").notNull().default(3),
  description: text("description"),
  orderDescription: text("order_description"),
  slots: jsonb("slots").$type<string[]>().notNull().default(DEFAULT_SLOTS),
  pizzaTypes: jsonb("pizza_types").$type<PizzaType[]>().notNull().default(DEFAULT_PIZZA_TYPES),
  maxPerGuest: integer("max_per_guest"),
  orderDeadline: timestamp("order_deadline", { withTimezone: true }),
  location: text("location"),
  locationUrl: text("location_url"),
  bannerVariant: text("banner_variant"),
  customBannerUrl: text("custom_banner_url"),
  eventType: text("event_type").$type<EventType>().notNull().default("special"),
  volumeNumber: integer("volume_number"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
