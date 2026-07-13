import { Router, type IRouter } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const DEFAULT_CONSENT_TEXT =
  "Your mobile number and name are stored solely to organise this event — for example to confirm your order or contact you on the day. Your data will never be used for marketing purposes. It will be permanently deleted after one year.";

export const DEFAULT_ORDER_TERMS =
  "By placing this order you confirm that:\n\n" +
  "1. You will collect your dish(es) at the selected pickup slot.\n" +
  "2. Payment is due at pickup, based on the dishes ordered — cash or MobilePay accepted.\n" +
  "3. Orders can only be cancelled by messaging the organiser before the event.\n" +
  "4. Uncollected and unpaid orders may affect your invitation to future events.\n" +
  "5. Your name, contact details, and order information are stored solely to manage this event and will be permanently deleted within one year.";

export async function seedConsentText(): Promise<void> {
  const [existing] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "consent_text"))
    .limit(1);
  if (!existing) {
    await db.insert(appSettingsTable).values({ key: "consent_text", value: DEFAULT_CONSENT_TEXT });
  }
}

export async function seedOrderTerms(): Promise<void> {
  const [existing] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "order_terms"))
    .limit(1);
  if (!existing) {
    await db.insert(appSettingsTable).values({ key: "order_terms", value: DEFAULT_ORDER_TERMS });
  }
}

export const DEFAULT_EVENT_DESCRIPTION =
  "Authentic restaurant-style karahi, flame-cooked fresh to order. Orders close two days before pickup.\n" +
  "This week: [add special item here e.g. free Kheer, Gulab Jamun, new dish — or delete this line]";

export async function seedDefaultEventDescription(): Promise<void> {
  const [existing] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "default_event_description"))
    .limit(1);
  if (!existing) {
    await db.insert(appSettingsTable).values({ key: "default_event_description", value: DEFAULT_EVENT_DESCRIPTION });
  }
}

const router: IRouter = Router();

router.get("/settings/consent-text", async (req, res): Promise<void> => {
  const [setting] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "consent_text"))
    .limit(1);
  res.json({ value: setting?.value ?? DEFAULT_CONSENT_TEXT });
});

router.patch("/settings/consent-text", async (req, res): Promise<void> => {
  if (req.session?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const { value } = req.body as { value?: unknown };
  if (!value || typeof value !== "string" || !value.trim()) {
    res.status(400).json({ error: "value is required" });
    return;
  }
  await db
    .insert(appSettingsTable)
    .values({ key: "consent_text", value: value.trim() })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value: value.trim(), updatedAt: new Date() },
    });
  res.json({ value: value.trim() });
});

router.get("/settings/order-terms", async (req, res): Promise<void> => {
  const [setting] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "order_terms"))
    .limit(1);
  res.json({ value: setting?.value ?? DEFAULT_ORDER_TERMS });
});

router.patch("/settings/order-terms", async (req, res): Promise<void> => {
  if (req.session?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const { value } = req.body as { value?: unknown };
  if (!value || typeof value !== "string" || !value.trim()) {
    res.status(400).json({ error: "value is required" });
    return;
  }
  await db
    .insert(appSettingsTable)
    .values({ key: "order_terms", value: value.trim() })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value: value.trim(), updatedAt: new Date() },
    });
  res.json({ value: value.trim() });
});

router.get("/settings/default-event-description", async (req, res): Promise<void> => {
  const [setting] = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "default_event_description"))
    .limit(1);
  res.json({ value: setting?.value ?? DEFAULT_EVENT_DESCRIPTION });
});

router.patch("/settings/default-event-description", async (req, res): Promise<void> => {
  if (req.session?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  const { value } = req.body as { value?: unknown };
  if (typeof value !== "string") {
    res.status(400).json({ error: "value is required" });
    return;
  }
  await db
    .insert(appSettingsTable)
    .values({ key: "default_event_description", value: value.trim() })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value: value.trim(), updatedAt: new Date() },
    });
  res.json({ value: value.trim() });
});

export default router;
