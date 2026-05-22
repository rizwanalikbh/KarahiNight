import { Router, type IRouter } from "express";
import { db, segmentsTable, userSegmentsTable, eventSegmentsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import {
  CreateSegmentBody,
  DeleteSegmentParams,
  UpdateSegmentParams,
  UpdateSegmentBody,
  ListSegmentUsersParams,
  AddUserToSegmentParams,
  AddUserToSegmentBody,
  RemoveUserFromSegmentParams,
  ListEventSegmentsParams,
  AddSegmentToEventParams,
  AddSegmentToEventBody,
  RemoveSegmentFromEventParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function requireAdmin(req: any, res: any, next: any): void {
  if (req.session?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

router.get("/segments", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: segmentsTable.id,
      name: segmentsTable.name,
      description: segmentsTable.description,
      tags: segmentsTable.tags,
      createdAt: segmentsTable.createdAt,
      memberCount: sql<number>`cast(count(${userSegmentsTable.id}) as int)`,
    })
    .from(segmentsTable)
    .leftJoin(userSegmentsTable, eq(userSegmentsTable.segmentId, segmentsTable.id))
    .groupBy(segmentsTable.id)
    .orderBy(segmentsTable.name);
  res.json(rows);
});

router.post("/segments", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateSegmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [segment] = await db
    .insert(segmentsTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      tags: parsed.data.tags ?? null,
    })
    .returning();

  res.status(201).json({ ...segment, memberCount: 0 });
});

router.patch("/segments/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateSegmentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateSegmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = {};
  if ("description" in parsed.data) updateData.description = parsed.data.description ?? null;
  if ("tags" in parsed.data) updateData.tags = parsed.data.tags ?? null;

  const [segment] = await db
    .update(segmentsTable)
    .set(updateData)
    .where(eq(segmentsTable.id, params.data.id))
    .returning();

  if (!segment) { res.status(404).json({ error: "Segment not found" }); return; }

  const [countRow] = await db
    .select({ memberCount: sql<number>`cast(count(*) as int)` })
    .from(userSegmentsTable)
    .where(eq(userSegmentsTable.segmentId, segment.id));

  res.json({ ...segment, memberCount: countRow?.memberCount ?? 0 });
});

router.delete("/segments/:id", requireAdmin, async (req, res): Promise<void> => {
  const parsed = DeleteSegmentParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.delete(segmentsTable).where(eq(segmentsTable.id, parsed.data.id));
  res.sendStatus(204);
});

router.get("/segments/:id/users", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListSegmentUsersParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const rows = await db
    .select({ id: usersTable.id, name: usersTable.name, code: usersTable.code, active: usersTable.active, createdAt: usersTable.createdAt })
    .from(userSegmentsTable)
    .innerJoin(usersTable, eq(usersTable.id, userSegmentsTable.userId))
    .where(eq(userSegmentsTable.segmentId, parsed.data.id))
    .orderBy(usersTable.name);
  res.json(rows);
});

router.post("/segments/:id/users", requireAdmin, async (req, res): Promise<void> => {
  const params = AddUserToSegmentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = AddUserToSegmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await db.insert(userSegmentsTable)
    .values({ segmentId: params.data.id, userId: parsed.data.userId })
    .onConflictDoNothing();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.status(201).json(user);
});

router.delete("/segments/:id/users/:userId", requireAdmin, async (req, res): Promise<void> => {
  const parsed = RemoveUserFromSegmentParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await db.delete(userSegmentsTable).where(
    and(
      eq(userSegmentsTable.segmentId, parsed.data.id),
      eq(userSegmentsTable.userId, parsed.data.userId),
    )
  );
  res.sendStatus(204);
});

router.get("/events/:id/segments", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListEventSegmentsParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const rows = await db
    .select({
      id: segmentsTable.id,
      name: segmentsTable.name,
      description: segmentsTable.description,
      tags: segmentsTable.tags,
      createdAt: segmentsTable.createdAt,
      memberCount: sql<number>`cast(count(${userSegmentsTable.id}) as int)`,
    })
    .from(eventSegmentsTable)
    .innerJoin(segmentsTable, eq(segmentsTable.id, eventSegmentsTable.segmentId))
    .leftJoin(userSegmentsTable, eq(userSegmentsTable.segmentId, segmentsTable.id))
    .where(eq(eventSegmentsTable.eventId, parsed.data.id))
    .groupBy(segmentsTable.id)
    .orderBy(segmentsTable.name);
  res.json(rows);
});

router.post("/events/:id/segments", requireAdmin, async (req, res): Promise<void> => {
  const params = AddSegmentToEventParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = AddSegmentToEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await db.insert(eventSegmentsTable)
    .values({ eventId: params.data.id, segmentId: parsed.data.segmentId })
    .onConflictDoNothing();

  res.sendStatus(201);
});

router.delete("/events/:id/segments/:segmentId", requireAdmin, async (req, res): Promise<void> => {
  const parsed = RemoveSegmentFromEventParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  await db.delete(eventSegmentsTable).where(
    and(
      eq(eventSegmentsTable.eventId, parsed.data.id),
      eq(eventSegmentsTable.segmentId, parsed.data.segmentId),
    )
  );
  res.sendStatus(204);
});

export default router;
