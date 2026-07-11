import { Router, type IRouter } from "express";
import { db, sensorActivityTable, workoutsTable } from "@workspace/db";
import { gte } from "drizzle-orm";
import {
  IngestSensorActivityBody,
  IngestSensorActivityResponse,
} from "@workspace/api-zod";
import { ymd } from "../lib/wellness";

const router: IRouter = Router();

router.post("/sensors/activity", async (req, res): Promise<void> => {
  const parsed = IngestSensorActivityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Persist the raw sample so we can analyze patterns later.
  await db.insert(sensorActivityTable).values({
    steps: parsed.data.steps,
    durationSeconds: parsed.data.durationSeconds,
    intensity: parsed.data.intensity,
    sampleCount: parsed.data.sampleCount,
  });

  // Roll the burst into a workout entry so it shows up in totals.
  const minutes = Math.max(1, Math.round(parsed.data.durationSeconds / 60));
  const calories = Math.round(
    parsed.data.steps * 0.04 +
      minutes *
        (parsed.data.intensity === "vigorous"
          ? 9
          : parsed.data.intensity === "moderate"
            ? 6
            : 3),
  );
  await db.insert(workoutsTable).values({
    type: "walk",
    durationMinutes: minutes,
    caloriesBurned: calories,
    steps: parsed.data.steps,
    intensity: parsed.data.intensity,
    source: "sensor",
  });

  // Sum today's activity from workouts.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rows = await db
    .select()
    .from(workoutsTable)
    .where(gte(workoutsTable.loggedAt, today));
  const totalSteps = rows.reduce((acc, r) => acc + r.steps, 0);
  const activeMinutes = rows.reduce((acc, r) => acc + r.durationMinutes, 0);

  req.log.info(
    { totalSteps, activeMinutes, date: ymd(new Date()) },
    "Sensor activity ingested",
  );

  res.json(
    IngestSensorActivityResponse.parse({
      totalStepsToday: totalSteps,
      activeMinutesToday: activeMinutes,
      message: `Added ${parsed.data.steps.toLocaleString()} steps and ${minutes} active minutes from your last burst.`,
    }),
  );
});

export default router;
