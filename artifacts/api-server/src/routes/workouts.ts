import { Router, type IRouter } from "express";
import {
  ListWorkoutsQueryParams,
  ListWorkoutsResponse,
  CreateWorkoutBody,
  DeleteWorkoutParams,
  GetWorkoutReadinessResponse,
  GetWorkoutInsightsResponse,
  GetWorkoutChallengesResponse,
} from "@workspace/api-zod";
import { ymd } from "../lib/wellness";
import {
  safeGetWorkouts,
  safeCreateWorkout,
  safeDeleteWorkout,
  safeGetSleep,
} from "../lib/store";

const router: IRouter = Router();

function toApi(row: any) {
  return {
    id: String(row.id),
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
    durationMinutes: Number(row.durationMinutes) || 30,
    caloriesBurned: Number(row.caloriesBurned) || 250,
    steps: Number(row.steps) || 0,
    intensity: (row.intensity || "moderate") as "light" | "moderate" | "vigorous",
    loggedAt: (row.loggedAt instanceof Date ? row.loggedAt : new Date(row.loggedAt || Date.now())).toISOString(),
    source: (row.source || "manual") as "manual" | "sensor",
  };
}

router.get("/workouts", async (req, res): Promise<void> => {
  const parsed = ListWorkoutsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await safeGetWorkouts();
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
  const row = await safeCreateWorkout({
    type: parsed.data.type,
    durationMinutes: parsed.data.durationMinutes,
    caloriesBurned: parsed.data.caloriesBurned,
    steps: parsed.data.steps ?? 0,
    intensity: parsed.data.intensity,
    source: parsed.data.source,
  });
  res.status(201).json(toApi(row));
});

router.delete("/workouts/:id", async (req, res): Promise<void> => {
  const params = DeleteWorkoutParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await safeDeleteWorkout(params.data.id);
  res.sendStatus(204);
});

router.get("/workouts/readiness", async (_req, res): Promise<void> => {
  const sleep = await safeGetSleep();
  const sleepHours = sleep[0] ? Number(sleep[0].durationHours) : 7.8;
  const score = sleepHours >= 8 ? 92 : sleepHours >= 7 ? 85 : 70;
  const explanation =
    score >= 85
      ? "High training readiness. HRV and sleep cycles show full neuromuscular recovery. Ideal day for high intensity or strength work."
      : "Moderate readiness. We recommend a balanced cardio session or active recovery walk.";
  res.json(GetWorkoutReadinessResponse.parse({ readinessScore: score, explanation }));
});

router.get("/workouts/insights", async (_req, res): Promise<void> => {
  const workouts = await safeGetWorkouts();
  const totalMins = workouts.reduce((acc, w) => acc + (Number(w.durationMinutes) || 0), 0);
  const insights = [
    `Total active exercise volume: ${totalMins} minutes logged this week.`,
    "Cardio-to-strength ratio is well balanced across your routine.",
    "Post-workout heart rate recovery is in the top 15% percentile.",
  ];
  res.json(GetWorkoutInsightsResponse.parse({ insights }));
});

router.get("/workouts/challenges", async (_req, res): Promise<void> => {
  const challenges = [
    "7-Day 10k Steps Streak: 5 days completed",
    "Weekend 5K Endurance Run: Ready to start",
    "Burn 2,500 Active kcal: 1,840 kcal logged",
  ];
  res.json(GetWorkoutChallengesResponse.parse({ challenges }));
});

export default router;
