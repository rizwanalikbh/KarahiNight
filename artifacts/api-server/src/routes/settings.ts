import { Router, type IRouter } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const DEFAULT_CONSENT_TEXT =
  "Your mobile number and name are stored solely to organise this event — for example to confirm your order or contact you on the day. Your data will never be used for marketing purposes. It will be permanently deleted after one year.";

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

export default router;
