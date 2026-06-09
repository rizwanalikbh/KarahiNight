import { Router, type IRouter } from "express";
import { db, ordersTable, eventsTable, usersTable, type PizzaItem } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateOrderBody, UpdateOrderParams, UpdateOrderBody, DeleteOrderParams, ListOrdersQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function requireAuth(req: any, res: any, next: any): void {
  if (!req.session?.role) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

function requireAdmin(req: any, res: any, next: any): void {
  if (req.session?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

async function enrichOrders(rawOrders: any[]) {
  const allUsers = await db.select().from(usersTable);
  const userMap = new Map(allUsers.map((u) => [u.id, u.name]));

  const allEvents = await db.select().from(eventsTable);
  const eventNameMap = new Map(allEvents.map((e) => [e.id, e.name]));
  const eventDateMap = new Map(allEvents.map((e) => [e.id, e.date]));

  return rawOrders.map((o) => ({
    ...o,
    userName: userMap.get(o.userId) ?? "Unknown",
    eventName: o.eventId ? (eventNameMap.get(o.eventId) ?? "Unknown") : "Unknown",
    eventDate: o.eventId ? (eventDateMap.get(o.eventId) ?? "") : "",
    items: Array.isArray(o.pizzaItems) ? o.pizzaItems : [],
    notes: o.notes ?? null,
    createdAt: o.createdAt.toISOString(),
  }));
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const queryParsed = ListOrdersQueryParams.safeParse(req.query);
  const eventId = queryParsed.success ? queryParsed.data.eventId : undefined;

  let rawOrders;
  if (req.session.role === "admin") {
    if (eventId) {
      rawOrders = await db.select().from(ordersTable).where(eq(ordersTable.eventId, eventId)).orderBy(ordersTable.createdAt);
    } else {
      rawOrders = await db.select().from(ordersTable).orderBy(ordersTable.createdAt);
    }
  } else {
    const filters = [eq(ordersTable.userId, req.session.userId!)];
    if (eventId) filters.push(eq(ordersTable.eventId, eventId));
    rawOrders = await db.select().from(ordersTable).where(and(...filters));
  }

  res.json(await enrichOrders(rawOrders));
});

router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  if (req.session.role !== "user") {
    res.status(403).json({ error: "Only invited users can place orders" });
    return;
  }

  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { eventId, items, pickupSlot, notes } = parsed.data;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!event || !event.active) {
    res.status(400).json({ error: "Event not found or not active" });
    return;
  }

  const eventSlots = Array.isArray(event.slots) ? event.slots : [];
  const eventPizzaTypes = Array.isArray(event.pizzaTypes) ? event.pizzaTypes : [];

  if (!eventSlots.includes(pickupSlot)) {
    res.status(400).json({ error: "Invalid pickup slot for this event" });
    return;
  }

  const userId = req.session.userId!;

  const validItems =
    Array.isArray(items) &&
    items.length > 0 &&
    items.every(
      (i: any) =>
        eventPizzaTypes.some((pt: any) => pt.name === i.pizzaChoice) &&
        typeof i.quantity === "number" &&
        i.quantity >= 1
    );

  if (!validItems) {
    res.status(400).json({ error: "Invalid pizza items for this event" });
    return;
  }

  const typedItems = items as PizzaItem[];
  const totalQuantity = typedItems.reduce((sum: number, item: PizzaItem) => sum + item.quantity, 0);

  const existingUserOrders = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.userId, userId), eq(ordersTable.eventId, eventId)));

  const existingUserTotal = existingUserOrders.reduce((sum, o) => sum + o.quantity, 0);

  if (event.maxPerGuest !== null && event.maxPerGuest !== undefined) {
    const remaining = event.maxPerGuest - existingUserTotal;
    if (remaining <= 0) {
      res.status(400).json({
        error: `You've already reached your limit of ${event.maxPerGuest} pizza(s) for this event.`,
      });
      return;
    }
    if (existingUserTotal + totalQuantity > event.maxPerGuest) {
      res.status(400).json({
        error: `You've already ordered ${existingUserTotal} pizza(s). You can add at most ${remaining} more (limit: ${event.maxPerGuest} per guest).`,
      });
      return;
    }
  }

  const allEventOrders = await db.select().from(ordersTable).where(eq(ordersTable.eventId, eventId));
  const totalBooked = allEventOrders.reduce((sum, o) => sum + o.quantity, 0);

  if (totalBooked >= event.totalCapacity) {
    res.status(400).json({ error: "Event is fully booked" });
    return;
  }

  const slotOrders = allEventOrders.filter((o) => o.pickupSlot === pickupSlot);
  const slotBooked = slotOrders.reduce((sum, o) => sum + o.quantity, 0);

  if (slotBooked + totalQuantity > event.slotCapacity) {
    res.status(400).json({
      error: `Slot capacity exceeded. Only ${event.slotCapacity - slotBooked} pizza(s) remaining in that slot.`,
    });
    return;
  }

  if (totalBooked + totalQuantity > event.totalCapacity) {
    res.status(400).json({
      error: `Total event capacity exceeded. Only ${event.totalCapacity - totalBooked} pizza(s) remaining.`,
    });
    return;
  }

  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
      eventId,
      pizzaItems: typedItems,
      quantity: totalQuantity,
      pickupSlot,
      notes: notes ?? null,
      status: "pending",
    })
    .returning();

  res.status(201).json((await enrichOrders([order]))[0]);
});

router.patch("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Load the existing order first
  const [existing] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const isAdmin = req.session.role === "admin";
  const isOwner = req.session.role === "user" && req.session.userId === existing.userId;

  if (!isAdmin && !isOwner) {
    res.status(403).json({ error: "Not allowed" });
    return;
  }

  const updateData: Record<string, unknown> = {};

  if (isAdmin) {
    // Admin can change anything
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.pickupSlot !== undefined) updateData.pickupSlot = parsed.data.pickupSlot;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
    if (parsed.data.paid !== undefined) updateData.paid = parsed.data.paid;
    if (parsed.data.items !== undefined) {
      const typedItems = parsed.data.items as PizzaItem[];
      updateData.pizzaItems = typedItems;
      updateData.quantity = typedItems.reduce((sum: number, item: PizzaItem) => sum + item.quantity, 0);
    }
  } else {
    // Guest can only change pizza types / add more pizzas — never reduce count
    if (parsed.data.items === undefined) {
      res.status(400).json({ error: "Only pizza items can be updated by guests" });
      return;
    }

    const newItems = parsed.data.items as PizzaItem[];
    const originalCount = Array.isArray(existing.pizzaItems) ? existing.pizzaItems.length : 0;

    if (newItems.length < originalCount) {
      res.status(400).json({ error: "You cannot remove pizzas from your order" });
      return;
    }

    // Validate pizza types and slot capacity
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, existing.eventId));
    if (!event) {
      res.status(400).json({ error: "Event not found" });
      return;
    }

    const eventPizzaTypes = Array.isArray(event.pizzaTypes) ? event.pizzaTypes : [];
    const validTypes = newItems.every((i) => eventPizzaTypes.some((pt: any) => pt.name === i.pizzaChoice));
    if (!validTypes) {
      res.status(400).json({ error: "Invalid pizza type" });
      return;
    }

    const newTotal = newItems.reduce((s, i) => s + i.quantity, 0);
    const existingTotal = existing.quantity;

    if (event.maxPerGuest !== null && event.maxPerGuest !== undefined && newTotal > event.maxPerGuest) {
      res.status(400).json({ error: `You can order at most ${event.maxPerGuest} pizza(s) per guest for this event.` });
      return;
    }

    if (newTotal > existingTotal) {
      // Adding more pizzas — check slot and event capacity
      const allEventOrders = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.eventId, existing.eventId));

      const totalBooked = allEventOrders
        .filter((o) => o.id !== existing.id)
        .reduce((s, o) => s + o.quantity, 0);

      if (totalBooked + newTotal > event.totalCapacity) {
        res.status(400).json({ error: `Only ${event.totalCapacity - totalBooked} pizza(s) remaining in total` });
        return;
      }

      const slotOrders = allEventOrders.filter(
        (o) => o.id !== existing.id && o.pickupSlot === existing.pickupSlot
      );
      const slotBooked = slotOrders.reduce((s, o) => s + o.quantity, 0);

      if (slotBooked + newTotal > event.slotCapacity) {
        res.status(400).json({ error: `Only ${event.slotCapacity - slotBooked} pizza(s) remaining in your slot` });
        return;
      }
    }

    updateData.pizzaItems = newItems;
    updateData.quantity = newTotal;
    // Reset to pending if confirmed, so admin re-confirms the updated order
    if (existing.status === "confirmed") updateData.status = "pending";
  }

  const [order] = await db
    .update(ordersTable)
    .set(updateData)
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  res.status(200).json((await enrichOrders([order]))[0]);
});

router.delete("/orders/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(ordersTable).where(eq(ordersTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
