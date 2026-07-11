import { Router, type IRouter } from "express";
import { db, appFocusSessionsTable } from "@workspace/db";
import { CreateFocusSessionBody } from "@workspace/api-zod";
import { ymd, addDays } from "../lib/wellness";

const router: IRouter = Router();

function serialize(s: {
  id: string;
  date: string;
  durationSeconds: number;
  category: string;
  startedAt: Date;
  endedAt: Date;
}) {
  return {
    id: s.id,
    date: s.date,
    durationSeconds: s.durationSeconds,
    category: s.category,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt.toISOString(),
  };
}

router.get("/focus-sessions", async (req, res): Promise<void> => {
  const range = (req.query["range"] as string) ?? "week";
  const all = await db.select().from(appFocusSessionsTable);
  const today = new Date();
  const todayKey = ymd(today);

  const cutoffDays = range === "month" ? 30 : range === "day" ? 1 : 7;
  const cutoffKey = ymd(addDays(today, -cutoffDays + 1));

  const filtered = all
    .filter((s) => s.date >= cutoffKey)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  const totalMinutesToday = Math.round(
    all
      .filter((s) => s.date === todayKey)
      .reduce((acc, s) => acc + s.durationSeconds, 0) / 60,
  );

  const weekStart = ymd(addDays(today, -6));
  const totalMinutesThisWeek = Math.round(
    all
      .filter((s) => s.date >= weekStart)
      .reduce((acc, s) => acc + s.durationSeconds, 0) / 60,
  );

  const byCategoryMap: Record<string, number> = {};
  for (const s of filtered) {
    byCategoryMap[s.category] =
      (byCategoryMap[s.category] ?? 0) + s.durationSeconds;
  }
  const byCategory = Object.entries(byCategoryMap)
    .map(([category, secs]) => ({
      category,
      totalMinutes: Math.round(secs / 60),
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  const byDayMap: Record<string, number> = {};
  for (let i = 0; i < cutoffDays; i++) {
    byDayMap[ymd(addDays(today, -i))] = 0;
  }
  for (const s of filtered) {
    if (byDayMap[s.date] !== undefined) {
      byDayMap[s.date]! += s.durationSeconds;
    }
  }
  const byDay = Object.entries(byDayMap)
    .map(([date, secs]) => ({
      date,
      totalMinutes: Math.round(secs / 60),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json({
    sessions: filtered.slice(0, 200).map(serialize),
    totalMinutesToday,
    totalMinutesThisWeek,
    byCategory,
    byDay,
  });
});

router.post("/focus-sessions", async (req, res): Promise<void> => {
  const parsed = CreateFocusSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const startedAt = new Date(parsed.data.startedAt);
  const endedAt = new Date(parsed.data.endedAt);
  // Cap obviously bad sessions (e.g. tab open overnight).
  if (parsed.data.durationSeconds > 3 * 60 * 60) {
    res.status(400).json({ error: "Session too long" });
    return;
  }
  const [created] = await db
    .insert(appFocusSessionsTable)
    .values({
      date: ymd(startedAt),
      durationSeconds: parsed.data.durationSeconds,
      category: parsed.data.category,
      startedAt,
      endedAt,
    })
    .returning();
  res.status(201).json(serialize(created!));
});

export default router;
