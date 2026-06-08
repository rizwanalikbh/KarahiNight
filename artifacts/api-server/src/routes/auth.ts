import { Router, type IRouter } from "express";
import { db, usersTable, userSegmentsTable, eventSegmentsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { LoginBody } from "@workspace/api-zod";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    userName?: string;
    role?: "user" | "admin";
  }
}

const router: IRouter = Router();

async function userBelongsToEvent(userId: number, eventId: number): Promise<boolean> {
  const userSegs = await db
    .select({ segmentId: userSegmentsTable.segmentId })
    .from(userSegmentsTable)
    .where(eq(userSegmentsTable.userId, userId));
  if (userSegs.length === 0) return false;

  const segIds = userSegs.map((s) => s.segmentId);
  const [viaSegment] = await db
    .select({ eventId: eventSegmentsTable.eventId })
    .from(eventSegmentsTable)
    .where(and(eq(eventSegmentsTable.eventId, eventId), inArray(eventSegmentsTable.segmentId, segIds)));
  return !!viaSegment;
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, code, eventId } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.name, name));

  if (!user || !user.active || user.code !== code) {
    res.status(401).json({ error: "Invalid name or code" });
    return;
  }

  if (eventId !== undefined && eventId !== null) {
    const isMember = await userBelongsToEvent(user.id, eventId);
    if (!isMember) {
      res.status(403).json({ error: "You're not on the guest list for this event" });
      return;
    }
  }

  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.role = "user";

  res.json({
    success: true,
    role: "user",
    userId: user.id,
    userName: user.name,
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

router.get("/auth/me", (req, res): void => {
  if (!req.session.role) {
    res.json({ authenticated: false, role: null, userId: null, userName: null });
    return;
  }

  res.json({
    authenticated: true,
    role: req.session.role,
    userId: req.session.userId ?? null,
    userName: req.session.userName ?? null,
  });
});

export default router;
