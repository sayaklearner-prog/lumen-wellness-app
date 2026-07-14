import { Router, type IRouter } from "express";
import {
  db,
  mealsTable,
  workoutsTable,
  sleepTable,
  screenTimeTable,
} from "@workspace/db";
import {
  GetAiRecommendationsResponse,
  GetAiInsightsResponse,
  AskAiCoachBody,
  AskAiCoachResponse,
} from "@workspace/api-zod";
import { getOrCreateProfile } from "../lib/store";
import {
  ymd,
  addDays,
  startOfWeek,
  totalsForDate,
  categoryScores,
  buildRecommendations,
  buildInsights,
  buildAiReply,
} from "../lib/wellness";


const router: IRouter = Router();

router.get("/ai/recommendations", async (req, res): Promise<void> => {
  const profile = await getOrCreateProfile();
  const today = new Date();
  const [meals, workouts, sleep, screen] = await Promise.all([
    db.select().from(mealsTable),
    db.select().from(workoutsTable),
    db.select().from(sleepTable),
    db.select().from(screenTimeTable),
  ]);

  const todayKey = ymd(today);
  const yesterdayKey = ymd(addDays(today, -1));
  const todayTotals = totalsForDate(todayKey, meals, workouts, sleep, screen);
  const yTotals = totalsForDate(yesterdayKey, meals, workouts, sleep, screen);
  const scores = categoryScores(todayTotals, profile);
  const recs = buildRecommendations(profile, todayTotals, yTotals, scores);
  res.json(GetAiRecommendationsResponse.parse(recs));
});

router.get("/ai/insights", async (req, res): Promise<void> => {
  const profile = await getOrCreateProfile();
  const today = new Date();
  const weekStart = startOfWeek(today);
  const prevWeekStart = addDays(weekStart, -7);

  const [meals, workouts, sleep, screen] = await Promise.all([
    db.select().from(mealsTable),
    db.select().from(workoutsTable),
    db.select().from(sleepTable),
    db.select().from(screenTimeTable),
  ]);

  type DayEntry = {
    date: string;
    totals: ReturnType<typeof totalsForDate>;
    scores: ReturnType<typeof categoryScores>;
  };
  const week: DayEntry[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const totals = totalsForDate(ymd(d), meals, workouts, sleep, screen);
    week.push({ date: ymd(d), totals, scores: categoryScores(totals, profile) });
  }
  const prev: DayEntry[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(prevWeekStart, i);
    const totals = totalsForDate(ymd(d), meals, workouts, sleep, screen);
    prev.push({ date: ymd(d), totals, scores: categoryScores(totals, profile) });
  }
  const prevAvg = (k: "nutrition" | "sleep" | "activity" | "screen") =>
    prev.reduce((acc, d) => acc + d.scores[k], 0) / 7;

  const insights = buildInsights(profile, week, {
    nutrition: prevAvg("nutrition"),
    sleep: prevAvg("sleep"),
    activity: prevAvg("activity"),
    screen: prevAvg("screen"),
  });

  res.json(GetAiInsightsResponse.parse(insights));
});

router.post("/ai/chat", async (req, res): Promise<void> => {
  const parsed = AskAiCoachBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profile = await getOrCreateProfile();
  const today = new Date();
  const todayKey = ymd(today);

  const [meals, workouts, sleep, screen] = await Promise.all([
    db.select().from(mealsTable),
    db.select().from(workoutsTable),
    db.select().from(sleepTable),
    db.select().from(screenTimeTable),
  ]);
  const totals = totalsForDate(todayKey, meals, workouts, sleep, screen);
  const scores = categoryScores(totals, profile);

  // Brief artificial delay so UX shows a "thinking" state.
  await new Promise((r) => setTimeout(r, 500));
  const reply = buildAiReply(profile, parsed.data.message, {
    today: totals,
    todayScores: scores,
  });
  req.log.info({ category: scores }, "AI chat reply generated");
  res.json(AskAiCoachResponse.parse(reply));
});

export default router;
