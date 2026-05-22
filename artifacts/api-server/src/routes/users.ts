import { Router, type IRouter } from "express";
import { db, usersTable, segmentsTable, userSegmentsTable } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import {
  CreateUserBody, UpdateUserParams, UpdateUserBody, DeleteUserParams,
  RegenerateCodeParams, ImportUsersBody, ListUserSegmentsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAdmin(req: any, res: any, next: any): void {
  if (req.session?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

function generateCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function isUniqueViolation(err: unknown): boolean {
  // Check direct code or cause chain (Drizzle wraps the PG error)
  let e: any = err;
  while (e) {
    if (e?.code === "23505") return true;
    e = e?.cause;
  }
  return false;
}

router.get("/users", requireAdmin, async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

router.post("/users/import-csv", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ImportUsersBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const guest of parsed.data.guests) {
    const name = guest.name.trim();
    if (!name) { skipped++; continue; }
    try {
      const code = generateCode();
      await db.insert(usersTable).values({
        name,
        code,
        email: guest.email?.trim() || null,
        mobile: guest.mobile?.trim() || null,
        active: true,
      });
      created++;
    } catch (err) {
      if (isUniqueViolation(err)) {
        skipped++;
      } else {
        errors.push(`${name}: ${(err as any)?.message ?? "unknown error"}`);
      }
    }
  }

  res.json({ created, skipped, errors });
});

router.post("/users", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const code = generateCode();
    const [user] = await db
      .insert(usersTable)
      .values({
        name: parsed.data.name,
        code,
        email: parsed.data.email?.trim() || null,
        mobile: parsed.data.mobile?.trim() || null,
        active: true,
      })
      .returning();
    res.status(201).json(user);
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "Email or mobile number already in use" });
      return;
    }
    throw err;
  }
});

router.patch("/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.active !== undefined) updateData.active = parsed.data.active;
  if ("email" in parsed.data) updateData.email = parsed.data.email?.trim() || null;
  if ("mobile" in parsed.data) updateData.mobile = parsed.data.mobile?.trim() || null;

  try {
    const [user] = await db
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, params.data.id))
      .returning();

    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json(user);
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "Email or mobile number already in use" });
      return;
    }
    throw err;
  }
});

router.delete("/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/users/:id/segments", requireAdmin, async (req, res): Promise<void> => {
  const params = ListUserSegmentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const memberships = await db
    .select({ segmentId: userSegmentsTable.segmentId })
    .from(userSegmentsTable)
    .where(eq(userSegmentsTable.userId, params.data.id));

  if (memberships.length === 0) { res.json([]); return; }

  const segmentIds = memberships.map((m) => m.segmentId);
  const rows = await db
    .select({
      id: segmentsTable.id,
      name: segmentsTable.name,
      createdAt: segmentsTable.createdAt,
      memberCount: sql<number>`cast(count(${userSegmentsTable.id}) as int)`,
    })
    .from(segmentsTable)
    .leftJoin(userSegmentsTable, eq(userSegmentsTable.segmentId, segmentsTable.id))
    .where(inArray(segmentsTable.id, segmentIds))
    .groupBy(segmentsTable.id)
    .orderBy(segmentsTable.name);

  res.json(rows);
});

router.post("/users/:id/regenerate-code", requireAdmin, async (req, res): Promise<void> => {
  const params = RegenerateCodeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const code = generateCode();
  const [user] = await db
    .update(usersTable)
    .set({ code })
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

export default router;
export { requireAdmin, generateCode };
