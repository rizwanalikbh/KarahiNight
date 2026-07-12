import { Router, type IRouter } from "express";
import { db, recipesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateRecipeBody, UpdateRecipeBody } from "@workspace/api-zod";

const router: IRouter = Router();

function requireAdmin(req: any, res: any, next: any): void {
  if (req.session?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

router.get("/recipes", requireAdmin, async (req, res) => {
  const recipes = await db.select().from(recipesTable).orderBy(recipesTable.pizzaType);
  res.json(
    recipes.map((r) => ({
      ...r,
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      updatedAt: r.updatedAt.toISOString(),
    }))
  );
});

router.post("/recipes", requireAdmin, async (req, res) => {
  const parsed = CreateRecipeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { pizzaType, ingredients } = parsed.data;

  const existing = await db.select().from(recipesTable).where(eq(recipesTable.pizzaType, pizzaType));
  if (existing.length > 0) {
    res.status(409).json({ error: "Recipe for this dish type already exists" });
    return;
  }

  const [created] = await db
    .insert(recipesTable)
    .values({ pizzaType, ingredients })
    .returning();

  res.status(201).json({ ...created, ingredients: created.ingredients ?? [], updatedAt: created.updatedAt.toISOString() });
});

router.patch("/recipes/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = UpdateRecipeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.pizzaType !== undefined) updates.pizzaType = parsed.data.pizzaType;
  if (parsed.data.ingredients !== undefined) updates.ingredients = parsed.data.ingredients;

  const [updated] = await db
    .update(recipesTable)
    .set(updates)
    .where(eq(recipesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  res.json({ ...updated, ingredients: updated.ingredients ?? [], updatedAt: updated.updatedAt.toISOString() });
});

router.delete("/recipes/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db.delete(recipesTable).where(eq(recipesTable.id, id));
  res.status(204).send();
});

export default router;
