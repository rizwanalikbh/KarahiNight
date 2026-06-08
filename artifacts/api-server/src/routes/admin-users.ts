import { Router, type IRouter } from "express";
import { db, adminUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
const router: IRouter = Router();

function requireAdmin(req: any, res: any, next: any): void {
  if (req.session?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

function normaliseMobile(raw: string): string {
  return raw.startsWith("+") ? raw : `+45${raw}`;
}

router.get("/admin-users", requireAdmin, async (req, res): Promise<void> => {
  const admins = await db
    .select()
    .from(adminUsersTable)
    .orderBy(adminUsersTable.createdAt);
  res.json(admins.map((a) => ({
    id: a.id,
    mobile: a.mobile,
    isSuperuser: a.isSuperuser,
    createdAt: a.createdAt,
  })));
});

router.post("/admin-users", requireAdmin, async (req, res): Promise<void> => {
  const raw = req.body?.mobile;
  if (!raw || typeof raw !== "string") {
    res.status(400).json({ error: "mobile is required" });
    return;
  }

  const mobile = normaliseMobile(raw);

  try {
    const [created] = await db
      .insert(adminUsersTable)
      .values({ mobile, isSuperuser: false })
      .returning();
    res.status(201).json({
      id: created.id,
      mobile: created.mobile,
      isSuperuser: created.isSuperuser,
      createdAt: created.createdAt,
    });
  } catch (err: any) {
    let e: any = err;
    while (e) { if (e?.code === "23505") { res.status(400).json({ error: "This mobile is already an admin" }); return; } e = e?.cause; }
    throw err;
  }
});

router.delete("/admin-users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [existing] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Admin user not found" }); return; }
  if (existing.isSuperuser) { res.status(403).json({ error: "The superuser cannot be removed" }); return; }

  await db.delete(adminUsersTable).where(eq(adminUsersTable.id, id));
  res.json({ success: true });
});

export default router;
