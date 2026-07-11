import { Router, type IRouter } from "express";
import { db, workoutsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  ListWorkoutsQueryParams,
  ListWorkoutsResponse,
  CreateWorkoutBody,
  DeleteWorkoutParams,
} from "@workspace/api-zod";
import { ymd } from "../lib/wellness";

const router: IRouter = Router();

function toApi(row: typeof workoutsTable.$inferSelect) {
  return {
    id: row.id,
    type: row.type as
      | "walk"
      | "run"
      | "cycle"
      | "strength"
      | "yoga"
      | "swim"
      | "hiit"
      | "sport"
      | "other",
    durationMinutes: row.durationMinutes,
    caloriesBurned: row.caloriesBurned,
    steps: row.steps,
    intensity: row.intensity as "light" | "moderate" | "vigorous",
    loggedAt: row.loggedAt,
    source: row.source as "manual" | "sensor",
  };
}

router.get("/workouts", async (req, res): Promise<void> => {
  const parsed = ListWorkoutsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db.select().from(workoutsTable).orderBy(desc(workoutsTable.loggedAt));
  const filtered = parsed.data.date
    ? rows.filter((r) => ymd(new Date(r.loggedAt)) === parsed.data.date)
    : rows;
  res.json(ListWorkoutsResponse.parse(filtered.map(toApi)));
});

router.post("/workouts", async (req, res): Promise<void> => {
  const parsed = CreateWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(workoutsTable)
    .values({
      type: parsed.data.type,
      durationMinutes: parsed.data.durationMinutes,
      caloriesBurned: parsed.data.caloriesBurned,
      steps: parsed.data.steps,
      intensity: parsed.data.intensity,
      source: parsed.data.source,
    })
    .returning();
  res.status(201).json(toApi(row!));
});

router.delete("/workouts/:id", async (req, res): Promise<void> => {
  const params = DeleteWorkoutParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(workoutsTable)
    .where(eq(workoutsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
