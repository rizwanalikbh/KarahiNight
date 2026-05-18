import { Router, type IRouter } from "express";
import { db, ordersTable } from "@workspace/db";

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

router.get("/summary", async (req, res): Promise<void> => {
  const allOrders = await db.select().from(ordersTable);

  const totalBooked = allOrders.reduce((sum, o) => sum + o.quantity, 0);
  const totalRemaining = Math.max(0, TOTAL_CAPACITY - totalBooked);
  const orderingOpen = totalRemaining > 0;

  const slots = VALID_SLOTS.map((slot) => {
    const slotOrders = allOrders.filter((o) => o.pickupSlot === slot);
    const booked = slotOrders.reduce((sum, o) => sum + o.quantity, 0);
    const available = Math.max(0, SLOT_CAPACITY - booked);
    return { slot, booked, capacity: SLOT_CAPACITY, available };
  });

  res.json({
    totalCapacity: TOTAL_CAPACITY,
    totalBooked,
    totalRemaining,
    orderingOpen,
    slots,
  });
});

export default router;
