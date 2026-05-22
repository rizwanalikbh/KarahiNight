import { Router, type IRouter } from "express";
import { db, eventsTable, eventUsersTable, usersTable, userSegmentsTable, eventSegmentsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import {
  CreateEventBody,
  UpdateEventParams,
  UpdateEventBody,
  DeleteEventParams,
  ListEventUsersParams,
  AddUserToEventParams,
  AddUserToEventBody,
  RemoveUserFromEventParams,
} from "@workspace/api-zod";

const DEFAULT_SLOTS = ["16:00-16:30","16:30-17:00","17:00-17:30","17:30-18:00","18:00-18:30","18:30-19:00"];
const DEFAULT_PIZZA_TYPES = ["Margherita","Pepperoni","Special"];

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

router.get("/events", requireAuth, async (req, res): Promise<void> => {
  if (req.session.role === "admin") {
    const events = await db.select().from(eventsTable).orderBy(eventsTable.date);
    res.json(events);
    return;
  }

  const userId = req.session.userId!;

  // Direct event_users assignments
  const directRows = await db
    .select({ eventId: eventUsersTable.eventId })
    .from(eventUsersTable)
    .where(eq(eventUsersTable.userId, userId));
  const directEventIds = directRows.map((r) => r.eventId);

  // Events via user's segments
  const userSegmentRows = await db
    .select({ segmentId: userSegmentsTable.segmentId })
    .from(userSegmentsTable)
    .where(eq(userSegmentsTable.userId, userId));
  const userSegmentIds = userSegmentRows.map((r) => r.segmentId);

  let segmentEventIds: number[] = [];
  if (userSegmentIds.length > 0) {
    const segmentEvents = await db
      .select({ eventId: eventSegmentsTable.eventId })
      .from(eventSegmentsTable)
      .where(inArray(eventSegmentsTable.segmentId, userSegmentIds));
    segmentEventIds = segmentEvents.map((r) => r.eventId);
  }

  const allEventIds = [...new Set([...directEventIds, ...segmentEventIds])];
  if (allEventIds.length === 0) { res.json([]); return; }

  const events = await db.select().from(eventsTable).orderBy(eventsTable.date);
  res.json(events.filter((e) => allEventIds.includes(e.id) && e.active));
});

router.post("/events", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [event] = await db
    .insert(eventsTable)
    .values({
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

router.get("/events/:id/users", requireAdmin, async (req, res): Promise<void> => {
  const params = ListEventUsersParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const eventUsers = await db
    .select({ userId: eventUsersTable.userId })
    .from(eventUsersTable)
    .where(eq(eventUsersTable.eventId, params.data.id));

  if (eventUsers.length === 0) { res.json([]); return; }

  const userIds = eventUsers.map((eu) => eu.userId);
  const users = await db.select().from(usersTable).orderBy(usersTable.name);
  res.json(users.filter((u) => userIds.includes(u.id)));
});

router.post("/events/:id/users", requireAdmin, async (req, res): Promise<void> => {
  const params = AddUserToEventParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = AddUserToEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  await db.insert(eventUsersTable).values({ eventId: params.data.id, userId: parsed.data.userId }).onConflictDoNothing();
  res.status(201).json(user);
});

router.delete("/events/:id/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const params = RemoveUserFromEventParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db
    .delete(eventUsersTable)
    .where(and(eq(eventUsersTable.eventId, params.data.id), eq(eventUsersTable.userId, params.data.userId)));

  res.sendStatus(204);
});

export default router;
