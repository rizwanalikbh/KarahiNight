import { Router, type IRouter } from "express";
import { db, eventsTable, eventUsersTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
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

// GET /events — admin sees all, user sees their events
router.get("/events", requireAuth, async (req, res): Promise<void> => {
  if (req.session.role === "admin") {
    const events = await db.select().from(eventsTable).orderBy(eventsTable.date);
    res.json(events);
    return;
  }

  // User: only events they're assigned to
  const userId = req.session.userId!;
  const eventUsers = await db
    .select({ eventId: eventUsersTable.eventId })
    .from(eventUsersTable)
    .where(eq(eventUsersTable.userId, userId));

  if (eventUsers.length === 0) {
    res.json([]);
    return;
  }

  const eventIds = eventUsers.map((eu) => eu.eventId);
  const events = await db.select().from(eventsTable).orderBy(eventsTable.date);
  res.json(events.filter((e) => eventIds.includes(e.id) && e.active));
});

// POST /events — admin creates event
router.post("/events", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [event] = await db
    .insert(eventsTable)
    .values({
      name: parsed.data.name,
      date: parsed.data.date,
      totalCapacity: parsed.data.totalCapacity ?? 10,
      slotCapacity: parsed.data.slotCapacity ?? 3,
      active: true,
    })
    .returning();

  res.status(201).json(event);
});

// PATCH /events/:id — admin updates event
router.patch("/events/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.date !== undefined) updateData.date = parsed.data.date;
  if (parsed.data.totalCapacity !== undefined) updateData.totalCapacity = parsed.data.totalCapacity;
  if (parsed.data.slotCapacity !== undefined) updateData.slotCapacity = parsed.data.slotCapacity;
  if (parsed.data.active !== undefined) updateData.active = parsed.data.active;

  const [event] = await db
    .update(eventsTable)
    .set(updateData)
    .where(eq(eventsTable.id, params.data.id))
    .returning();

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json(event);
});

// DELETE /events/:id — admin deletes event
router.delete("/events/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(eventsTable).where(eq(eventsTable.id, params.data.id));
  res.sendStatus(204);
});

// GET /events/:id/users — admin lists users in event
router.get("/events/:id/users", requireAdmin, async (req, res): Promise<void> => {
  const params = ListEventUsersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const eventUsers = await db
    .select({ userId: eventUsersTable.userId })
    .from(eventUsersTable)
    .where(eq(eventUsersTable.eventId, params.data.id));

  if (eventUsers.length === 0) {
    res.json([]);
    return;
  }

  const userIds = eventUsers.map((eu) => eu.userId);
  const users = await db.select().from(usersTable).orderBy(usersTable.name);
  res.json(users.filter((u) => userIds.includes(u.id)));
});

// POST /events/:id/users — admin adds user to event
router.post("/events/:id/users", requireAdmin, async (req, res): Promise<void> => {
  const params = AddUserToEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AddUserToEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Check user exists
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, parsed.data.userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Upsert to avoid duplicate error
  await db
    .insert(eventUsersTable)
    .values({ eventId: params.data.id, userId: parsed.data.userId })
    .onConflictDoNothing();

  res.status(201).json(user);
});

// DELETE /events/:id/users/:userId — admin removes user from event
router.delete("/events/:id/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const params = RemoveUserFromEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(eventUsersTable)
    .where(
      and(
        eq(eventUsersTable.eventId, params.data.id),
        eq(eventUsersTable.userId, params.data.userId)
      )
    );

  res.sendStatus(204);
});

export default router;
