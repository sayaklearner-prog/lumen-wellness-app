import { Router, type IRouter } from "express";
import { db, sleepTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  ListSleepResponse,
  CreateSleepBody,
  DeleteSleepParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toApi(row: typeof sleepTable.$inferSelect) {
  return {
    id: row.id,
    date: row.date,
    durationHours: Number(row.durationHours),
    quality: row.quality as "poor" | "fair" | "good" | "excellent",
    bedtime: row.bedtime,
    wakeTime: row.wakeTime,
    deepSleepHours: row.deepSleepHours == null ? null : Number(row.deepSleepHours),
    notes: row.notes,
  };
}

router.get("/sleep", async (req, res): Promise<void> => {
  const rows = await db.select().from(sleepTable).orderBy(desc(sleepTable.date));
  res.json(ListSleepResponse.parse(rows.map(toApi)));
});

router.post("/sleep", async (req, res): Promise<void> => {
  const parsed = CreateSleepBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(sleepTable)
    .values({
      date: String(parsed.data.date instanceof Date
        ? parsed.data.date.toISOString().slice(0, 10)
        : parsed.data.date),
      durationHours: String(parsed.data.durationHours),
      quality: parsed.data.quality,
      bedtime: parsed.data.bedtime,
      wakeTime: parsed.data.wakeTime,
      deepSleepHours:
        parsed.data.deepSleepHours == null ? null : String(parsed.data.deepSleepHours),
      notes: parsed.data.notes ?? null,
    })
    .returning();
  res.status(201).json(toApi(row!));
});

router.delete("/sleep/:id", async (req, res): Promise<void> => {
  const params = DeleteSleepParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(sleepTable)
    .where(eq(sleepTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Sleep entry not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
