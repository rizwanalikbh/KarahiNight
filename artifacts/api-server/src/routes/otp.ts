import { Router, type IRouter } from "express";
import { db, usersTable, otpSessionsTable, ordersTable, adminUsersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { SendOtpBody, VerifyOtpBody } from "@workspace/api-zod";
import twilio from "twilio";

const router: IRouter = Router();

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getTwilioClient() {
  const sid = process.env["TWILIO_ACCOUNT_SID"];
  const token = process.env["TWILIO_AUTH_TOKEN"];
  if (!sid || !token) return null;
  return twilio(sid, token);
}

function normaliseMobile(raw: string): string {
  return raw.startsWith("+") ? raw : `+45${raw}`;
}

router.post("/otp/send", async (req, res): Promise<void> => {
  const parsed = SendOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { mobile: rawMobile, name, loginMode, adminMode } = parsed.data;
  const mobile = normaliseMobile(rawMobile);

  if (adminMode) {
    const [adminUser] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.mobile, mobile))
      .limit(1);

    if (!adminUser) {
      res.status(403).json({ error: "This number is not registered as an admin." });
      return;
    }
  } else if (loginMode) {
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.mobile, mobile))
      .limit(1);

    if (!existingUser) {
      res.status(403).json({ error: "No orders found for this number. Please place an order first." });
      return;
    }

    const [existingOrder] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.userId, existingUser.id))
      .limit(1);

    if (!existingOrder) {
      res.status(403).json({ error: "No orders found for this number. Please place an order first." });
      return;
    }
  }

  const resolvedName = name ?? "Guest";
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await db.delete(otpSessionsTable).where(eq(otpSessionsTable.mobile, mobile));
  await db.insert(otpSessionsTable).values({ mobile, name: resolvedName, code, expiresAt });

  const client = getTwilioClient();
  if (client) {
    const from = process.env["TWILIO_PHONE_NUMBER"];
    try {
      await client.messages.create({
        body: `Your Pizza Night code is: ${code}`,
        from,
        to: mobile,
      });
    } catch (err: any) {
      req.log.error({ err }, "Failed to send SMS");
      res.status(500).json({ error: "Failed to send SMS. Please check your number and try again." });
      return;
    }
  } else {
    req.log.info({ mobile, code }, "OTP (Twilio not configured — test mode)");
  }

  res.json({ success: true });
});

router.post("/otp/verify", async (req, res): Promise<void> => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { mobile: rawMobile, code, adminMode } = parsed.data;
  const mobile = normaliseMobile(rawMobile);

  const [otpRecord] = await db
    .select()
    .from(otpSessionsTable)
    .where(
      and(
        eq(otpSessionsTable.mobile, mobile),
        eq(otpSessionsTable.used, false),
        gt(otpSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!otpRecord || otpRecord.code !== code) {
    res.status(401).json({ error: "Invalid or expired code. Please try again." });
    return;
  }

  await db
    .update(otpSessionsTable)
    .set({ used: true })
    .where(eq(otpSessionsTable.id, otpRecord.id));

  if (adminMode) {
    const [adminUser] = await db
      .select()
      .from(adminUsersTable)
      .where(eq(adminUsersTable.mobile, mobile))
      .limit(1);

    if (!adminUser) {
      res.status(403).json({ error: "This number is not registered as an admin." });
      return;
    }

    req.session.role = "admin";
    req.session.userId = undefined;
    req.session.userName = undefined;

    res.json({ success: true, role: "admin" as const, userId: null, userName: null });
    return;
  }

  let [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.mobile, mobile));

  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({ name: otpRecord.name, mobile, active: true })
      .returning();
  }

  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.role = "user";

  res.json({
    success: true,
    userId: user.id,
    userName: user.name,
    role: "user" as const,
  });
});

export default router;
