import { Router, type IRouter } from "express";
import { db, screenTimeTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import {
  ListScreenTimeResponse,
  CreateScreenTimeBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function toApi(row: typeof screenTimeTable.$inferSelect) {
  return {
    id: row.id,
    date: row.date,
    totalMinutes: row.totalMinutes,
    socialMinutes: row.socialMinutes,
    productivityMinutes: row.productivityMinutes,
    entertainmentMinutes: row.entertainmentMinutes,
    otherMinutes: row.otherMinutes,
  };
}

router.get("/screentime", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(screenTimeTable)
    .orderBy(desc(screenTimeTable.date));
  res.json(ListScreenTimeResponse.parse(rows.map(toApi)));
});

router.post("/screentime", async (req, res): Promise<void> => {
  const parsed = CreateScreenTimeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data as Record<string, unknown>;
  const [row] = await db
    .insert(screenTimeTable)
    .values({
      date: (data["date"] as string) ?? new Date().toISOString().slice(0, 10),
      totalMinutes: Number(data["totalMinutes"] ?? data["durationSeconds"] ?? 0),
      socialMinutes: Number(data["socialMinutes"] ?? 0),
      productivityMinutes: Number(data["productivityMinutes"] ?? 0),
      entertainmentMinutes: Number(data["entertainmentMinutes"] ?? 0),
      otherMinutes: Number(data["otherMinutes"] ?? 0),
    })
    .returning();
  res.status(201).json(toApi(row!));
});

export default router;
