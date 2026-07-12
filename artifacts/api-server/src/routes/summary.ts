import { Router, type IRouter } from "express";
import { db, ordersTable, eventsTable, eventUsersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetSummaryQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/summary", async (req, res): Promise<void> => {
  const queryParsed = GetSummaryQueryParams.safeParse(req.query);
  const requestedEventId = queryParsed.success ? queryParsed.data.eventId : undefined;

  let event;
  if (requestedEventId) {
    const [found] = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.id, requestedEventId));
    event = found;
  } else {
    const [first] = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.active, true))
      .orderBy(eventsTable.date)
      .limit(1);
    event = first;
  }

  if (!event) {
    res.status(404).json({ error: "No event found" });
    return;
  }

  const eventSlots = Array.isArray(event.slots) ? event.slots : [];
  const eventPizzaTypes = Array.isArray(event.pizzaTypes) ? event.pizzaTypes : [];

  const allOrders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.eventId, event.id));

  const totalBooked = allOrders.reduce((sum, o) => sum + o.quantity, 0);
  const totalRemaining = Math.max(0, event.totalCapacity - totalBooked);
  const pastDeadline = event.orderDeadline ? new Date() > new Date(event.orderDeadline) : false;
  const orderingOpen = totalRemaining > 0 && event.active && !pastDeadline;

  const slots = eventSlots.map((slot) => {
    const slotOrders = allOrders.filter((o) => o.pickupSlot === slot);
    const booked = slotOrders.reduce((sum, o) => sum + o.quantity, 0);
    const available = Math.max(0, event.slotCapacity - booked);
    return { slot, booked, capacity: event.slotCapacity, available };
  });

  const directUserRows = await db
    .select({ userId: eventUsersTable.userId })
    .from(eventUsersTable)
    .where(eq(eventUsersTable.eventId, event.id));
  const directUserIds = directUserRows.map((r) => r.userId);

  let guests: { id: number; name: string }[] = [];
  if (directUserIds.length > 0) {
    const userRows = await db
      .select({ id: usersTable.id, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.active, true));
    guests = userRows
      .filter((u) => directUserIds.includes(u.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  res.json({
    eventId: event.id,
    eventName: event.name,
    eventDate: event.date,
    totalCapacity: event.totalCapacity,
    totalBooked,
    totalRemaining,
    orderingOpen,
    orderDeadline: event.orderDeadline ? event.orderDeadline.toISOString() : null,
    maxPerGuest: event.maxPerGuest ?? null,
    description: event.description ?? null,
    pizzaTypes: eventPizzaTypes,
    slots,
    guests,
    location: event.location ?? null,
    locationUrl: event.locationUrl ?? null,
    bannerVariant: event.bannerVariant ?? null,
    customBannerUrl: event.customBannerUrl ?? null,
  });
});

export default router;
