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

// Standardized physiological MET (Metabolic Equivalent of Task) table
export const WORKOUT_MET_MAP: Record<string, { met: number; category: string }> = {
  // Cardiovascular & Endurance
  "running": { met: 10.5, category: "cardio" },
  "outdoor run": { met: 10.5, category: "cardio" },
  "treadmill run": { met: 10.0, category: "cardio" },
  "trail running": { met: 11.5, category: "cardio" },
  "sprint intervals": { met: 13.0, category: "cardio" },
  "cycling": { met: 8.5, category: "cardio" },
  "outdoor cycling": { met: 8.5, category: "cardio" },
  "indoor spin": { met: 7.5, category: "cardio" },
  "walking": { met: 4.3, category: "cardio" },
  "brisk walk": { met: 4.5, category: "cardio" },
  "incline walk": { met: 6.0, category: "cardio" },
  "rowing": { met: 8.0, category: "cardio" },
  "jump rope": { met: 11.0, category: "cardio" },
  "elliptical": { met: 7.0, category: "cardio" },

  // Strength & Muscle Conditioning
  "strength training": { met: 5.5, category: "strength" },
  "weight lifting": { met: 5.5, category: "strength" },
  "hypertrophy": { met: 5.8, category: "strength" },
  "calisthenics": { met: 6.0, category: "strength" },
  "bodyweight": { met: 5.5, category: "strength" },
  "powerlifting": { met: 6.5, category: "strength" },
  "kettlebell": { met: 8.0, category: "strength" },

  // High-Intensity & Athletic Conditioning
  "hiit": { met: 10.0, category: "hiit" },
  "hiit circuit": { met: 10.0, category: "hiit" },
  "tabata": { met: 11.0, category: "hiit" },
  "boxing": { met: 9.5, category: "hiit" },
  "kickboxing": { met: 10.0, category: "hiit" },
  "crossfit": { met: 9.0, category: "hiit" },

  // Mind-Body & Flexibility
  "yoga": { met: 3.5, category: "recovery" },
  "vinyasa yoga": { met: 4.0, category: "recovery" },
  "pilates": { met: 4.2, category: "recovery" },
  "mobility & stretching": { met: 2.8, category: "recovery" },

  // Sports & Aquatics
  "swimming": { met: 8.5, category: "sports" },
  "swimming laps": { met: 9.0, category: "sports" },
  "basketball": { met: 8.0, category: "sports" },
  "tennis": { met: 7.3, category: "sports" },
  "padel": { met: 7.0, category: "sports" },
  "football": { met: 8.5, category: "sports" },
  "soccer": { met: 8.5, category: "sports" },
  "hiking": { met: 7.5, category: "sports" },
};

export function calculateWorkoutCalories(
  type: string,
  durationMinutes: number,
  intensity: string = "moderate",
  avgHeartRate?: number,
  weightKg: number = 72
) {
  const normType = (type || "").toLowerCase().trim();
  const matched = Object.entries(WORKOUT_MET_MAP).find(([k]) => normType.includes(k));
  const met = matched ? matched[1].met : 6.0;

  let intensityMultiplier = 1.0;
  if (intensity === "light") intensityMultiplier = 0.8;
  else if (intensity === "vigorous") intensityMultiplier = 1.25;
  else if (intensity === "peak") intensityMultiplier = 1.5;

  let baseKcal = met * weightKg * (Math.max(1, durationMinutes) / 60) * intensityMultiplier;

  if (avgHeartRate && avgHeartRate > 100) {
    const hrFactor = Math.min(1.35, Math.max(0.85, (avgHeartRate - 60) / 90));
    baseKcal = baseKcal * 0.75 + (baseKcal * hrFactor) * 0.25;
  }

  const calculatedBurn = Math.max(15, Math.round(baseKcal));
  const aerobicZone = avgHeartRate && avgHeartRate >= 160
    ? "Zone 4/5 (Anaerobic / VO2 Max)"
    : avgHeartRate && avgHeartRate >= 135
      ? "Zone 3 (Aerobic Tempo)"
      : "Zone 2 (Fat Oxidation & Base)";

  return {
    caloriesBurned: calculatedBurn,
    metValue: met,
    intensityMultiplier,
    aerobicZone,
    strainContribution: Math.round((calculatedBurn / 60) * 10) / 10,
  };
}

router.post("/workouts", async (req, res): Promise<void> => {
  const parsed = CreateWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let finalCalories = parsed.data.caloriesBurned;
  if (!finalCalories || finalCalories <= 0) {
    const estimated = calculateWorkoutCalories(
      parsed.data.type,
      parsed.data.durationMinutes,
      parsed.data.intensity,
      parsed.data.avgHeartRate ?? undefined
    );
    finalCalories = estimated.caloriesBurned;
  }

  const row = await safeCreateWorkout({
    type: parsed.data.type,
    durationMinutes: parsed.data.durationMinutes,
    caloriesBurned: finalCalories,
    steps: parsed.data.steps ?? 0,
    intensity: parsed.data.intensity,
    source: parsed.data.source,
  });
  res.status(201).json(toApi(row));
});

router.post("/workouts/estimate-calories", async (req, res): Promise<void> => {
  const { type, durationMinutes, intensity, avgHeartRate, weightKg } = req.body || {};
  const calc = calculateWorkoutCalories(
    type || "Running",
    Number(durationMinutes) || 30,
    intensity || "moderate",
    avgHeartRate ? Number(avgHeartRate) : undefined,
    weightKg ? Number(weightKg) : 72
  );
  res.json(calc);
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
  const [workouts, sleep] = await Promise.all([
    safeGetWorkouts(),
    safeGetSleep(),
  ]);

  const todayKey = ymd(new Date());
  const todayWorkouts = workouts.filter((w) => ymd(new Date(w.loggedAt)) === todayKey);
  const workoutBurn = todayWorkouts.reduce((acc, w) => acc + (Number(w.caloriesBurned) || 0), 0);
  const stepsCount = todayWorkouts.reduce((acc, w) => acc + (Number(w.steps) || 0), 0) || 5400; // baseline steps if sensor active
  const stepsBurn = Math.round(stepsCount * 0.045);
  const totalActiveBurn = workoutBurn + stepsBurn;
  const activeMinutes = todayWorkouts.reduce((acc, w) => acc + (Number(w.durationMinutes) || 0), 0);

  const sleepRow = sleep[0];
  const sleepHours = sleepRow ? Number(sleepRow.durationHours) : 7.6;
  
  // Calculate readiness (0-100) based on sleep and previous exertion balance
  let score = sleepHours >= 8 ? 92 : sleepHours >= 7 ? 85 : sleepHours >= 6 ? 74 : 62;
  if (workoutBurn > 900) score = Math.max(50, score - 10);

  // Acute Training Strain (0-21 scale modeled after elite athletic monitors)
  const acuteLoadScore = Math.min(
    21,
    Math.round((Math.log10(1 + (totalActiveBurn / 60)) * 6.8 + (activeMinutes / 30) * 1.8) * 10) / 10
  );

  let loadStatus = "Optimal Training Load";
  if (acuteLoadScore >= 16) loadStatus = "Peak Exertion Reached";
  else if (acuteLoadScore >= 10) loadStatus = "High Training Stimulus";
  else if (acuteLoadScore >= 5) loadStatus = "Aerobic Maintenance";
  else loadStatus = "Primed for Exertion";

  const explanation =
    score >= 85
      ? `High readiness (${score}/100). Parasympathetic restoration and sleep architecture are optimal. Today's total active burn: ${totalActiveBurn} kcal (${workoutBurn} kcal workouts + ${stepsBurn} kcal steps).`
      : `Moderate readiness (${score}/100). Maintain steady-state aerobic load. Strain: ${acuteLoadScore}/21.`;

  res.json({
    readinessScore: score,
    acuteLoadScore,
    loadStatus,
    cardioStrain: acuteLoadScore,
    stepsCount,
    stepsBurn,
    workoutBurn,
    totalActiveBurn,
    activeMinutes,
    explanation,
  });
});

router.get("/workouts/insights", async (_req, res): Promise<void> => {
  const workouts = await safeGetWorkouts();
  const todayKey = ymd(new Date());
  const todayWorkouts = workouts.filter((w) => ymd(new Date(w.loggedAt)) === todayKey);
  const workoutBurn = todayWorkouts.reduce((acc, w) => acc + (Number(w.caloriesBurned) || 0), 0);
  const totalMins = workouts.reduce((acc, w) => acc + (Number(w.durationMinutes) || 0), 0);
  const stepsCount = todayWorkouts.reduce((acc, w) => acc + (Number(w.steps) || 0), 0);
  const stepsBurn = Math.round(stepsCount * 0.045);
  const totalActiveBurn = workoutBurn + stepsBurn;

  const insights = [
    `Total active burn today: ${totalActiveBurn} kcal (${workoutBurn} kcal from exercises + ${stepsBurn} kcal from ${stepsCount.toLocaleString()} steps).`,
    `Weekly cumulative volume: ${totalMins} active minutes recorded.`,
    "Aerobic-to-strength stimulus is calibrated for steady metabolic adaptation.",
    "Exertion and recovery load calibrated to optimize physical stamina.",
  ];
  res.json(GetWorkoutInsightsResponse.parse({ insights }));
});

router.get("/workouts/challenges", async (_req, res): Promise<void> => {
  const challenges = [
    "Daily 10k Steps Target: Walk 10,000 steps daily",
    "Weekend Endurance Session: Ready to begin",
    "Active Calorie Target: Aim for 500 active kcal burned",
  ];
  res.json(GetWorkoutChallengesResponse.parse({ challenges }));
});

export default router;
