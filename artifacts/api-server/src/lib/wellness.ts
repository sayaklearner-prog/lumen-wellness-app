import type {
  Meal,
  Workout,
  SleepRow,
  ScreenTimeRow,
  Profile,
} from "@workspace/db";

export type Mode =
  | "standard"
  | "diabetes"
  | "hypertension"
  | "heart_health"
  | "pregnancy"
  | "weight_loss";

export type Category = "nutrition" | "sleep" | "activity" | "screen";

export interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  steps: number;
  activeMinutes: number;
  sleepHours: number;
  sleepQuality: number;
  screenMinutes: number;
}

export function ymd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day + 6) % 7; // Monday-based week start
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function weekdayName(d: Date): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()] ?? "";
}

const QUALITY_MAP: Record<string, number> = {
  poor: 0.4,
  fair: 0.65,
  good: 0.85,
  excellent: 1.0,
};

export function totalsForDate(
  date: string,
  meals: Meal[],
  workouts: Workout[],
  sleep: SleepRow[],
  screen: ScreenTimeRow[],
): DayTotals {
  const dayMeals = meals.filter((m) => ymd(new Date(m.loggedAt)) === date);
  const dayWorkouts = workouts.filter(
    (w) => ymd(new Date(w.loggedAt)) === date,
  );
  const sleepRow = sleep.find((s) => s.date === date);
  const screenRow = screen.find((s) => s.date === date);

  const calories = dayMeals.reduce((acc, m) => acc + m.calories, 0);
  const protein = dayMeals.reduce((acc, m) => acc + m.proteinGrams, 0);
  const carbs = dayMeals.reduce((acc, m) => acc + m.carbsGrams, 0);
  const fat = dayMeals.reduce((acc, m) => acc + m.fatGrams, 0);
  const steps = dayWorkouts.reduce((acc, w) => acc + w.steps, 0);
  const activeMinutes = dayWorkouts.reduce(
    (acc, w) => acc + w.durationMinutes,
    0,
  );
  const sleepHours = sleepRow ? Number(sleepRow.durationHours) : 0;
  const sleepQuality = sleepRow ? (QUALITY_MAP[sleepRow.quality] ?? 0.7) : 0;
  const screenMinutes = screenRow ? screenRow.totalMinutes : 0;

  return {
    calories,
    protein,
    carbs,
    fat,
    steps,
    activeMinutes,
    sleepHours,
    sleepQuality,
    screenMinutes,
  };
}

const clamp = (n: number, min = 0, max = 10) =>
  Math.max(min, Math.min(max, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

export function categoryScores(totals: DayTotals, profile: Profile) {
  // Nutrition: composite of calorie-target proximity + protein adequacy + macro balance.
  const calTarget = profile.dailyCalorieTarget;
  const calRatio = totals.calories === 0 ? 0 : totals.calories / calTarget;
  // best when 0.85..1.05 of target
  const calScore =
    calRatio === 0
      ? 0
      : calRatio <= 1
        ? clamp(10 - Math.abs(1 - calRatio) * 12)
        : clamp(10 - (calRatio - 1) * 14);
  const proteinRatio = totals.protein / profile.dailyProteinTarget;
  const proteinScore = clamp(Math.min(proteinRatio, 1.2) * 9);
  // Diabetes: penalize high carb share heavily
  const totalGrams = totals.protein + totals.carbs + totals.fat;
  const carbShare = totalGrams === 0 ? 0 : totals.carbs / totalGrams;
  let macroScore = clamp(10 - Math.abs(carbShare - 0.45) * 18);
  if (profile.mode === "diabetes" && carbShare > 0.5) {
    macroScore -= (carbShare - 0.5) * 12;
  }
  if (profile.mode === "weight_loss" && calRatio > 1.05) {
    macroScore -= (calRatio - 1.05) * 10;
  }
  macroScore = clamp(macroScore);
  const nutrition =
    totals.calories === 0
      ? 0
      : round1((calScore * 0.45 + proteinScore * 0.35 + macroScore * 0.2));

  // Sleep: hours vs target, modulated by quality. Pregnancy/heart_health weight quality more.
  const sleepHoursTarget = Number(profile.dailySleepTargetHours);
  const sleepHourRatio =
    sleepHoursTarget === 0 ? 0 : totals.sleepHours / sleepHoursTarget;
  const hoursScore =
    totals.sleepHours === 0
      ? 0
      : sleepHourRatio <= 1
        ? clamp(sleepHourRatio * 10)
        : clamp(10 - (sleepHourRatio - 1) * 8);
  const qualityScore = totals.sleepQuality * 10;
  const sleepWeight =
    profile.mode === "pregnancy" || profile.mode === "heart_health"
      ? 0.55
      : 0.65;
  const sleep =
    totals.sleepHours === 0
      ? 0
      : round1(hoursScore * sleepWeight + qualityScore * (1 - sleepWeight));

  // Activity: steps + active minutes blended.
  const stepRatio = totals.steps / profile.dailyStepsTarget;
  const stepsScore = clamp(Math.min(stepRatio, 1.3) * 8);
  const minutesScore = clamp((totals.activeMinutes / 45) * 10);
  let activity = round1(stepsScore * 0.6 + minutesScore * 0.4);
  if (profile.mode === "heart_health" && totals.activeMinutes >= 30)
    activity = clamp(activity + 0.5);

  // Screen: under target = 10, scaling down past it.
  const limit = profile.dailyScreenTimeLimitMinutes;
  let screen: number;
  if (totals.screenMinutes === 0) {
    screen = 9;
  } else if (totals.screenMinutes <= limit) {
    screen = round1(10 - (totals.screenMinutes / limit) * 1.5);
  } else {
    screen = round1(clamp(8.5 - ((totals.screenMinutes - limit) / 60) * 2));
  }

  const overall = round1(
    (nutrition + sleep + activity + screen) / 4,
  );

  return { nutrition, sleep, activity, screen, overall };
}

export function labelFor(score: number): string {
  if (score >= 9) return "Outstanding";
  if (score >= 8) return "Excellent";
  if (score >= 7) return "Strong";
  if (score >= 6) return "Steady";
  if (score >= 4) return "Needs work";
  if (score > 0) return "Off-track";
  return "Not logged";
}

interface CategoryAdvice {
  title: string;
  body: string;
  modeNote?: string;
}

export function buildRecommendations(
  profile: Profile,
  today: DayTotals,
  yesterday: DayTotals,
  scores: { nutrition: number; sleep: number; activity: number; screen: number },
) {
  const recs: {
    id: string;
    category:
      | "nutrition"
      | "sleep"
      | "activity"
      | "screen"
      | "mindfulness"
      | "condition";
    title: string;
    body: string;
    priority: "low" | "medium" | "high";
    action: string | null;
    modeContext: string | null;
  }[] = [];

  const mode = profile.mode as Mode;
  const modeLabel: Record<Mode, string> = {
    standard: "your goals",
    diabetes: "your diabetes plan",
    hypertension: "your blood pressure goals",
    heart_health: "your heart health plan",
    pregnancy: "your pregnancy plan",
    weight_loss: "your weight goals",
  };

  // 1) Protein adjustment based on yesterday's intake
  const proteinShortYesterday = yesterday.protein < profile.dailyProteinTarget * 0.85;
  if (proteinShortYesterday) {
    const deficit = Math.max(
      0,
      Math.round(profile.dailyProteinTarget - yesterday.protein),
    );
    recs.push({
      id: "rec-protein-bump",
      category: "nutrition",
      title: `Bump protein by ${deficit}g today`,
      body: `Yesterday you came in ${deficit}g under your protein target. Add a Greek yogurt at breakfast and a palm-sized serving of fish or tofu at lunch to close the gap and protect lean mass.`,
      priority: "high",
      action: "Log a protein-rich meal",
      modeContext: mode === "weight_loss" ? "weight_loss" : null,
    });
  }

  // 2) Sleep
  const targetSleep = Number(profile.dailySleepTargetHours);
  if (yesterday.sleepHours > 0 && yesterday.sleepHours < targetSleep - 0.5) {
    const deficit = round1(targetSleep - yesterday.sleepHours);
    const advice: Record<Mode, CategoryAdvice> = {
      standard: {
        title: `Wind down ${deficit}h earlier tonight`,
        body: `You logged only ${round1(yesterday.sleepHours)}h. Aim for lights out by 10:30pm, and dim screens an hour before bed for deeper sleep.`,
      },
      diabetes: {
        title: `Protect tonight's sleep — glucose depends on it`,
        body: `Short sleep raises insulin resistance the next day. Try a fixed wind-down routine and avoid late-night carbs to keep morning glucose stable.`,
        modeNote: "diabetes",
      },
      hypertension: {
        title: `Earlier bedtime to support BP`,
        body: `Under-sleeping nudges blood pressure up. Move bedtime 30 minutes earlier and try a short breathing routine before lights out.`,
        modeNote: "hypertension",
      },
      heart_health: {
        title: `Restorative sleep window`,
        body: `Aim for ${targetSleep}h tonight. Quality sleep lowers resting heart rate and supports recovery.`,
        modeNote: "heart_health",
      },
      pregnancy: {
        title: `Prioritize ${targetSleep}h plus a nap if needed`,
        body: `Side-sleeping with a pillow between knees can ease back pressure. A short afternoon nap is fine.`,
        modeNote: "pregnancy",
      },
      weight_loss: {
        title: `Sleep is a fat-loss tool — protect it`,
        body: `Short sleep increases hunger hormones tomorrow. Lights out 30 minutes earlier helps cravings stay manageable.`,
        modeNote: "weight_loss",
      },
    };
    const a = advice[mode];
    recs.push({
      id: "rec-sleep",
      category: "sleep",
      title: a.title,
      body: a.body,
      priority: "high",
      action: "Set a wind-down reminder",
      modeContext: a.modeNote ?? null,
    });
  }

  // 3) Activity
  if (today.steps < profile.dailyStepsTarget * 0.4 && new Date().getHours() >= 14) {
    recs.push({
      id: "rec-activity-walk",
      category: "activity",
      title: `Take a 20-minute walk this afternoon`,
      body: `You're at ${today.steps.toLocaleString()} steps so far. A brisk afternoon loop will close most of the gap and lift your evening energy.`,
      priority: "medium",
      action: "Start motion tracker",
      modeContext: null,
    });
  } else if (scores.activity < 6) {
    recs.push({
      id: "rec-activity-stack",
      category: "activity",
      title: `Stack two short activity blocks today`,
      body: `Two 15-minute blocks (a walk after lunch + a mobility session before dinner) tend to land more reliably than a single long workout.`,
      priority: "medium",
      action: "Log a workout",
      modeContext: null,
    });
  }

  // 4) Screen time
  const limit = profile.dailyScreenTimeLimitMinutes;
  if (yesterday.screenMinutes > limit) {
    const over = yesterday.screenMinutes - limit;
    recs.push({
      id: "rec-screen-cut",
      category: "screen",
      title: `Trim screen time by ${over} minutes today`,
      body: `Yesterday you went ${over} minutes over your limit. Try parking your phone outside the bedroom and replacing 20 minutes of evening scrolling with a short stretch routine.`,
      priority: "medium",
      action: "Set a screen reminder",
      modeContext: null,
    });
  }

  // 5) Condition-specific nudges always present
  const conditionTip: Record<Mode, { title: string; body: string } | null> = {
    standard: {
      title: "Hydration baseline",
      body: "Sip 8 cups across the day — most people under-shoot mid-afternoon. Set a 3pm hydration cue.",
    },
    diabetes: {
      title: "Pair carbs with protein and fiber",
      body: "Adding a handful of nuts or hummus to a carb-heavy snack flattens the post-meal glucose spike.",
    },
    hypertension: {
      title: "Watch hidden sodium",
      body: "Bread, sauces, and deli meat sneak in fast. Check labels and aim under 2,000 mg today.",
    },
    heart_health: {
      title: "Two omega-3 servings this week",
      body: "Salmon, sardines, walnuts, or flaxseed — one today and one Thursday would put you on track.",
    },
    pregnancy: {
      title: "Folate + iron pairing",
      body: "Pair leafy greens with a vitamin-C source (peppers, citrus) to boost iron absorption.",
    },
    weight_loss: {
      title: "Front-load protein at breakfast",
      body: "30g protein at breakfast reduces snack cravings later in the day. Eggs, cottage cheese, or a protein smoothie work well.",
    },
  };
  const tip = conditionTip[mode];
  if (tip) {
    recs.push({
      id: `rec-mode-${mode}`,
      category: "condition",
      title: tip.title,
      body: tip.body,
      priority: "low",
      action: null,
      modeContext: mode === "standard" ? null : mode,
    });
  }

  // Mindfulness fallback
  if (recs.length < 3) {
    recs.push({
      id: "rec-mindfulness",
      category: "mindfulness",
      title: "Two minutes of box breathing",
      body: "Inhale 4, hold 4, exhale 4, hold 4 — repeat for two minutes. Resets the nervous system between meetings.",
      priority: "low",
      action: null,
      modeContext: null,
    });
  }

  // Sort by priority
  const order = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => order[a.priority] - order[b.priority]);
  return recs;
}

export function buildInsights(
  profile: Profile,
  weekTotals: { date: string; totals: DayTotals; scores: ReturnType<typeof categoryScores> }[],
  prevWeekAverages: { nutrition: number; sleep: number; activity: number; screen: number },
) {
  const insights: {
    id: string;
    title: string;
    body: string;
    category: "nutrition" | "sleep" | "activity" | "screen" | "overall";
    delta: number | null;
  }[] = [];

  const avg = (k: "nutrition" | "sleep" | "activity" | "screen") =>
    round1(
      weekTotals.reduce((acc, d) => acc + d.scores[k], 0) /
        Math.max(1, weekTotals.length),
    );

  const nutritionAvg = avg("nutrition");
  const sleepAvg = avg("sleep");
  const activityAvg = avg("activity");
  const screenAvg = avg("screen");

  const totalProtein = weekTotals.reduce((acc, d) => acc + d.totals.protein, 0);
  const proteinTarget = profile.dailyProteinTarget * weekTotals.length;
  const proteinPct = Math.round((totalProtein / Math.max(1, proteinTarget)) * 100);

  insights.push({
    id: "insight-protein",
    title: `Protein at ${proteinPct}% of weekly target`,
    body:
      proteinPct >= 95
        ? `Excellent week — protein consistently on target. Keep this pattern through the weekend.`
        : proteinPct >= 80
          ? `Close to target. Adding one extra protein-rich snack on lower days will get you over the line.`
          : `Tracking light. Aim for 25-35g protein at each main meal next week to build the habit.`,
    category: "nutrition",
    delta: round1((nutritionAvg - prevWeekAverages.nutrition) / 10),
  });

  const totalSleep = weekTotals.reduce((acc, d) => acc + d.totals.sleepHours, 0);
  const sleepAvgHours = round1(totalSleep / Math.max(1, weekTotals.length));
  insights.push({
    id: "insight-sleep",
    title: `Average ${sleepAvgHours}h of sleep`,
    body:
      sleepAvgHours >= Number(profile.dailySleepTargetHours)
        ? `You're hitting your sleep window — this is when recovery and mood compound.`
        : `You're averaging ${round1(Number(profile.dailySleepTargetHours) - sleepAvgHours)}h short of target. Earlier wind-downs on Sunday and Monday usually anchor the rest of the week.`,
    category: "sleep",
    delta: round1((sleepAvg - prevWeekAverages.sleep) / 10),
  });

  const totalSteps = weekTotals.reduce((acc, d) => acc + d.totals.steps, 0);
  insights.push({
    id: "insight-activity",
    title: `${totalSteps.toLocaleString()} steps this week`,
    body:
      activityAvg >= 7
        ? `Strong activity rhythm — you're consistent across days, which matters more than peak sessions.`
        : `Activity is uneven. Pick two days next week to anchor 30-min walks and the rest tend to follow.`,
    category: "activity",
    delta: round1((activityAvg - prevWeekAverages.activity) / 10),
  });

  const avgScreen = Math.round(
    weekTotals.reduce((acc, d) => acc + d.totals.screenMinutes, 0) /
      Math.max(1, weekTotals.length),
  );
  insights.push({
    id: "insight-screen",
    title: `Average ${avgScreen} min of screen time`,
    body:
      avgScreen <= profile.dailyScreenTimeLimitMinutes
        ? `Within your limit — consider where the most valuable minutes went and protect that time.`
        : `Over your daily limit. Try a phone-free first hour after waking and a 30-min screen pause before bed.`,
    category: "screen",
    delta: round1((screenAvg - prevWeekAverages.screen) / 10),
  });

  const overall = round1((nutritionAvg + sleepAvg + activityAvg + screenAvg) / 4);
  insights.push({
    id: "insight-overall",
    title: `Overall wellness score: ${overall}/10`,
    body:
      overall >= 8
        ? `You're in a strong rhythm. The next move is small refinements, not big swings.`
        : overall >= 6
          ? `Steady week with room to grow. Pick the lowest-scoring pillar and concentrate next week there.`
          : `A reset week. Anchor one habit (sleep is often the leverage point) and let the others rebuild.`,
    category: "overall",
    delta: null,
  });

  return insights;
}

export function buildAiReply(
  profile: Profile,
  message: string,
  context: {
    today: DayTotals;
    todayScores: ReturnType<typeof categoryScores>;
  },
) {
  const text = message.toLowerCase();
  const mode = profile.mode as Mode;
  const modeNote: Record<Mode, string> = {
    standard: "",
    diabetes: " For your diabetes plan, I'm watching glucose-friendly choices carefully.",
    hypertension: " I'm keeping an eye on sodium and BP-friendly habits for you.",
    heart_health: " Protecting cardiovascular load is the lens I'm using.",
    pregnancy: " I'm prioritizing pregnancy-safe choices and steady energy.",
    weight_loss: " I'm balancing satiety and calorie deficit so this stays sustainable.",
  };

  const today = context.today;
  const scores = context.todayScores;

  let reply = "";
  let suggestions: string[] = [];

  if (text.includes("protein") || text.includes("eat")) {
    const remaining = Math.max(
      0,
      profile.dailyProteinTarget - today.protein,
    );
    reply = `You've had ${today.protein}g of protein so far today (target ${profile.dailyProteinTarget}g). To close the remaining ${remaining}g, try a Greek yogurt + berries snack (20g) and grilled salmon at dinner (30g).${modeNote[mode]}`;
    suggestions = [
      "Log a protein-rich snack",
      "Show me high-protein dinner ideas",
      "How does protein affect my recovery?",
    ];
  } else if (text.includes("sleep") || text.includes("tired")) {
    reply = `Sleep is your highest-leverage lever right now. Last night was ${today.sleepHours}h. Move bedtime 30 minutes earlier tonight, dim lights by 9pm, and avoid screens 45 minutes before bed.${modeNote[mode]}`;
    suggestions = [
      "Set a wind-down reminder",
      "What's a good bedtime routine?",
      "Why does sleep matter for my goals?",
    ];
  } else if (
    text.includes("walk") ||
    text.includes("workout") ||
    text.includes("activity") ||
    text.includes("steps")
  ) {
    reply = `You're at ${today.steps.toLocaleString()} steps and ${today.activeMinutes} active minutes. A 20-minute brisk walk now would push your activity score from ${scores.activity} to roughly ${Math.min(10, round1(scores.activity + 1.4))}.${modeNote[mode]}`;
    suggestions = [
      "Start a sensor-tracked walk",
      "Suggest a 15-min strength session",
      "What's a smart weekly mix?",
    ];
  } else if (text.includes("screen") || text.includes("phone")) {
    reply = `You're at ${today.screenMinutes} minutes of screen time today (limit ${profile.dailyScreenTimeLimitMinutes}). A 30-minute phone-free window before bed will protect tomorrow's energy and your sleep score.${modeNote[mode]}`;
    suggestions = [
      "Schedule a screen-free hour",
      "Show me apps eating my time",
      "Why is screen time tied to mood?",
    ];
  } else if (text.includes("score") || text.includes("today")) {
    reply = `Today's overall score is ${scores.overall}/10. Strongest pillar: ${strongestCategory(scores)}. Weakest: ${weakestCategory(scores)} — that's where one focused action gives you the biggest jump.${modeNote[mode]}`;
    suggestions = [
      "What should I do about my weakest pillar?",
      "Show me this week's trend",
      "Generate today's plan",
    ];
  } else if (text.includes("diabetes") || text.includes("glucose") || text.includes("blood sugar")) {
    reply = `For glucose stability today: pair every carb with protein or fiber, walk 10 minutes after each meal, and front-load carbs earlier in the day. Avoid eating within 2 hours of bedtime.`;
    suggestions = [
      "Suggest a low-glycemic dinner",
      "Why do post-meal walks help?",
      "What's a safe snack at night?",
    ];
  } else {
    reply = `Here's the read on your day: nutrition ${scores.nutrition}/10, sleep ${scores.sleep}/10, activity ${scores.activity}/10, screen ${scores.screen}/10. Tell me what you want to improve and I'll give you the exact next move.${modeNote[mode]}`;
    suggestions = [
      "How do I hit my protein today?",
      "How can I sleep better tonight?",
      "What's the smartest activity right now?",
    ];
  }

  return { message: reply, suggestions };
}

function strongestCategory(s: { nutrition: number; sleep: number; activity: number; screen: number }) {
  const entries = Object.entries(s) as [string, number][];
  return entries.sort((a, b) => b[1] - a[1])[0]?.[0] ?? "nutrition";
}
function weakestCategory(s: { nutrition: number; sleep: number; activity: number; screen: number }) {
  const entries = Object.entries(s) as [string, number][];
  return entries.sort((a, b) => a[1] - b[1])[0]?.[0] ?? "screen";
}

export function mockRecognizeFood(hint: string | null | undefined) {
  // A small rotating catalog so repeated demo captures feel varied.
  const catalog: {
    name: string;
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
    items: { name: string; quantity: string; calories: number; proteinGrams: number; carbsGrams: number; fatGrams: number; confidence: number }[];
  }[] = [
    {
      name: "Grilled chicken bowl",
      mealType: "lunch",
      items: [
        { name: "Grilled chicken breast", quantity: "150 g", calories: 230, proteinGrams: 38, carbsGrams: 0, fatGrams: 7, confidence: 0.92 },
        { name: "Brown rice", quantity: "1 cup", calories: 215, proteinGrams: 5, carbsGrams: 45, fatGrams: 2, confidence: 0.88 },
        { name: "Broccoli", quantity: "1 cup", calories: 55, proteinGrams: 4, carbsGrams: 11, fatGrams: 1, confidence: 0.83 },
        { name: "Olive oil drizzle", quantity: "1 tbsp", calories: 120, proteinGrams: 0, carbsGrams: 0, fatGrams: 14, confidence: 0.71 },
      ],
    },
    {
      name: "Greek yogurt parfait",
      mealType: "breakfast",
      items: [
        { name: "Greek yogurt (2%)", quantity: "1 cup", calories: 150, proteinGrams: 20, carbsGrams: 9, fatGrams: 4, confidence: 0.94 },
        { name: "Mixed berries", quantity: "1 cup", calories: 70, proteinGrams: 1, carbsGrams: 17, fatGrams: 0, confidence: 0.9 },
        { name: "Granola", quantity: "1/4 cup", calories: 130, proteinGrams: 3, carbsGrams: 18, fatGrams: 5, confidence: 0.82 },
        { name: "Honey", quantity: "1 tsp", calories: 20, proteinGrams: 0, carbsGrams: 6, fatGrams: 0, confidence: 0.66 },
      ],
    },
    {
      name: "Salmon dinner plate",
      mealType: "dinner",
      items: [
        { name: "Atlantic salmon, baked", quantity: "180 g", calories: 360, proteinGrams: 36, carbsGrams: 0, fatGrams: 22, confidence: 0.91 },
        { name: "Quinoa", quantity: "3/4 cup", calories: 170, proteinGrams: 6, carbsGrams: 30, fatGrams: 3, confidence: 0.84 },
        { name: "Roasted asparagus", quantity: "1 cup", calories: 40, proteinGrams: 4, carbsGrams: 7, fatGrams: 0, confidence: 0.86 },
      ],
    },
    {
      name: "Avocado toast & egg",
      mealType: "breakfast",
      items: [
        { name: "Whole-grain toast", quantity: "2 slices", calories: 180, proteinGrams: 8, carbsGrams: 30, fatGrams: 3, confidence: 0.9 },
        { name: "Avocado", quantity: "1/2", calories: 160, proteinGrams: 2, carbsGrams: 9, fatGrams: 15, confidence: 0.93 },
        { name: "Egg, fried", quantity: "1", calories: 90, proteinGrams: 6, carbsGrams: 0, fatGrams: 7, confidence: 0.88 },
      ],
    },
    {
      name: "Mixed snack plate",
      mealType: "snack",
      items: [
        { name: "Almonds", quantity: "1 oz", calories: 165, proteinGrams: 6, carbsGrams: 6, fatGrams: 14, confidence: 0.89 },
        { name: "Apple", quantity: "1 medium", calories: 95, proteinGrams: 0, carbsGrams: 25, fatGrams: 0, confidence: 0.92 },
        { name: "Cheddar cubes", quantity: "1 oz", calories: 110, proteinGrams: 7, carbsGrams: 1, fatGrams: 9, confidence: 0.78 },
      ],
    },
  ];

  // Choose by hint or rotate by hour
  const hourSeed = new Date().getHours() + new Date().getMinutes();
  let idx = hourSeed % catalog.length;
  if (hint) {
    const h = hint.toLowerCase();
    const hinted = catalog.findIndex((c) => h.includes(c.mealType));
    if (hinted >= 0) idx = hinted;
  }
  const pick = catalog[idx]!;

  const totals = pick.items.reduce(
    (acc, it) => ({
      calories: acc.calories + it.calories,
      proteinGrams: acc.proteinGrams + it.proteinGrams,
      carbsGrams: acc.carbsGrams + it.carbsGrams,
      fatGrams: acc.fatGrams + it.fatGrams,
    }),
    { calories: 0, proteinGrams: 0, carbsGrams: 0, fatGrams: 0 },
  );

  const avgConfidence =
    pick.items.reduce((acc, it) => acc + it.confidence, 0) / pick.items.length;

  return {
    name: pick.name,
    confidence: Math.round(avgConfidence * 100) / 100,
    mealType: pick.mealType,
    calories: totals.calories,
    proteinGrams: totals.proteinGrams,
    carbsGrams: totals.carbsGrams,
    fatGrams: totals.fatGrams,
    items: pick.items,
    notes:
      "I'm fairly confident in the items above. Edit any value before saving — quantities are the most common thing to adjust.",
  };
}

export function buildWeeklyPlan(profile: Profile, weekStart: Date) {
  const mode = profile.mode as Mode;
  const themes: Record<Mode, string> = {
    standard: "Build steady rhythm across all four pillars",
    diabetes: "Glucose-stable habits, post-meal walks, fiber-first plates",
    hypertension: "Lower sodium, more potassium, calmer evenings",
    heart_health: "Cardio base + omega-3 nutrition + restorative sleep",
    pregnancy: "Steady energy, nutrient density, gentle movement",
    weight_loss: "High-protein meals, daily movement, sustainable deficit",
  };

  const dailyFocus = [
    { focus: "Foundation day", actions: focusActions(mode, "foundation") },
    { focus: "Protein push", actions: focusActions(mode, "protein") },
    { focus: "Active recovery", actions: focusActions(mode, "recovery") },
    { focus: "Strength + steps", actions: focusActions(mode, "strength") },
    { focus: "Mind & screen reset", actions: focusActions(mode, "mind") },
    { focus: "Long walk + cook day", actions: focusActions(mode, "long") },
    { focus: "Reflect & plan", actions: focusActions(mode, "reflect") },
  ];

  const days = dailyFocus.map((d, i) => {
    const date = addDays(weekStart, i);
    return {
      date: ymd(date),
      weekday: weekdayName(date),
      focus: d.focus,
      actions: d.actions,
    };
  });

  return {
    weekStart: ymd(weekStart),
    weekEnd: ymd(addDays(weekStart, 6)),
    modeContext: mode,
    theme: themes[mode],
    days,
  };
}

function focusActions(mode: Mode, focus: string) {
  const base: Record<string, { category: any; title: string; detail: string; targetValue: string | null }[]> = {
    foundation: [
      { category: "sleep", title: "Lights out by 10:30", detail: "Anchor sleep for the rest of the week.", targetValue: "8h" },
      { category: "nutrition", title: "Front-load protein", detail: "30g protein at breakfast.", targetValue: "30g" },
      { category: "activity", title: "Morning 15-min walk", detail: "Sets circadian tone and energy.", targetValue: "15 min" },
      { category: "screen", title: "Phone-free first hour", detail: "Replace scroll with sunlight + water.", targetValue: "60 min" },
    ],
    protein: [
      { category: "nutrition", title: "Hit protein target", detail: "Aim for 25-35g at each main meal.", targetValue: "100% target" },
      { category: "activity", title: "30-min strength session", detail: "Compound lifts: squat, push, pull.", targetValue: "30 min" },
      { category: "sleep", title: "Magnesium tea before bed", detail: "Helps muscle recovery.", targetValue: null },
    ],
    recovery: [
      { category: "activity", title: "Easy mobility flow", detail: "20 minutes of stretching + breath work.", targetValue: "20 min" },
      { category: "screen", title: "Mid-day screen pause", detail: "10 minutes outside without your phone.", targetValue: "10 min" },
      { category: "nutrition", title: "Anti-inflammatory plate", detail: "Salmon, leafy greens, colorful veg.", targetValue: null },
    ],
    strength: [
      { category: "activity", title: "45-min strength + walk", detail: "Strength block plus 5,000-step walk.", targetValue: "9,000 steps" },
      { category: "nutrition", title: "Post-workout protein", detail: "20-30g within 60 minutes.", targetValue: "25g" },
      { category: "sleep", title: "Cool, dark room", detail: "Optimize for deep sleep tonight.", targetValue: null },
    ],
    mind: [
      { category: "mindfulness", title: "10-min meditation", detail: "Anywhere, eyes closed, breath only.", targetValue: "10 min" },
      { category: "screen", title: "Cap screen time today", detail: "Stay 15% under your daily limit.", targetValue: "-15%" },
      { category: "nutrition", title: "Hydration check-ins", detail: "8 cups water across the day.", targetValue: "8 cups" },
    ],
    long: [
      { category: "activity", title: "60-min long walk or hike", detail: "Outdoors if possible. Bring water.", targetValue: "60 min" },
      { category: "nutrition", title: "Cook two meals for the week", detail: "Lean protein + vegetables in bulk.", targetValue: null },
      { category: "sleep", title: "Wake without alarm", detail: "Trust your circadian rhythm.", targetValue: null },
    ],
    reflect: [
      { category: "mindfulness", title: "Weekly reflection", detail: "What went well? What's one tweak for next week?", targetValue: null },
      { category: "screen", title: "No screens after 9pm", detail: "Wind down for next week.", targetValue: null },
      { category: "nutrition", title: "Plan tomorrow's meals", detail: "Decide breakfast and lunch tonight.", targetValue: null },
    ],
  };

  const actions = base[focus] ?? base.foundation!;
  const conditionAddon: Record<Mode, { category: any; title: string; detail: string; targetValue: string | null } | null> = {
    standard: null,
    diabetes: { category: "condition", title: "10-min walk after dinner", detail: "Flattens post-meal glucose spike.", targetValue: "10 min" },
    hypertension: { category: "condition", title: "Sodium under 2,000 mg", detail: "Read labels on bread and sauces.", targetValue: "≤2,000 mg" },
    heart_health: { category: "condition", title: "Omega-3 serving", detail: "Salmon, sardines, walnuts, or flax.", targetValue: null },
    pregnancy: { category: "condition", title: "Iron + vitamin C pairing", detail: "Spinach with peppers or citrus.", targetValue: null },
    weight_loss: { category: "condition", title: "Two-meal protein priority", detail: "Protein first, then carbs and fats.", targetValue: null },
  };
  const addon = conditionAddon[mode];
  return addon ? [...actions, addon] : actions;
}

export function buildMonthlyPlan(profile: Profile, monthDate: Date) {
  const mode = profile.mode as Mode;
  const monthLabel = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
  const firstOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const weeks: { weekLabel: string; weekStart: string; theme: string; goals: string[] }[] = [];
  for (let i = 0; i < 4; i++) {
    const weekStart = startOfWeek(addDays(firstOfMonth, i * 7));
    const themeByWeek: Record<Mode, string[]> = {
      standard: [
        "Foundations — sleep & hydration",
        "Strength + protein priority",
        "Cardio base + recovery",
        "Refine + sustain",
      ],
      diabetes: [
        "Glucose-stable plates",
        "Post-meal walking habit",
        "Fiber-first carbs",
        "Sleep & glucose link",
      ],
      hypertension: [
        "Lower sodium baseline",
        "Potassium-rich plates",
        "Stress + breath work",
        "Cardio base + sleep",
      ],
      heart_health: [
        "Cardio base building",
        "Omega-3 nutrition",
        "Recovery & sleep",
        "Strength endurance",
      ],
      pregnancy: [
        "Energy & hydration",
        "Iron + folate",
        "Gentle movement",
        "Sleep position & rest",
      ],
      weight_loss: [
        "Protein at every meal",
        "Daily 9k steps",
        "Strength training",
        "Sustain & refine",
      ],
    };
    const goalsByWeek = [
      ["Anchor sleep window", "Hydration baseline", "Three short walks"],
      ["3 strength sessions", "Protein at every main meal", "Phone-free first hour"],
      ["2 long walks", "One restorative day", "Reduce screen time 10%"],
      ["Sustain sleep", "Reflect on month", "Plan next month's focus"],
    ];
    weeks.push({
      weekLabel: `Week ${i + 1}`,
      weekStart: ymd(weekStart),
      theme: themeByWeek[mode][i] ?? "Refine",
      goals: goalsByWeek[i] ?? [],
    });
  }
  const narrativeByMode: Record<Mode, string> = {
    standard: "A month for rhythm. Build the habits in week 1, push intensity in weeks 2-3, refine in week 4.",
    diabetes: "Month focused on glucose stability — small, repeatable wins that compound into better A1C.",
    hypertension: "Lower sodium and stress while raising movement and sleep — your BP will thank you.",
    heart_health: "Cardiac base in early weeks, omega-3 nutrition mid-month, sleep-led recovery to close.",
    pregnancy: "Steady energy and nutrient density. Listen to your body and modify intensity as needed.",
    weight_loss: "A sustainable month — protein, steps, and sleep. The deficit takes care of itself.",
  };
  return {
    month: monthLabel,
    modeContext: mode,
    narrative: narrativeByMode[mode],
    weeks,
  };
}
