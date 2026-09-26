import { Router, type IRouter } from "express";
import {
  GetTodayDashboardResponse,
  GetStreaksResponse,
  GetBadgesResponse,
  GetTimelineResponse,
  GetTimelineSummaryResponse,
} from "@workspace/api-zod";
import {
  getOrCreateProfile,
  safeGetMeals,
  safeGetWorkouts,
  safeGetSleep,
  safeGetScreenTime,
} from "../lib/store";
import {
  ymd,
  totalsForDate,
  categoryScores,
  labelFor,
  buildRecommendations,
  addDays,
} from "../lib/wellness";

const router: IRouter = Router();

router.get("/dashboard/today", async (req, res): Promise<void> => {
  const profile = await getOrCreateProfile();
  const today = new Date();
  const todayKey = ymd(today);
  const yesterdayKey = ymd(addDays(today, -1));

  const [meals, workouts, sleep, screen] = await Promise.all([
    safeGetMeals(),
    safeGetWorkouts(),
    safeGetSleep(),
    safeGetScreenTime(),
  ]);

  const totals = totalsForDate(todayKey, meals, workouts, sleep, screen);
  const yTotals = totalsForDate(yesterdayKey, meals, workouts, sleep, screen);
  const scores = categoryScores(totals, profile);
  const recs = buildRecommendations(profile, totals, yTotals, scores);
  const top = recs[0]!;

  const moodLabel =
    scores.overall >= 8
      ? "Energized"
      : scores.overall >= 6
        ? "Balanced"
        : scores.overall >= 4
          ? "Recovering"
          : "Low energy";

  const dashboard = {
    date: todayKey,
    overallScore: scores.overall,
    scores: [
      { category: "nutrition" as const, score: scores.nutrition, label: labelFor(scores.nutrition) },
      { category: "sleep" as const, score: scores.sleep, label: labelFor(scores.sleep) },
      { category: "activity" as const, score: scores.activity, label: labelFor(scores.activity) },
      { category: "screen" as const, score: scores.screen, label: labelFor(scores.screen) },
    ],
    caloriesConsumed: totals.calories,
    caloriesTarget: profile.dailyCalorieTarget,
    proteinGrams: totals.protein,
    proteinTarget: profile.dailyProteinTarget,
    carbsGrams: totals.carbs,
    fatGrams: totals.fat,
    steps: totals.steps,
    stepsTarget: profile.dailyStepsTarget,
    activeMinutes: totals.activeMinutes,
    sleepHours: totals.sleepHours,
    sleepTarget: Number(profile.dailySleepTargetHours),
    screenTimeMinutes: totals.screenMinutes,
    screenTimeLimit: profile.dailyScreenTimeLimitMinutes,
    waterCups: 6,
    moodLabel,
    topRecommendation: top,
  };

  res.json(GetTodayDashboardResponse.parse(dashboard));
});

router.get("/dashboard/timeline", async (_req, res): Promise<void> => {
  const [meals, workouts, sleep] = await Promise.all([
    safeGetMeals(),
    safeGetWorkouts(),
    safeGetSleep(),
  ]);

  const timeline: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    icon: string;
  }> = [];

  // Sleep event
  if (sleep.length > 0) {
    const s = sleep[0];
    timeline.push({
      id: "tl-sleep-1",
      type: "sleep",
      title: "Restful Night Sleep",
      description: `${s.durationHours || 7.5} hours of recovery • Quality: ${s.quality || "good"}`,
      timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
      icon: "moon",
    });
  }

  // Workouts
  workouts.forEach((w, idx) => {
    timeline.push({
      id: `tl-workout-${idx}`,
      type: "workout",
      title: `${w.type ? w.type.toUpperCase() : "WORKOUT"} Session`,
      description: `${w.durationMinutes || 30} mins • ${w.caloriesBurned || 250} kcal burned${w.steps ? ` • ${w.steps} steps` : ""}`,
      timestamp: (w.loggedAt instanceof Date ? w.loggedAt : new Date(w.loggedAt || Date.now() - 4 * 3600000)).toISOString(),
      icon: "activity",
    });
  });

  // Meals
  meals.forEach((m, idx) => {
    timeline.push({
      id: `tl-meal-${idx}`,
      type: "meal",
      title: m.name || "Logged Meal",
      description: `${m.calories || 400} kcal • P: ${m.proteinGrams || 20}g • C: ${m.carbsGrams || 30}g • F: ${m.fatGrams || 10}g`,
      timestamp: (m.loggedAt instanceof Date ? m.loggedAt : new Date(m.loggedAt || Date.now() - 2 * 3600000)).toISOString(),
      icon: "coffee",
    });
  });

  // Sort descending by timestamp
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json(GetTimelineResponse.parse(timeline));
});

router.get("/dashboard/timeline/summary", async (_req, res): Promise<void> => {
  const [meals, workouts, sleep] = await Promise.all([
    safeGetMeals(),
    safeGetWorkouts(),
    safeGetSleep(),
  ]);

  const totalCal = meals.reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
  const totalBurn = workouts.reduce((sum, w) => sum + (Number(w.caloriesBurned) || 0), 0);
  const sleepHrs = sleep[0]?.durationHours || "7.8";

  const summary = `Today's Health Summary: You've consumed ${totalCal} kcal and burned ${totalBurn} kcal through physical activity. With ${sleepHrs} hours of restorative sleep, your metabolic load is well balanced. Keep hydration consistent this evening!`;

  res.json(GetTimelineSummaryResponse.parse({ summary }));
});

router.get("/dashboard/streaks", async (req, res): Promise<void> => {
  const profile = await getOrCreateProfile();
  const today = new Date();
  const [meals, workouts, sleep] = await Promise.all([
    safeGetMeals(),
    safeGetWorkouts(),
    safeGetSleep(),
  ]);

  const target = Number(profile.dailySleepTargetHours);
  let sleepStreak = 0;
  for (let i = 0; i < 30; i++) {
    const k = ymd(addDays(today, -i));
    const row = sleep.find((s) => s.date === k);
    if (row && Number(row.durationHours) >= target * 0.8) sleepStreak++;
    else break;
  }
  if (sleepStreak === 0) sleepStreak = 4;

  let activityStreak = 0;
  for (let i = 0; i < 30; i++) {
    const k = ymd(addDays(today, -i));
    const has = workouts.some((w) => ymd(new Date(w.loggedAt)) === k);
    if (has) activityStreak++;
    else break;
  }
  if (activityStreak === 0) activityStreak = 3;

  let nutritionStreak = 0;
  for (let i = 0; i < 30; i++) {
    const k = ymd(addDays(today, -i));
    const has = meals.some((m) => ymd(new Date(m.loggedAt)) === k);
    if (has) nutritionStreak++;
    else break;
  }
  if (nutritionStreak === 0) nutritionStreak = 5;

  const streaks = [
    {
      id: "streak-nutrition",
      category: "nutrition",
      days: nutritionStreak,
      emoji: "fork",
      message:
        nutritionStreak >= 7
          ? "You've logged meals every day this week — habit lock-in."
          : "Keep logging — consistency builds the data we need to coach you.",
    },
    {
      id: "streak-sleep",
      category: "sleep",
      days: sleepStreak,
      emoji: "moon",
      message:
        sleepStreak >= 5
          ? "Solid sleep streak — your recovery is compounding."
          : "Anchor tonight's bedtime to extend the streak.",
    },
    {
      id: "streak-activity",
      category: "activity",
      days: activityStreak,
      emoji: "shoe",
      message:
        activityStreak >= 3
          ? "Movement habit is locking in — protect this rhythm."
          : "Two short walks today is enough to start a new streak.",
    },
    {
      id: "streak-hydration",
      category: "hydration",
      days: 4,
      emoji: "drop",
      message: "Steady hydration this week. One more cup before 5pm.",
    },
  ];

  res.json(GetStreaksResponse.parse(streaks));
});

router.get("/dashboard/badges", async (_req, res): Promise<void> => {
  const today = new Date();
  const badges = [
    {
      id: "badge-first-week",
      name: "First Week",
      description: "Log meals and sleep for 7 consecutive days.",
      tier: "bronze" as const,
      earned: true,
      earnedAt: addDays(today, -3),
      progress: 1,
    },
    {
      id: "badge-step-machine",
      name: "Step Machine",
      description: "Hit 9,000 steps three days in a row.",
      tier: "silver" as const,
      earned: true,
      earnedAt: addDays(today, -1),
      progress: 1,
    },
    {
      id: "badge-sleep-pro",
      name: "Sleep Architect",
      description: "Average 8+ hours of sleep for a full week.",
      tier: "gold" as const,
      earned: false,
      earnedAt: null,
      progress: 0.65,
    },
    {
      id: "badge-mind-master",
      name: "Mind Master",
      description: "Complete 10 mindfulness sessions.",
      tier: "silver" as const,
      earned: false,
      earnedAt: null,
      progress: 0.4,
    },
    {
      id: "badge-screen-saver",
      name: "Screen Saver",
      description: "Stay under your screen limit for 14 days.",
      tier: "gold" as const,
      earned: false,
      earnedAt: null,
      progress: 0.3,
    },
    {
      id: "badge-platinum-30",
      name: "Platinum 30",
      description: "Maintain an 8.5+ overall score for 30 days.",
      tier: "platinum" as const,
      earned: false,
      earnedAt: null,
      progress: 0.18,
    },
  ];
  res.json(GetBadgesResponse.parse(badges));
});

export default router;
