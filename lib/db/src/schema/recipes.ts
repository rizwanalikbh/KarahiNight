import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export const recipesTable = pgTable("recipes", {
  id: serial("id").primaryKey(),
  pizzaType: text("pizza_type").notNull().unique(),
  ingredients: jsonb("ingredients").notNull().$type<RecipeIngredient[]>().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Recipe = typeof recipesTable.$inferSelect;
export type InsertRecipe = typeof recipesTable.$inferInsert;
