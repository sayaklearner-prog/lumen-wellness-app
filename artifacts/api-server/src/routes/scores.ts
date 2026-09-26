import { Router, type IRouter } from "express";
import {
  GetWeeklyScoresQueryParams,
  GetWeeklyScoresResponse,
  GetMonthlyScoresQueryParams,
  GetMonthlyScoresResponse,
  GetScoreTrendQueryParams,
  GetScoreTrendResponse,
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
  addDays,
  startOfWeek,
  totalsForDate,
  categoryScores,
  labelFor,
  weekdayName,
} from "../lib/wellness";

const router: IRouter = Router();

const round1 = (n: number) => Math.round(n * 10) / 10;

router.get("/scores/weekly", async (req, res): Promise<void> => {
  const parsed = GetWeeklyScoresQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profile = await getOrCreateProfile();

  const weekStart = parsed.data.weekStart
    ? new Date(parsed.data.weekStart)
    : startOfWeek(new Date());

  const [meals, workouts, sleep, screen] = await Promise.all([
    safeGetMeals(),
    safeGetWorkouts(),
    safeGetSleep(),
    safeGetScreenTime(),
  ]);

  const days = [];
  const sums = { nutrition: 0, sleep: 0, activity: 0, screen: 0, overall: 0 };
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const key = ymd(date);
    const totals = totalsForDate(key, meals, workouts, sleep, screen);
    const s = categoryScores(totals, profile);
    days.push({
      date: key,
      weekday: weekdayName(date),
      nutrition: s.nutrition,
      sleep: s.sleep,
      activity: s.activity,
      screen: s.screen,
      overall: s.overall,
    });
    sums.nutrition += s.nutrition;
    sums.sleep += s.sleep;
    sums.activity += s.activity;
    sums.screen += s.screen;
    sums.overall += s.overall;
  }

  const averages = [
    { category: "nutrition" as const, score: round1(sums.nutrition / 7), label: labelFor(sums.nutrition / 7) },
    { category: "sleep" as const, score: round1(sums.sleep / 7), label: labelFor(sums.sleep / 7) },
    { category: "activity" as const, score: round1(sums.activity / 7), label: labelFor(sums.activity / 7) },
    { category: "screen" as const, score: round1(sums.screen / 7), label: labelFor(sums.screen / 7) },
  ];
  const sorted = [...averages].sort((a, b) => b.score - a.score);
  const best = sorted[0]!.category;
  const worst = sorted[sorted.length - 1]!.category;
  const overallAvg = round1(sums.overall / 7);

  const narrative =
    overallAvg >= 8
      ? `A standout week across the board. Your ${best} was consistently high.`
      : overallAvg >= 6
        ? `A solid, balanced week. Focus on ${worst} to unlock the next level.`
        : `Recovery and routine were challenged this week. Prioritize sleep first.`;

  res.json(
    GetWeeklyScoresResponse.parse({
      weekStart: ymd(weekStart),
      days,
      averages,
      overallAverage: overallAvg,
      bestCategory: best,
      worstCategory: worst,
      narrative,
    }),
  );
});

router.get("/scores/monthly", async (req, res): Promise<void> => {
  const parsed = GetMonthlyScoresQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profile = await getOrCreateProfile();

  const now = new Date();
  const monthStr =
    parsed.data.month ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yearStr, monthIdxStr] = monthStr.split("-");
  const year = Number(yearStr);
  const monthIdx = Number(monthIdxStr) - 1;
  const firstOfMonth = new Date(year, monthIdx, 1);

  const [meals, workouts, sleep, screen] = await Promise.all([
    safeGetMeals(),
    safeGetWorkouts(),
    safeGetSleep(),
    safeGetScreenTime(),
  ]);

  const weeks = [];
  const overallSums = { nutrition: 0, sleep: 0, activity: 0, screen: 0, overall: 0 };
  for (let w = 0; w < 4; w++) {
    const weekStart = startOfWeek(addDays(firstOfMonth, w * 7));
    const sums = { nutrition: 0, sleep: 0, activity: 0, screen: 0, overall: 0 };
    for (let i = 0; i < 7; i++) {
      const date = addDays(weekStart, i);
      const totals = totalsForDate(ymd(date), meals, workouts, sleep, screen);
      const s = categoryScores(totals, profile);
      sums.nutrition += s.nutrition;
      sums.sleep += s.sleep;
      sums.activity += s.activity;
      sums.screen += s.screen;
      sums.overall += s.overall;
    }
    weeks.push({
      weekLabel: `Week ${w + 1}`,
      weekStart: ymd(weekStart),
      nutrition: round1(sums.nutrition / 7),
      sleep: round1(sums.sleep / 7),
      activity: round1(sums.activity / 7),
      screen: round1(sums.screen / 7),
      overall: round1(sums.overall / 7),
    });
    overallSums.nutrition += sums.nutrition / 7;
    overallSums.sleep += sums.sleep / 7;
    overallSums.activity += sums.activity / 7;
    overallSums.screen += sums.screen / 7;
    overallSums.overall += sums.overall / 7;
  }
  const averages = [
    { category: "nutrition" as const, score: round1(overallSums.nutrition / 4), label: labelFor(overallSums.nutrition / 4) },
    { category: "sleep" as const, score: round1(overallSums.sleep / 4), label: labelFor(overallSums.sleep / 4) },
    { category: "activity" as const, score: round1(overallSums.activity / 4), label: labelFor(overallSums.activity / 4) },
    { category: "screen" as const, score: round1(overallSums.screen / 4), label: labelFor(overallSums.screen / 4) },
  ];
  const overallAvg = round1(overallSums.overall / 4);
  const narrative =
    overallAvg >= 8
      ? `Outstanding month — you maintained an ${overallAvg} average. The pattern matters more than any single peak.`
      : overallAvg >= 6
        ? `A steady month at ${overallAvg}/10. Pick the lowest-scoring pillar and target it next month.`
        : `A rebuilding month (${overallAvg}/10). Anchor sleep first, the rest follows.`;

  res.json(
    GetMonthlyScoresResponse.parse({
      month: monthStr,
      weeks,
      averages,
      overallAverage: overallAvg,
      narrative,
    }),
  );
});

router.get("/scores/trend", async (req, res): Promise<void> => {
  const parsed = GetScoreTrendQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const profile = await getOrCreateProfile();
  const days = parsed.data.range === "week" ? 7 : parsed.data.range === "month" ? 30 : 90;

  const [meals, workouts, sleep, screen] = await Promise.all([
    safeGetMeals(),
    safeGetWorkouts(),
    safeGetSleep(),
    safeGetScreenTime(),
  ]);

  const today = new Date();
  const items = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const key = ymd(date);
    const totals = totalsForDate(key, meals, workouts, sleep, screen);
    const s = categoryScores(totals, profile);
    items.push({
      label:
        parsed.data.range === "week"
          ? weekdayName(date)
          : `${date.getMonth() + 1}/${date.getDate()}`,
      date: key,
      nutrition: s.nutrition,
      sleep: s.sleep,
      activity: s.activity,
      screen: s.screen,
      overall: s.overall,
    });
  }
  res.json(GetScoreTrendResponse.parse(items));
});

export default router;
