import { Router, type IRouter } from "express";
import { db, ordersTable, eventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetSummaryQueryParams } from "@workspace/api-zod";

const VALID_SLOTS = [
  "16:00-16:30",
  "16:30-17:00",
  "17:00-17:30",
  "17:30-18:00",
  "18:00-18:30",
  "18:30-19:00",
];

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

  const allOrders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.eventId, event.id));

  const totalBooked = allOrders.reduce((sum, o) => sum + o.quantity, 0);
  const totalRemaining = Math.max(0, event.totalCapacity - totalBooked);
  const orderingOpen = totalRemaining > 0 && event.active;

  const slots = VALID_SLOTS.map((slot) => {
    const slotOrders = allOrders.filter((o) => o.pickupSlot === slot);
    const booked = slotOrders.reduce((sum, o) => sum + o.quantity, 0);
    const available = Math.max(0, event.slotCapacity - booked);
    return { slot, booked, capacity: event.slotCapacity, available };
  });

  res.json({
    eventId: event.id,
    eventName: event.name,
    eventDate: event.date,
    totalCapacity: event.totalCapacity,
    totalBooked,
    totalRemaining,
    orderingOpen,
    slots,
  });
});

export default router;
