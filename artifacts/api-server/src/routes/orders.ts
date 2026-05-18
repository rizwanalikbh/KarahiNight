import { Router, type IRouter } from "express";
import { db, usersTable, ordersTable, type PizzaItem } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateOrderBody, UpdateOrderParams, UpdateOrderBody, DeleteOrderParams } from "@workspace/api-zod";

const TOTAL_CAPACITY = 10;
const SLOT_CAPACITY = 3;

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

  return rawOrders.map((o) => ({
    ...o,
    userName: userMap.get(o.userId) ?? "Unknown",
    items: Array.isArray(o.pizzaItems) ? o.pizzaItems : [],
    notes: o.notes ?? null,
    createdAt: o.createdAt.toISOString(),
  }));
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  let rawOrders;

  if (req.session.role === "admin") {
    rawOrders = await db.select().from(ordersTable).orderBy(ordersTable.createdAt);
  } else {
    rawOrders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.userId, req.session.userId!));
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

  const { items, pickupSlot, notes } = parsed.data;

  if (!VALID_SLOTS.includes(pickupSlot)) {
    res.status(400).json({ error: "Invalid pickup slot" });
    return;
  }

  // Validate items
  const validChoices = ["Margherita", "Pepperoni", "Special"];
  const validItems = Array.isArray(items) && items.length > 0 &&
    items.every((i: any) => validChoices.includes(i.pizzaChoice) && typeof i.quantity === "number" && i.quantity >= 1);
  if (!validItems) {
    res.status(400).json({ error: "Invalid pizza items" });
    return;
  }
  const typedItems = items as PizzaItem[];
  const totalQuantity = typedItems.reduce((sum: number, item: PizzaItem) => sum + item.quantity, 0);

  const userId = req.session.userId!;

  const existingOrders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.userId, userId));

  if (existingOrders.length > 0) {
    res.status(400).json({ error: "You have already placed an order" });
    return;
  }

  const allOrders = await db.select().from(ordersTable);
  const totalBooked = allOrders.reduce((sum, o) => sum + o.quantity, 0);

  if (totalBooked >= TOTAL_CAPACITY) {
    res.status(400).json({ error: "Event is fully booked (10 pizza maximum reached)" });
    return;
  }

  const slotOrders = allOrders.filter((o) => o.pickupSlot === pickupSlot);
  const slotBooked = slotOrders.reduce((sum, o) => sum + o.quantity, 0);

  if (slotBooked + totalQuantity > SLOT_CAPACITY) {
    res.status(400).json({
      error: `Slot capacity exceeded. Only ${SLOT_CAPACITY - slotBooked} pizza(s) remaining in that slot.`,
    });
    return;
  }

  if (totalBooked + totalQuantity > TOTAL_CAPACITY) {
    res.status(400).json({
      error: `Total event capacity exceeded. Only ${TOTAL_CAPACITY - totalBooked} pizza(s) remaining.`,
    });
    return;
  }

  const [order] = await db
    .insert(ordersTable)
    .values({
      userId,
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
    const validItems2 = Array.isArray(parsed.data.items) && parsed.data.items.length > 0 &&
      parsed.data.items.every((i: any) => validChoices2.includes(i.pizzaChoice) && typeof i.quantity === "number" && i.quantity >= 1);
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
