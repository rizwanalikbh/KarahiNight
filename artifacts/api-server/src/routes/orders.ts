import { Router, type IRouter } from "express";
import { db, usersTable, ordersTable, eventsTable, eventUsersTable, type PizzaItem } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateOrderBody, UpdateOrderParams, UpdateOrderBody, DeleteOrderParams, ListOrdersQueryParams } from "@workspace/api-zod";

const VALID_SLOTS = [
  "16:00-16:30",
  "16:30-17:00",
  "17:00-17:30",
  "17:30-18:00",
  "18:00-18:30",
  "18:30-19:00",
];

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
  const eventMap = new Map(allEvents.map((e) => [e.id, e.name]));

  return rawOrders.map((o) => ({
    ...o,
    userName: userMap.get(o.userId) ?? "Unknown",
    eventName: o.eventId ? (eventMap.get(o.eventId) ?? "Unknown") : "Unknown",
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

  const orders = await enrichOrders(rawOrders);
  res.json(orders);
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

  if (!VALID_SLOTS.includes(pickupSlot)) {
    res.status(400).json({ error: "Invalid pickup slot" });
    return;
  }

  // Validate event exists and user is assigned to it
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!event || !event.active) {
    res.status(400).json({ error: "Event not found or not active" });
    return;
  }

  const userId = req.session.userId!;

  const [eventUser] = await db
    .select()
    .from(eventUsersTable)
    .where(and(eq(eventUsersTable.eventId, eventId), eq(eventUsersTable.userId, userId)));

  if (!eventUser) {
    res.status(403).json({ error: "You are not invited to this event" });
    return;
  }

  // Validate items
  const validChoices = ["Margherita", "Pepperoni", "Special"];
  const validItems =
    Array.isArray(items) &&
    items.length > 0 &&
    items.every(
      (i: any) =>
        validChoices.includes(i.pizzaChoice) &&
        typeof i.quantity === "number" &&
        i.quantity >= 1
    );
  if (!validItems) {
    res.status(400).json({ error: "Invalid pizza items" });
    return;
  }
  const typedItems = items as PizzaItem[];
  const totalQuantity = typedItems.reduce((sum: number, item: PizzaItem) => sum + item.quantity, 0);

  // Check one order per user per event
  const existingOrders = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.userId, userId), eq(ordersTable.eventId, eventId)));

  if (existingOrders.length > 0) {
    res.status(400).json({ error: "You have already placed an order for this event" });
    return;
  }

  // Check event capacity
  const allEventOrders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.eventId, eventId));

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

  const enriched = await enrichOrders([order]);
  res.status(201).json(enriched[0]);
});

router.patch("/orders/:id", requireAdmin, async (req, res): Promise<void> => {
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

  const updateData: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
  if (parsed.data.pickupSlot !== undefined) updateData.pickupSlot = parsed.data.pickupSlot;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
  if (parsed.data.items !== undefined) {
    const validChoices2 = ["Margherita", "Pepperoni", "Special"];
    const validItems2 =
      Array.isArray(parsed.data.items) &&
      parsed.data.items.length > 0 &&
      parsed.data.items.every(
        (i: any) =>
          validChoices2.includes(i.pizzaChoice) &&
          typeof i.quantity === "number" &&
          i.quantity >= 1
      );
    if (!validItems2) {
      res.status(400).json({ error: "Invalid pizza items" });
      return;
    }
    const typedItems2 = parsed.data.items as PizzaItem[];
    updateData.pizzaItems = typedItems2;
    updateData.quantity = typedItems2.reduce((sum: number, item: PizzaItem) => sum + item.quantity, 0);
  }

  const [order] = await db
    .update(ordersTable)
    .set(updateData)
    .where(eq(ordersTable.id, params.data.id))
    .returning();

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const enriched = await enrichOrders([order]);
  res.status(200).json(enriched[0]);
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
