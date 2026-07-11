import { Router, type IRouter } from "express";
import {
  db,
  mealsTable,
  workoutsTable,
  sleepTable,
  screenTimeTable,
} from "@workspace/db";
import {
  GetTodayDashboardResponse,
  GetStreaksResponse,
  GetBadgesResponse,
} from "@workspace/api-zod";
import { getOrCreateProfile } from "../lib/store";
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
    db.select().from(mealsTable),
    db.select().from(workoutsTable),
    db.select().from(sleepTable),
    db.select().from(screenTimeTable),
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

router.get("/dashboard/streaks", async (req, res): Promise<void> => {
  const profile = await getOrCreateProfile();
  const today = new Date();
  const [meals, workouts, sleep] = await Promise.all([
    db.select().from(mealsTable),
    db.select().from(workoutsTable),
    db.select().from(sleepTable),
  ]);

  // Sleep streak: consecutive days hitting 80% of target
  const target = Number(profile.dailySleepTargetHours);
  let sleepStreak = 0;
  for (let i = 0; i < 30; i++) {
    const k = ymd(addDays(today, -i));
    const row = sleep.find((s) => s.date === k);
    if (row && Number(row.durationHours) >= target * 0.8) sleepStreak++;
    else break;
  }
  // Activity streak: any workout that day
  let activityStreak = 0;
  for (let i = 0; i < 30; i++) {
    const k = ymd(addDays(today, -i));
    const has = workouts.some((w) => ymd(new Date(w.loggedAt)) === k);
    if (has) activityStreak++;
    else break;
  }
  // Nutrition streak: any logged meal
  let nutritionStreak = 0;
  for (let i = 0; i < 30; i++) {
    const k = ymd(addDays(today, -i));
    const has = meals.some((m) => ymd(new Date(m.loggedAt)) === k);
    if (has) nutritionStreak++;
    else break;
  }

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

router.get("/dashboard/badges", async (req, res): Promise<void> => {
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
