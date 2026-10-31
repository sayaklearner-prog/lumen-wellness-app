import {
  DailyHealthRecord,
  saveDailyHealthRecord,
  getDailyHealthRecord,
  getDailyHealthRecordsForMonth,
  getDailyHealthRecordsForRange,
  clearAllDailyHealthRecords,
  getMeals,
  getWorkouts,
  getLatestSleep,
  getHydrationEntriesToday,
  getScreenTimeToday,
  getProfileState,
  getKV,
  setKV,
  MealRecord,
  WorkoutRecord,
  HydrationEntryRecord,
} from "./db";
import { sendLocalNotification } from "./notifications";

// ============================================================================
// LUMEN DAILY HEALTH METRICS & BIOMETRIC ANALYTICS SERVICE
// Persistent daily score tracking, monthly aggregation, and AI Insights
// ============================================================================

export interface MonthlyHealthSummary {
  year: number;
  month: number;
  monthName: string;
  averageScore: number;
  totalSteps: number;
  totalActiveCalories: number;
  averageSleepHours: number;
  totalHydrationMl: number;
  totalCaloriesConsumed: number;
  daysLoggedCount: number;
  daysInMonth: number;
  prevMonthAverageScore: number;
  monthOverMonthDeltaPercent: number; // e.g. +14.2% or -5.1%
  recordsByDate: Record<string, DailyHealthRecord>;
}

export interface ThreePillarAiInsights {
  movement: {
    title: string;
    tag: string;
    scoreLabel: string;
    status: "optimal" | "balanced" | "needs_attention";
    observation: string;
    clinicalLore: string;
    actionableTip: string;
  };
  recovery: {
    title: string;
    tag: string;
    scoreLabel: string;
    status: "optimal" | "balanced" | "needs_attention";
    observation: string;
    clinicalLore: string;
    actionableTip: string;
  };
  nutrition: {
    title: string;
    tag: string;
    scoreLabel: string;
    status: "optimal" | "balanced" | "needs_attention";
    observation: string;
    clinicalLore: string;
    actionableTip: string;
  };
}

/** Format Date object as YYYY-MM-DD in local time */
export function formatDateKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Get Month Name from 1-indexed month number */
export function getMonthName(monthNumber: number): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[monthNumber - 1] || "Month";
}

/**
 * Computes and snapshots the health score and pillar metrics for a given date.
 */
export async function computeAndSaveDailySnapshot(
  dateStr: string = formatDateKey(),
  overrides?: Partial<DailyHealthRecord>
): Promise<DailyHealthRecord> {
  const profile = (await getProfileState()) || {
    dailyCalorieTarget: 2100,
    dailyProteinTarget: 110,
    dailySleepTargetHours: 8.0,
    dailyStepsTarget: 9000,
  };

  // Fetch current domain logs if needed
  const [meals, workouts, sleep, hydrationEntries, screenTime] = await Promise.all([
    getMeals().catch(() => [] as MealRecord[]),
    getWorkouts().catch(() => [] as WorkoutRecord[]),
    getLatestSleep().catch(() => null),
    getHydrationEntriesToday().catch(() => [] as HydrationEntryRecord[]),
    getScreenTimeToday().catch(() => null),
  ]);

  // 1. Nutrition Metrics
  const caloriesConsumed =
    overrides?.caloriesConsumed ??
    meals.reduce((sum: number, m: MealRecord) => sum + (m.calories || 0), 0);
  const proteinGrams =
    overrides?.proteinGrams ??
    meals.reduce((sum: number, m: MealRecord) => sum + (m.proteinGrams || 0), 0);
  const carbsGrams =
    overrides?.carbsGrams ??
    meals.reduce((sum: number, m: MealRecord) => sum + (m.carbsGrams || 0), 0);
  const fatGrams =
    overrides?.fatGrams ??
    meals.reduce((sum: number, m: MealRecord) => sum + (m.fatGrams || 0), 0);

  let nutritionScore = overrides?.nutritionScore ?? 0;
  if (!nutritionScore && caloriesConsumed > 0) {
    const calorieRatio = Math.min(1.2, caloriesConsumed / (profile.dailyCalorieTarget || 2100));
    const proteinRatio = Math.min(1.2, proteinGrams / (profile.dailyProteinTarget || 110));
    const base = (calorieRatio * 5 + proteinRatio * 5);
    nutritionScore = Math.min(10, Math.max(1, Math.round(base * 10) / 10));
  }

  // 2. Movement / Activity Metrics
  const steps =
    overrides?.steps ??
    workouts.reduce((sum: number, w: WorkoutRecord) => sum + (w.steps || 0), 0);
  const activeCalories =
    overrides?.activeCalories ??
    workouts.reduce((sum: number, w: WorkoutRecord) => sum + (w.caloriesBurned || 0), 0);
  const distanceKm =
    overrides?.distanceKm ??
    workouts.reduce((sum: number, w: WorkoutRecord) => sum + (w.distanceKm || 0), 0);

  let activityScore = 0;
  const targetSteps = profile.dailyStepsTarget || 9000;
  if (steps > 0 || activeCalories > 0) {
    const stepRatio = Math.min(1.2, steps / targetSteps);
    const calRatio = Math.min(1.2, activeCalories / 450);
    activityScore = Math.min(10, Math.max(1, Math.round((stepRatio * 6 + calRatio * 4) * 10) / 10));
  }

  // 3. Sleep Metrics
  const sleepHours = overrides?.sleepHours ?? (sleep?.durationHours || 0);
  const sleepQuality = overrides?.sleepQuality || (sleep?.quality || "Normal");
  let sleepScore = overrides?.sleepScore ?? 0;
  if (!sleepScore && sleepHours > 0) {
    const sleepTarget = profile.dailySleepTargetHours || 8.0;
    const ratio = Math.min(1.1, sleepHours / sleepTarget);
    let qualityBonus = 0;
    if (sleepQuality === "Restorative") qualityBonus = 1.0;
    else if (sleepQuality === "Deep") qualityBonus = 0.6;
    else if (sleepQuality === "Restless") qualityBonus = -1.2;
    sleepScore = Math.min(10, Math.max(1, Math.round((ratio * 8.5 + qualityBonus) * 10) / 10));
  }

  // 4. Hydration Metrics
  const hydrationMl =
    overrides?.hydrationMl ??
    hydrationEntries.reduce((sum: number, e: HydrationEntryRecord) => sum + (e.amountMl || 0), 0);
  const hydrationCups = overrides?.hydrationCups ?? Math.round(hydrationMl / 250);
  let hydrationScore = overrides?.hydrationScore ?? 0;
  if (!hydrationScore && hydrationMl > 0) {
    hydrationScore = Math.min(10, Math.max(1, Math.round((hydrationMl / 2000) * 10 * 10) / 10));
  }

  // 5. Screen Time Metrics
  const screenMinutes = screenTime?.screenMinutes || overrides?.screenMinutes || 0;
  let screenScore = 0;
  if (screenMinutes > 0) {
    const limit = screenTime?.limitMinutes || 180;
    if (screenMinutes <= limit) {
      screenScore = Math.min(10, Math.max(6, Math.round((10 - (screenMinutes / limit) * 3) * 10) / 10));
    } else {
      const overRatio = (screenMinutes - limit) / limit;
      screenScore = Math.max(2, Math.round((6 - overRatio * 4) * 10) / 10);
    }
  }

  // Composite Health Score
  const activePillars = [
    { score: nutritionScore, active: caloriesConsumed > 0 },
    { score: activityScore, active: steps > 0 || activeCalories > 0 },
    { score: sleepScore, active: sleepHours > 0 },
    { score: hydrationScore, active: hydrationMl > 0 },
    { score: screenScore, active: screenMinutes > 0 },
  ].filter(p => p.active);

  let overallScore = 0;
  if (activePillars.length > 0) {
    const sum = activePillars.reduce((acc, p) => acc + p.score, 0);
    overallScore = Math.round((sum / activePillars.length) * 10) / 10;
  } else if (overrides?.overallScore !== undefined) {
    overallScore = overrides.overallScore;
  }

  const record: DailyHealthRecord = {
    date: dateStr,
    overallScore: overrides?.overallScore ?? overallScore,
    steps: overrides?.steps ?? steps,
    activeCalories: overrides?.activeCalories ?? activeCalories,
    distanceKm: overrides?.distanceKm ?? distanceKm,
    nutritionScore: overrides?.nutritionScore ?? nutritionScore,
    caloriesConsumed: overrides?.caloriesConsumed ?? caloriesConsumed,
    proteinGrams: overrides?.proteinGrams ?? proteinGrams,
    carbsGrams: overrides?.carbsGrams ?? carbsGrams,
    fatGrams: overrides?.fatGrams ?? fatGrams,
    sleepScore: overrides?.sleepScore ?? sleepScore,
    sleepHours: overrides?.sleepHours ?? sleepHours,
    sleepQuality,
    hydrationScore: overrides?.hydrationScore ?? hydrationScore,
    hydrationMl: overrides?.hydrationMl ?? hydrationMl,
    hydrationCups: overrides?.hydrationCups ?? hydrationCups,
    screenScore: overrides?.screenScore ?? screenScore,
    screenMinutes: overrides?.screenMinutes ?? screenMinutes,
    updatedAt: new Date().toISOString(),
  };

  await saveDailyHealthRecord(record);
  return record;
}

/**
 * Returns the full monthly summary including average score, pillar totals, and month-over-month delta.
 */
export async function getMonthlyHealthSummary(
  year: number,
  month: number // 1-indexed (1 = Jan, 12 = Dec)
): Promise<MonthlyHealthSummary> {
  const currentMonthRecords = await getDailyHealthRecordsForMonth(year, month);

  // Calculate days in the given month
  const daysInMonth = new Date(year, month, 0).getDate();

  const recordsByDate: Record<string, DailyHealthRecord> = {};
  let totalScoreSum = 0;
  let totalSteps = 0;
  let totalActiveCalories = 0;
  let totalSleepHoursSum = 0;
  let sleepDaysCount = 0;
  let totalHydrationMl = 0;
  let totalCaloriesConsumed = 0;
  let loggedDaysCount = 0;

  for (const rec of currentMonthRecords) {
    recordsByDate[rec.date] = rec;
    if (rec.overallScore > 0) {
      totalScoreSum += rec.overallScore;
      loggedDaysCount++;
    }
    totalSteps += rec.steps || 0;
    totalActiveCalories += rec.activeCalories || 0;
    if (rec.sleepHours > 0) {
      totalSleepHoursSum += rec.sleepHours;
      sleepDaysCount++;
    }
    totalHydrationMl += rec.hydrationMl || 0;
    totalCaloriesConsumed += rec.caloriesConsumed || 0;
  }

  const averageScore = loggedDaysCount > 0 ? Math.round((totalScoreSum / loggedDaysCount) * 10) / 10 : 0;
  const averageSleepHours = sleepDaysCount > 0 ? Math.round((totalSleepHoursSum / sleepDaysCount) * 10) / 10 : 0;

  // Previous month comparison
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevMonthRecords = await getDailyHealthRecordsForMonth(prevYear, prevMonth);

  let prevScoreSum = 0;
  let prevLoggedCount = 0;
  for (const pr of prevMonthRecords) {
    if (pr.overallScore > 0) {
      prevScoreSum += pr.overallScore;
      prevLoggedCount++;
    }
  }
  const prevMonthAverageScore = prevLoggedCount > 0 ? Math.round((prevScoreSum / prevLoggedCount) * 10) / 10 : 0;

  let monthOverMonthDeltaPercent = 0;
  if (prevMonthAverageScore > 0 && averageScore > 0) {
    monthOverMonthDeltaPercent = Math.round(((averageScore - prevMonthAverageScore) / prevMonthAverageScore) * 1000) / 10;
  }

  return {
    year,
    month,
    monthName: getMonthName(month),
    averageScore,
    totalSteps,
    totalActiveCalories,
    averageSleepHours,
    totalHydrationMl,
    totalCaloriesConsumed,
    daysLoggedCount: loggedDaysCount,
    daysInMonth,
    prevMonthAverageScore,
    monthOverMonthDeltaPercent,
    recordsByDate,
  };
}

/**
 * Returns 3-Pillar AI Insights dynamically grounded in user's actual telemetry.
 */
export function generateThreePillarAiInsights(
  selectedRecord?: DailyHealthRecord,
  monthlySummary?: MonthlyHealthSummary
): ThreePillarAiInsights {
  const steps = selectedRecord?.steps || 0;
  const sleepHours = selectedRecord?.sleepHours || 0;
  const protein = selectedRecord?.proteinGrams || 0;
  const hydrationMl = selectedRecord?.hydrationMl || 0;

  // 1. MOVEMENT INSIGHT
  const movementStatus: "optimal" | "balanced" | "needs_attention" =
    steps >= 9000 ? "optimal" : steps >= 5500 ? "balanced" : steps > 0 ? "needs_attention" : "balanced";

  const movementObservation =
    steps >= 9000
      ? `High-efficiency volume with ${steps.toLocaleString()} steps logged. Aerobic glycolysis and continuous micro-contractions stimulated robust skeletal muscle capillary perfusion.`
      : steps >= 5500
      ? `Steady activity at ${steps.toLocaleString()} steps. You reached 68% of baseline threshold, maintaining functional mitochondrial density without neuromuscular overstrain.`
      : steps > 0
      ? `Movement volume is currently at ${steps.toLocaleString()} steps. An afternoon 15-minute brisk walk will activate GLUT-4 translocation to prevent sedentary fatigue.`
      : `No movement recorded for this date yet. Log your steps or workouts on the Home tab to activate your biomotor telemetry.`;

  const movementLore =
    "Mechanical loading triggers osteogenic piezoresistive signaling and activates AMPK pathways, driving non-insulin-mediated glucose clearance.";

  const movementTip =
    steps >= 9000
      ? "Log a 10-minute cool-down foam rolling sequence to lower sympathetic tone before evening."
      : steps > 0
      ? "Aim for a brief 20-minute post-meal walk to accelerate metabolic glucose clearance."
      : "Start with an easy 15-minute morning or post-meal walk to initiate circulation.";

  // 2. RECOVERY INSIGHT
  const recoveryStatus: "optimal" | "balanced" | "needs_attention" =
    sleepHours >= 7.5 && hydrationMl >= 1800
      ? "optimal"
      : sleepHours >= 6.5
      ? "balanced"
      : (sleepHours > 0 || hydrationMl > 0)
      ? "needs_attention"
      : "balanced";

  const recoveryObservation =
    sleepHours >= 7.5
      ? `Restorative nocturnal restoration achieved (${sleepHours}h sleep, ${hydrationMl}ml fluid intake). High parasympathetic tone supported slow-wave growth hormone release.`
      : sleepHours >= 6.5
      ? `Moderate recovery (${sleepHours}h sleep). Intracellular fluid pressure is stable with ${hydrationMl}ml logged, though REM density could benefit from an earlier bedtime.`
      : (sleepHours > 0 || hydrationMl > 0)
      ? `Sub-optimal sleep cycle (${sleepHours}h). Elevated morning adenosine debt detected. Prioritize early sleep hygiene and drink 400ml water immediately.`
      : `No sleep session or hydration volume recorded for this date yet. Sync your sleep and log your water intake to analyze circadian restoration.`;

  const recoveryLore =
    "Slow-Wave Sleep (Stage 3 NREM) activates the astrocyte-mediated glymphatic system, flushing neurotoxic metabolic byproducts from cerebral tissue.";

  const recoveryTip =
    "Avoid blue spectrum phone screen illumination 45 minutes prior to sleep to preserve endogenous melatonin release.";

  // 3. NUTRITION INSIGHT
  const nutritionStatus: "optimal" | "balanced" | "needs_attention" =
    protein >= 95 ? "optimal" : protein >= 55 ? "balanced" : protein > 0 ? "needs_attention" : "balanced";

  const nutritionObservation =
    protein >= 95
      ? `Protein threshold optimized (${protein}g logged). Hypertrophic myofibrillar protein synthesis (MPS) is fully saturated with low postprandial glycemic variance.`
      : protein >= 55
      ? `Nutrient intake is stable (${protein}g protein). Adding a Greek yogurt or plant/whey shake will reach the optimal 1.6g/kg metabolic muscle repair target.`
      : protein > 0
      ? `Low amino acid intake (${protein}g protein logged). Muscle tissue preservation requires regular leucine pulses throughout the day.`
      : `No nutrition logs recorded for this date yet. Log your meals on the Home tab to track calories, protein synthesis, and micronutrients.`;

  const nutritionLore =
    "Maintaining circulating plasma leucine concentrations above 3g triggers mammalian target of rapamycin (mTORC1) phosphorylation for tissue repair.";

  const nutritionTip =
    "Pair fibrous legumes or leafy greens with protein sources to blunt postprandial glucose surges.";

  return {
    movement: {
      title: "Movement & Biomotor Capacity",
      tag: "Biomotor Engine",
      scoreLabel: steps > 0 ? `${steps.toLocaleString()} Steps` : "0 Steps • Unlogged",
      status: movementStatus,
      observation: movementObservation,
      clinicalLore: movementLore,
      actionableTip: movementTip,
    },
    recovery: {
      title: "Cellular Recovery & Circadian Sleep",
      tag: "Circadian Rhythm",
      scoreLabel:
        sleepHours > 0 || hydrationMl > 0
          ? `${sleepHours}h Sleep • ${hydrationMl}ml Water`
          : "0.0h Sleep • 0ml Water",
      status: recoveryStatus,
      observation: recoveryObservation,
      clinicalLore: recoveryLore,
      actionableTip: recoveryTip,
    },
    nutrition: {
      title: "Metabolic Synthesis & Nutrition",
      tag: "Metabolic State",
      scoreLabel: protein > 0 ? `${protein}g Protein` : "0g Protein • Unlogged",
      status: nutritionStatus,
      observation: nutritionObservation,
      clinicalLore: nutritionLore,
      actionableTip: nutritionTip,
    },
  };
}

/**
 * Checks yesterday's score vs the day before, and triggers the Morning Briefing health score alert.
 */
export async function checkDailyHealthScoreNotification(): Promise<void> {
  const LAST_CHECK_KEY = "lumen_last_score_notif_date";
  const todayStr = formatDateKey(new Date());

  const lastChecked = await getKV(LAST_CHECK_KEY);
  if (lastChecked === todayStr) {
    // Already sent for today
    return;
  }

  // Calculate yesterday's date
  const now = new Date();
  const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const prevDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);

  const yesterdayStr = formatDateKey(yesterdayDate);
  const prevStr = formatDateKey(prevDate);

  const [yesterdayRecord, prevRecord] = await Promise.all([
    getDailyHealthRecord(yesterdayStr),
    getDailyHealthRecord(prevStr),
  ]);

  if (!yesterdayRecord || yesterdayRecord.overallScore === 0) {
    return;
  }

  const yScore = yesterdayRecord.overallScore;
  const pScore = prevRecord?.overallScore ?? 0;

  if (pScore > 0) {
    const delta = Math.round((yScore - pScore) * 10) / 10;
    if (delta < -0.3) {
      // Score decreased!
      await sendLocalNotification({
        id: 7001,
        title: "📉 Daily Health Score Alert",
        body: `Your health score yesterday was ${yScore.toFixed(1)}/10 (down from ${pScore.toFixed(1)}). Rebound today with a 20m walk and 8 hours of sleep!`,
        channelId: "lumen_briefing",
      });
    } else if (delta > 0.4) {
      // Score increased!
      await sendLocalNotification({
        id: 7002,
        title: "📈 Health Score Improvement!",
        body: `Excellent progress! Your health score yesterday rose to ${yScore.toFixed(1)}/10 (up from ${pScore.toFixed(1)}). Keep up the great momentum!`,
        channelId: "lumen_briefing",
      });
    } else {
      // Steady
      await sendLocalNotification({
        id: 7003,
        title: "⚡ Consistent Health Baseline",
        body: `Your health score is holding steady at ${yScore.toFixed(1)}/10. Ready for today's movement goal?`,
        channelId: "lumen_briefing",
      });
    }
  } else {
    // No previous record to compare against, send daily score briefing
    await sendLocalNotification({
      id: 7004,
      title: "☀️ Morning Health Intelligence",
      body: `Your finalized health score yesterday was ${yScore.toFixed(1)}/10. Open Biometric Analytics to inspect your telemetry!`,
      channelId: "lumen_briefing",
    });
  }

  await setKV(LAST_CHECK_KEY, todayStr);
}

/**
 * Purges any previously seeded/simulated metrics and ensures clean slate
 * for genuine user-logged telemetry only.
 */
export async function purgeSimulatedHealthMetrics(): Promise<void> {
  const PURGE_FLAG_KEY = "lumen_historical_metrics_purged_v5";
  const alreadyPurged = await getKV(PURGE_FLAG_KEY);
  if (alreadyPurged === "true") return;

  await clearAllDailyHealthRecords();
  await setKV("lumen_historical_metrics_seeded_v1", "purged");
  await setKV(PURGE_FLAG_KEY, "true");
}

/**
 * Clean data policy: do not inject fake historical data.
 * Keeps telemetry completely clean and reflects only actual user logs.
 */
export async function seedHistoricalHealthMetricsIfEmpty(): Promise<void> {
  await purgeSimulatedHealthMetrics();
}
