import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, glucoseReadingsTable, type GlucoseReadingRow } from "@workspace/db";
import { CreateGlucoseReadingBody } from "@workspace/api-zod";
import { getOrCreateProfile } from "../lib/store";

const router: IRouter = Router();

function serialize(r: GlucoseReadingRow) {
  return {
    id: r.id,
    valueMgDl: r.valueMgDl,
    context: r.context,
    notes: r.notes ?? null,
    source: r.source,
    loggedAt: r.loggedAt.toISOString(),
  };
}

router.get("/glucose-readings", async (_req, res): Promise<void> => {
  const profile = await getOrCreateProfile();
  const readings = await db
    .select()
    .from(glucoseReadingsTable)
    .orderBy(desc(glucoseReadingsTable.loggedAt));

  const inRange = readings.filter(
    (r) =>
      r.valueMgDl >= profile.glucoseTargetLow &&
      r.valueMgDl <= profile.glucoseTargetHigh,
  );
  const lowEvents = readings.filter((r) => r.valueMgDl < profile.glucoseTargetLow).length;
  const highEvents = readings.filter((r) => r.valueMgDl > profile.glucoseTargetHigh).length;
  const avg =
    readings.length > 0
      ? readings.reduce((a, b) => a + b.valueMgDl, 0) / readings.length
      : 0;
  const tir = readings.length > 0 ? (inRange.length / readings.length) * 100 : 0;

  res.json({
    readings: readings.map(serialize),
    summary: {
      averageMgDl: Number(avg.toFixed(1)),
      timeInRangePct: Number(tir.toFixed(1)),
      readingsCount: readings.length,
      lastReadingMgDl: readings[0]?.valueMgDl ?? null,
      targetLow: profile.glucoseTargetLow,
      targetHigh: profile.glucoseTargetHigh,
      lowEvents,
      highEvents,
    },
  });
});

router.post("/glucose-readings", async (req, res): Promise<void> => {
  const parsed = CreateGlucoseReadingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [created] = await db
    .insert(glucoseReadingsTable)
    .values({
      valueMgDl: parsed.data.valueMgDl,
      context: parsed.data.context,
      notes: parsed.data.notes ?? null,
      source: "manual",
    })
    .returning();
  res.status(201).json(serialize(created!));
});

router.delete("/glucose-readings/:id", async (req, res): Promise<void> => {
  const id = req.params["id"]!;
  await db.delete(glucoseReadingsTable).where(eq(glucoseReadingsTable.id, id));
  res.status(204).end();
});

export default router;
