import { Router, type IRouter } from "express";
import { db, eventsTable, userSegmentsTable, eventSegmentsTable, segmentsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import {
  CreateEventBody,
  UpdateEventParams,
  UpdateEventBody,
  DeleteEventParams,
} from "@workspace/api-zod";

const DEFAULT_SLOTS = ["16:00-16:30","16:30-17:00","17:00-17:30","17:30-18:00","18:00-18:30","18:30-19:00"];
const DEFAULT_PIZZA_TYPES = ["Margherita","Pepperoni","Special"];

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

function requireAuth(req: any, res: any, next: any): void {
  if (!req.session?.role) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

async function attachSegmentDescriptions<T extends { id: number }>(
  events: T[]
): Promise<(T & { segmentDescriptions: string[] })[]> {
  if (events.length === 0) return events.map((e) => ({ ...e, segmentDescriptions: [] }));

  const eventIds = events.map((e) => e.id);
  const rows = await db
    .select({
      eventId: eventSegmentsTable.eventId,
      description: segmentsTable.description,
    })
    .from(eventSegmentsTable)
    .innerJoin(segmentsTable, eq(segmentsTable.id, eventSegmentsTable.segmentId))
    .where(inArray(eventSegmentsTable.eventId, eventIds));

  const descsByEvent = new Map<number, string[]>();
  for (const row of rows) {
    if (!row.description) continue;
    const list = descsByEvent.get(row.eventId) ?? [];
    list.push(row.description);
    descsByEvent.set(row.eventId, list);
  }

  return events.map((e) => ({ ...e, segmentDescriptions: descsByEvent.get(e.id) ?? [] }));
}

router.get("/events", async (req, res): Promise<void> => {
  // Unauthenticated: return all active events (needed for home-page event selector)
  if (!req.session?.role) {
    const events = await db.select().from(eventsTable).orderBy(eventsTable.date);
    const active = events.filter((e) => e.active);
    res.json(await attachSegmentDescriptions(active));
    return;
  }

  if (req.session.role === "admin") {
    const events = await db.select().from(eventsTable).orderBy(eventsTable.date);
    res.json(await attachSegmentDescriptions(events));
    return;
  }

  const userId = req.session.userId!;

  // Events via user's segments only
  const userSegmentRows = await db
    .select({ segmentId: userSegmentsTable.segmentId })
    .from(userSegmentsTable)
    .where(eq(userSegmentsTable.userId, userId));
  const userSegmentIds = userSegmentRows.map((r) => r.segmentId);

  if (userSegmentIds.length === 0) { res.json([]); return; }

  const segmentEvents = await db
    .select({ eventId: eventSegmentsTable.eventId })
    .from(eventSegmentsTable)
    .where(inArray(eventSegmentsTable.segmentId, userSegmentIds));
  const eventIds = [...new Set(segmentEvents.map((r) => r.eventId))];

  if (eventIds.length === 0) { res.json([]); return; }

  const events = await db.select().from(eventsTable).orderBy(eventsTable.date);
  const visible = events.filter((e) => eventIds.includes(e.id) && e.active);
  res.json(await attachSegmentDescriptions(visible));
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
      price: parsed.data.price ?? 70,
      description: parsed.data.description ?? null,
      orderDeadline: parsed.data.orderDeadline ?? null,
      slots: parsed.data.slots?.length ? parsed.data.slots : DEFAULT_SLOTS,
      pizzaTypes: parsed.data.pizzaTypes?.length ? parsed.data.pizzaTypes : DEFAULT_PIZZA_TYPES,
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
  if (parsed.data.price !== undefined) updateData.price = parsed.data.price;
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
