import { Router, type IRouter } from "express";
import { db, eventsTable } from "@workspace/db";
import type { PizzaType } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateEventBody,
  UpdateEventParams,
  UpdateEventBody,
  DeleteEventParams,
} from "@workspace/api-zod";

const DEFAULT_SLOTS = ["16:00-16:30","16:30-17:00","17:00-17:30","17:30-18:00","18:00-18:30","18:30-19:00"];
const DEFAULT_PIZZA_TYPES: PizzaType[] = [
  { name: "Margherita", price: 70 },
  { name: "Pepperoni", price: 70 },
  { name: "Special", price: 70 },
];

function generateSlug(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let slug = "";
  for (let i = 0; i < 6; i++) slug += chars[Math.floor(Math.random() * chars.length)];
  return slug;
}

async function uniqueSlug(): Promise<string> {
  const existing = new Set((await db.select({ slug: eventsTable.slug }).from(eventsTable)).map((r) => r.slug));
  let slug: string;
  do { slug = generateSlug(); } while (existing.has(slug));
  return slug;
}

const router: IRouter = Router();

function requireAdmin(req: any, res: any, next: any): void {
  if (req.session?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

router.get("/events", async (req, res): Promise<void> => {
  const events = await db.select().from(eventsTable).orderBy(eventsTable.date);
  if (!req.session?.role) {
    res.json(events.filter((e) => e.active));
    return;
  }
  if (req.session.role === "admin") {
    res.json(events);
    return;
  }
  res.json(events.filter((e) => e.active));
});

router.post("/events", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [event] = await db
    .insert(eventsTable)
    .values({
      slug: await uniqueSlug(),
      name: parsed.data.name,
      date: parsed.data.date,
      totalCapacity: parsed.data.totalCapacity ?? 10,
      slotCapacity: parsed.data.slotCapacity ?? 3,
      maxPerGuest: parsed.data.maxPerGuest ?? null,
      description: parsed.data.description ?? null,
      orderDeadline: parsed.data.orderDeadline ?? null,
      slots: parsed.data.slots?.length ? parsed.data.slots : DEFAULT_SLOTS,
      pizzaTypes: parsed.data.pizzaTypes?.length ? (parsed.data.pizzaTypes as PizzaType[]) : DEFAULT_PIZZA_TYPES,
      active: true,
    })
    .returning();

  res.status(201).json(event);
});

router.patch("/events/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateEventParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.date !== undefined) updateData.date = parsed.data.date;
  if (parsed.data.totalCapacity !== undefined) updateData.totalCapacity = parsed.data.totalCapacity;
  if (parsed.data.slotCapacity !== undefined) updateData.slotCapacity = parsed.data.slotCapacity;
  if ("maxPerGuest" in parsed.data) updateData.maxPerGuest = parsed.data.maxPerGuest ?? null;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if ("orderDeadline" in parsed.data) updateData.orderDeadline = parsed.data.orderDeadline ?? null;
  if (parsed.data.slots !== undefined) updateData.slots = parsed.data.slots;
  if (parsed.data.pizzaTypes !== undefined) updateData.pizzaTypes = parsed.data.pizzaTypes;
  if (parsed.data.active !== undefined) updateData.active = parsed.data.active;

  const [event] = await db
    .update(eventsTable)
    .set(updateData)
    .where(eq(eventsTable.id, params.data.id))
    .returning();

  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  res.json(event);
});

router.delete("/events/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteEventParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(eventsTable).where(eq(eventsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
