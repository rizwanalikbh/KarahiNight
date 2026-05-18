import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { LoginBody, AdminLoginBody } from "@workspace/api-zod";

declare module "express-session" {
  interface SessionData {
    userId?: number;
    userName?: string;
    role?: "user" | "admin";
  }
}

const ADMIN_PASSWORD = "IamAdmin";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, code } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.name, name));

  if (!user || !user.active || user.code !== code) {
    res.status(401).json({ error: "Invalid name or code" });
    return;
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

router.post("/auth/admin-login", async (req, res): Promise<void> => {
  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid admin password" });
    return;
  }

  req.session.role = "admin";
  req.session.userId = undefined;
  req.session.userName = undefined;

  res.json({ success: true, role: "admin", userId: null, userName: null });
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
