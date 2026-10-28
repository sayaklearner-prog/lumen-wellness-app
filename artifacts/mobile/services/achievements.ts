import { storage } from "./storage";
import {
  getKV,
  setKV,
  getMeals,
  getWorkouts,
  getSleepSessions,
  getHydrationToday,
  getScreenTimeToday,
  getFocusSessionsToday,
  getCoachMessages,
} from "./db";
import { fitnessWatchSensor } from "./fitnessWatchSensor";
import { sendLocalNotification, getNotificationPreferences } from "./notifications";

// ============================================================================
// LUMEN ACHIEVEMENTS & INTERACTIVE GAMIFICATION ENGINE
// Tracks streaks, milestones, XP, tiers, and dispatches proactive unlock alerts
// ============================================================================

export type BadgeTier = "bronze" | "silver" | "gold" | "diamond";

export type AchievementCategory =
  | "streaks"
  | "fitness"
  | "hydration"
  | "sleep"
  | "nutrition"
  | "mindfulness"
  | "ai"
  | "safety";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  lore: string;
  category: AchievementCategory;
  tier: BadgeTier;
  icon: string; // Lucide icon identifier
  xp: number;
  target: number;
  unit: string;
  currentValue: number;
  progressPercent: number; // 0 to 100
  isUnlocked: boolean;
  unlockedAt: string | null;
}

export interface GamificationProfile {
  totalXp: number;
  currentLevel: number;
  levelTitle: string;
  currentLevelMinXp: number;
  nextLevelXp: number;
  levelProgressPercent: number;
  unlockedCount: number;
  totalCount: number;
  currentStreakDays: number;
  bestStreakDays: number;
}

// Level Progression Brackets
const LEVEL_BRACKETS = [
  { level: 1, minXp: 0, title: "Novice Seeker" },
  { level: 2, minXp: 200, title: "Habit Pioneer" },
  { level: 3, minXp: 500, title: "Vitality Builder" },
  { level: 4, minXp: 1000, title: "Bio-Hacker" },
  { level: 5, minXp: 1800, title: "Circadian Master" },
  { level: 6, minXp: 3000, title: "Longevity Titan" },
  { level: 7, minXp: 5000, title: "Lumen Elite Champion" },
];

const STORAGE_KEY_UNLOCKED = "lumen_unlocked_achievements_v2";
const STORAGE_KEY_PENDING_CELEBRATION = "lumen_pending_celebrations_v1";
const STORAGE_KEY_ACTIVE_DATES = "lumen_active_dates_v1";

interface UnlockedRecord {
  id: string;
  unlockedAt: string;
}

// Master Achievement Catalog
export const MASTER_ACHIEVEMENTS: Omit<Achievement, "currentValue" | "progressPercent" | "isUnlocked" | "unlockedAt">[] = [
  // --- STREAKS & CONSISTENCY ---
  {
    id: "streak_3",
    title: "Habit Pioneer",
    description: "Maintain a continuous 3-day health logging streak",
    lore: "The brain begins forging neuro-pathways of consistency after 72 hours of deliberate habit formation.",
    category: "streaks",
    tier: "bronze",
    icon: "Flame",
    xp: 100,
    target: 3,
    unit: "days",
  },
  {
    id: "streak_7",
    title: "Iron Discipline",
    description: "Complete a full 7-day uninterrupted wellness streak",
    lore: "One full revolution of the sun and circadian cycle with uninterrupted metabolic mindfulness.",
    category: "streaks",
    tier: "silver",
    icon: "ShieldAlert",
    xp: 250,
    target: 7,
    unit: "days",
  },
  {
    id: "streak_14",
    title: "Unstoppable Force",
    description: "Conquer a 14-day continuous wellness streak",
    lore: "Two consecutive weeks of physiological momentum. Habits now compound exponentially.",
    category: "streaks",
    tier: "gold",
    icon: "Award",
    xp: 500,
    target: 14,
    unit: "days",
  },
  {
    id: "streak_30",
    title: "Legend of Longevity",
    description: "Reach an extraordinary 30-day continuous health streak",
    lore: "A full cellular regeneration cycle. You have transcended fleeting motivation to embody true vitality.",
    category: "streaks",
    tier: "diamond",
    icon: "Crown",
    xp: 1000,
    target: 30,
    unit: "days",
  },

  // --- MOVEMENT & PHYSICAL ACTIVITY ---
  {
    id: "steps_1k",
    title: "First Strides",
    description: "Walk 1,000 steps tracked with 24/7 background motion",
    lore: "Every marathon begins with a single biomechanical footfall.",
    category: "fitness",
    tier: "bronze",
    icon: "Footprints",
    xp: 50,
    target: 1000,
    unit: "steps",
  },
  {
    id: "steps_5k",
    title: "Movement Explorer",
    description: "Reach 5,000 steps in a single day",
    lore: "Stimulating lower extremity lymphatic return and insulin sensitivity through sustained ambulation.",
    category: "fitness",
    tier: "bronze",
    icon: "Activity",
    xp: 100,
    target: 5000,
    unit: "steps",
  },
  {
    id: "steps_10k",
    title: "Ten-Thousand Club",
    description: "Hit the gold-standard 10,000 daily steps milestone",
    lore: "The clinical benchmark for cardiovascular resilience, lipid clearance, and metabolic longevity.",
    category: "fitness",
    tier: "silver",
    icon: "Trophy",
    xp: 250,
    target: 10000,
    unit: "steps",
  },
  {
    id: "steps_15k",
    title: "Trailblazer",
    description: "Accumulate 15,000 steps in a single day",
    lore: "High-volume active energy expenditure putting your mitochondrial efficiency in the top tier.",
    category: "fitness",
    tier: "gold",
    icon: "Zap",
    xp: 400,
    target: 15000,
    unit: "steps",
  },
  {
    id: "steps_20k",
    title: "Endurance Titan",
    description: "Clock 20,000 steps in one remarkable day",
    lore: "Ultra-endurance capability demonstrating elite stamina, grit, and cardiovascular output.",
    category: "fitness",
    tier: "diamond",
    icon: "Medal",
    xp: 750,
    target: 20000,
    unit: "steps",
  },
  {
    id: "workout_first",
    title: "Session Starter",
    description: "Complete your first logged workout or treadmill run",
    lore: "Initiating deliberate muscular overload to trigger positive cellular hypertrophy and adaptation.",
    category: "fitness",
    tier: "bronze",
    icon: "Dumbbell",
    xp: 75,
    target: 1,
    unit: "workouts",
  },
  {
    id: "workout_5",
    title: "Sweat Connoisseur",
    description: "Log 5 completed exercise or cardio sessions",
    lore: "Consistent resistance and aerobic conditioning building high metabolic baseline efficiency.",
    category: "fitness",
    tier: "silver",
    icon: "HeartPulse",
    xp: 200,
    target: 5,
    unit: "workouts",
  },

  // --- HYDRATION & ELECTROLYTES ---
  {
    id: "hydration_first",
    title: "Fresh Drop",
    description: "Log your first glass of water",
    lore: "Cellular hydration is the foundation for cognitive clarity and blood plasma volume.",
    category: "hydration",
    tier: "bronze",
    icon: "Droplet",
    xp: 50,
    target: 1,
    unit: "cups",
  },
  {
    id: "hydration_daily",
    title: "Hydration Hero",
    description: "Hit your daily target of 8 cups (2,000 ml) of water",
    lore: "Optimal osmolality achieved. Renal filtration and connective tissue elasticity maximized.",
    category: "hydration",
    tier: "bronze",
    icon: "Droplets",
    xp: 100,
    target: 8,
    unit: "cups",
  },

  // --- SLEEP & CIRCADIAN RECOVERY ---
  {
    id: "sleep_first",
    title: "Slumber Logged",
    description: "Record your first sleep cycle in Lumen",
    lore: "Tracking the glymphatic restorative cycle that flushes metabolic waste from brain parenchyma.",
    category: "sleep",
    tier: "bronze",
    icon: "Moon",
    xp: 50,
    target: 1,
    unit: "sessions",
  },
  {
    id: "sleep_optimal",
    title: "Circadian Guardian",
    description: "Log 7.5+ hours of restorative sleep in a session",
    lore: "Complete completion of 5 full 90-minute REM and Slow-Wave-Sleep ultra-dian recovery cycles.",
    category: "sleep",
    tier: "silver",
    icon: "Sparkles",
    xp: 200,
    target: 7.5,
    unit: "hours",
  },

  // --- NUTRITION & FUEL ---
  {
    id: "nutrition_first",
    title: "Mindful Plate",
    description: "Log your first meal with protein & calorie breakdown",
    lore: "You cannot optimize what you do not measure. Fueling biology with deliberate nutrient density.",
    category: "nutrition",
    tier: "bronze",
    icon: "Utensils",
    xp: 50,
    target: 1,
    unit: "meals",
  },
  {
    id: "nutrition_3_meals",
    title: "Triple Harvest",
    description: "Log 3 complete meals across a single day",
    lore: "A full day of balanced macronutrient tracking supporting steady glycogen and peptide synthesis.",
    category: "nutrition",
    tier: "silver",
    icon: "Apple",
    xp: 150,
    target: 3,
    unit: "meals",
  },

  // --- DIGITAL MINDFULNESS & FOCUS ---
  {
    id: "screentime_mindful",
    title: "Digital Zen",
    description: "Stay under your daily screen time budget",
    lore: "Protecting dopamine sensitivity and circadian ocular health from blue-light sensory overload.",
    category: "mindfulness",
    tier: "bronze",
    icon: "Clock",
    xp: 100,
    target: 1,
    unit: "days",
  },
  {
    id: "focus_session",
    title: "Deep Work Flow",
    description: "Complete a structured Pomodoro or Deep Focus session",
    lore: "Achieving intense prefrontal cortex concentration with distractions silenced.",
    category: "mindfulness",
    tier: "silver",
    icon: "Brain",
    xp: 150,
    target: 1,
    unit: "sessions",
  },

  // --- AI BIO-INTELLIGENCE ---
  {
    id: "ai_coach_first",
    title: "Neural Spark",
    description: "Ask your first bio-data question to Google Gemini AI Coach",
    lore: "Synthesizing real-time physiological telemetry with high-order clinical intelligence.",
    category: "ai",
    tier: "bronze",
    icon: "Bot",
    xp: 75,
    target: 1,
    unit: "queries",
  },

  // --- SAFETY & PREPAREDNESS ---
  {
    id: "safety_prepared",
    title: "Shield Bearer",
    description: "Save emergency contacts and configure your Medical ID",
    lore: "Critical proactive security. Preparedness gives freedom and protects loved ones in any emergency.",
    category: "safety",
    tier: "bronze",
    icon: "ShieldCheck",
    xp: 100,
    target: 1,
    unit: "profiles",
  },
];

/**
 * Calculates current consecutive active logging days streak.
 */
export async function calculateStreakDays(): Promise<{ currentStreak: number; bestStreak: number }> {
  try {
    const todayStr = new Date().toISOString().split("T")[0];

    // Load recorded active dates
    let datesSet = new Set<string>();
    const stored = await storage.getItem(STORAGE_KEY_ACTIVE_DATES);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((d) => datesSet.add(d));
        }
      } catch {}
    }

    // Always add today
    datesSet.add(todayStr);

    // Also pull historical dates from SQLite tables
    try {
      const [meals, workouts, sleep] = await Promise.all([
        getMeals(),
        getWorkouts(),
        getSleepSessions(),
      ]);
      meals.forEach((m) => {
        if (m.loggedAt) datesSet.add(m.loggedAt.split("T")[0]);
      });
      workouts.forEach((w) => {
        if (w.loggedAt) datesSet.add(w.loggedAt.split("T")[0]);
      });
      sleep.forEach((s) => {
        if (s.loggedAt) datesSet.add(s.loggedAt.split("T")[0]);
      });
    } catch (e) {
      console.warn("Error fetching streak dates from DB:", e);
    }

    // Persist combined dates
    const dateList = Array.from(datesSet).sort();
    await storage.setItem(STORAGE_KEY_ACTIVE_DATES, JSON.stringify(dateList));
    await setKV(STORAGE_KEY_ACTIVE_DATES, JSON.stringify(dateList));

    // Calculate backwards consecutive days starting from today or yesterday
    let currentStreak = 0;
    const checkDate = new Date();
    // Normalize to midnight UTC
    checkDate.setHours(0, 0, 0, 0);

    // If today is logged, count back
    let runningDate = new Date(checkDate);
    while (true) {
      const iso = runningDate.toISOString().split("T")[0];
      if (datesSet.has(iso)) {
        currentStreak++;
        runningDate.setDate(runningDate.getDate() - 1);
      } else {
        // If today is day 0 and wasn't in set, check yesterday
        if (currentStreak === 0) {
          runningDate.setDate(runningDate.getDate() - 1);
          const yesterdayIso = runningDate.toISOString().split("T")[0];
          if (datesSet.has(yesterdayIso)) {
            currentStreak++;
            runningDate.setDate(runningDate.getDate() - 1);
            continue;
          }
        }
        break;
      }
    }

    // Minimum 1 day active if user opened app today
    currentStreak = Math.max(1, currentStreak);

    // Load best streak
    const bestStreakStr = await storage.getItem("lumen_best_streak_v1");
    let bestStreak = bestStreakStr ? parseInt(bestStreakStr, 10) : 1;
    if (currentStreak > bestStreak) {
      bestStreak = currentStreak;
      await storage.setItem("lumen_best_streak_v1", String(bestStreak));
    }

    return { currentStreak, bestStreak };
  } catch (err) {
    console.warn("Failed calculating streak:", err);
    return { currentStreak: 1, bestStreak: 1 };
  }
}

/**
 * Loads unlocked achievements record from persistent storage.
 */
async function getUnlockedRecords(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    let raw = await storage.getItem(STORAGE_KEY_UNLOCKED);
    if (!raw) {
      raw = await getKV(STORAGE_KEY_UNLOCKED);
    }
    if (raw) {
      const list: UnlockedRecord[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        list.forEach((item) => map.set(item.id, item.unlockedAt));
      }
    }
  } catch (e) {
    console.warn("Failed retrieving unlocked records:", e);
  }
  return map;
}

/**
 * Saves unlocked achievements list to persistent storage.
 */
async function saveUnlockedRecords(map: Map<string, string>): Promise<void> {
  try {
    const list: UnlockedRecord[] = [];
    map.forEach((unlockedAt, id) => {
      list.push({ id, unlockedAt });
    });
    const json = JSON.stringify(list);
    await storage.setItem(STORAGE_KEY_UNLOCKED, json);
    await setKV(STORAGE_KEY_UNLOCKED, json);
  } catch (e) {
    console.warn("Failed saving unlocked records:", e);
  }
}

/**
 * Evaluates all achievements against live user telemetry and SQLite history.
 * If any achievement unlocks, sends a proactive notification and queues celebratory banner.
 */
export async function evaluateAchievements(): Promise<{
  achievements: Achievement[];
  newlyUnlocked: Achievement[];
  gamification: GamificationProfile;
}> {
  // 1. Fetch live telemetry snapshots in parallel
  const [
    unlockedMap,
    streakInfo,
    meals,
    workouts,
    sleepSessions,
    hydrationCups,
    screenTime,
    focusSessions,
    coachMessages,
    contactsJson,
  ] = await Promise.all([
    getUnlockedRecords(),
    calculateStreakDays(),
    getMeals().catch(() => []),
    getWorkouts().catch(() => []),
    getSleepSessions().catch(() => []),
    getHydrationToday().catch(() => 0),
    getScreenTimeToday().catch(() => ({ screenMinutes: 0, limitMinutes: 180 })),
    getFocusSessionsToday().catch(() => []),
    getCoachMessages("1").catch(() => []),
    storage.getItem("lumen_emergency_contacts").catch(() => null),
  ]);

  // 2. Fetch live sensor step count
  const sensorMetrics = fitnessWatchSensor.getSnapshot();
  const liveSteps = Math.max(sensorMetrics.dailySteps, sensorMetrics.steps);

  // 3. Compute telemetry values for criteria
  const streakDays = streakInfo.currentStreak;
  const workoutsCount = workouts.length + (sensorMetrics.isActive ? 1 : 0);
  const mealsCount = meals.length;
  const sleepCount = sleepSessions.length;
  const maxSleepDuration = sleepSessions.reduce((max, s) => Math.max(max, s.durationHours || 0), 0);
  const completedFocusSessions = focusSessions.filter((f) => f.status === "completed").length;
  const isScreenTimeUnderBudget =
    screenTime.screenMinutes > 0 && screenTime.screenMinutes <= (screenTime.limitMinutes || 180) ? 1 : 0;
  const aiCoachQueries = coachMessages.filter((m) => m.role === "user").length;

  let hasContacts = 0;
  if (contactsJson) {
    try {
      const parsed = JSON.parse(contactsJson);
      if (Array.isArray(parsed) && parsed.length > 0) hasContacts = 1;
    } catch {}
  }

  const newlyUnlocked: Achievement[] = [];
  const fullAchievements: Achievement[] = [];

  // 4. Evaluate each master achievement
  for (const master of MASTER_ACHIEVEMENTS) {
    let currentVal = 0;

    switch (master.id) {
      // Streaks
      case "streak_3":
      case "streak_7":
      case "streak_14":
      case "streak_30":
        currentVal = streakDays;
        break;

      // Steps
      case "steps_1k":
      case "steps_5k":
      case "steps_10k":
      case "steps_15k":
      case "steps_20k":
        currentVal = liveSteps;
        break;

      // Workouts
      case "workout_first":
      case "workout_5":
        currentVal = workoutsCount;
        break;

      // Hydration
      case "hydration_first":
      case "hydration_daily":
        currentVal = hydrationCups;
        break;

      // Sleep
      case "sleep_first":
        currentVal = sleepCount;
        break;
      case "sleep_optimal":
        currentVal = maxSleepDuration;
        break;

      // Nutrition
      case "nutrition_first":
      case "nutrition_3_meals":
        currentVal = mealsCount;
        break;

      // Digital Zen & Focus
      case "screentime_mindful":
        currentVal = isScreenTimeUnderBudget;
        break;
      case "focus_session":
        currentVal = completedFocusSessions;
        break;

      // AI Coach
      case "ai_coach_first":
        currentVal = aiCoachQueries;
        break;

      // Safety
      case "safety_prepared":
        currentVal = hasContacts;
        break;

      default:
        currentVal = 0;
    }

    const isUnlockedPrev = unlockedMap.has(master.id);
    const meetsCriteria = currentVal >= master.target;
    let unlockedAt = unlockedMap.get(master.id) || null;

    // Detect NEW Unlock!
    if (meetsCriteria && !isUnlockedPrev) {
      unlockedAt = new Date().toISOString();
      unlockedMap.set(master.id, unlockedAt);

      const newlyObj: Achievement = {
        ...master,
        currentValue: currentVal,
        progressPercent: 100,
        isUnlocked: true,
        unlockedAt,
      };
      newlyUnlocked.push(newlyObj);
    }

    const progressPercent = Math.min(100, Math.round((currentVal / master.target) * 100));

    fullAchievements.push({
      ...master,
      currentValue: currentVal,
      progressPercent,
      isUnlocked: meetsCriteria || isUnlockedPrev,
      unlockedAt,
    });
  }

  // 5. If new unlocks occurred, persist and dispatch proactive notifications
  if (newlyUnlocked.length > 0) {
    await saveUnlockedRecords(unlockedMap);

    // Save newly unlocked achievements into pending celebration queue for in-app modals
    try {
      const prevPendingRaw = await storage.getItem(STORAGE_KEY_PENDING_CELEBRATION);
      const prevPending: Achievement[] = prevPendingRaw ? JSON.parse(prevPendingRaw) : [];
      const updatedPending = [...prevPending, ...newlyUnlocked];
      await storage.setItem(STORAGE_KEY_PENDING_CELEBRATION, JSON.stringify(updatedPending));
    } catch {}

    // Dispatch proactive notification if enabled in user preferences
    try {
      const prefs = await getNotificationPreferences();
      if (prefs.masterEnabled && prefs.achievementAlertsEnabled !== false) {
        for (const badge of newlyUnlocked) {
          await sendLocalNotification({
            title: `🏆 Achievement Unlocked: ${badge.title}!`,
            body: `You've earned the ${badge.tier.toUpperCase()} badge: "${badge.description}" (+${badge.xp} Bio-XP)!`,
            channelId: "lumen_alerts",
          });
        }
      }
    } catch (e) {
      console.warn("Failed dispatching achievement unlock notification:", e);
    }
  }

  // 6. Compute Total XP and Level Profile
  let totalXp = 0;
  let unlockedCount = 0;

  fullAchievements.forEach((ach) => {
    if (ach.isUnlocked) {
      totalXp += ach.xp;
      unlockedCount++;
    }
  });

  // Calculate Level Bracket
  let currentBracket = LEVEL_BRACKETS[0];
  let nextBracket = LEVEL_BRACKETS[1];

  for (let i = 0; i < LEVEL_BRACKETS.length; i++) {
    if (totalXp >= LEVEL_BRACKETS[i].minXp) {
      currentBracket = LEVEL_BRACKETS[i];
      nextBracket = LEVEL_BRACKETS[i + 1] || {
        level: currentBracket.level + 1,
        minXp: currentBracket.minXp + 2000,
        title: "Transcendent Master",
      };
    }
  }

  const xpInLevel = totalXp - currentBracket.minXp;
  const xpSpan = nextBracket.minXp - currentBracket.minXp;
  const levelProgressPercent = Math.min(100, Math.max(0, Math.round((xpInLevel / xpSpan) * 100)));

  const gamification: GamificationProfile = {
    totalXp,
    currentLevel: currentBracket.level,
    levelTitle: currentBracket.title,
    currentLevelMinXp: currentBracket.minXp,
    nextLevelXp: nextBracket.minXp,
    levelProgressPercent,
    unlockedCount,
    totalCount: fullAchievements.length,
    currentStreakDays: streakInfo.currentStreak,
    bestStreakDays: streakInfo.bestStreak,
  };

  return {
    achievements: fullAchievements,
    newlyUnlocked,
    gamification,
  };
}

/**
 * Pops the next pending achievement celebration from the queue for in-app UI celebration.
 */
export async function popPendingCelebration(): Promise<Achievement | null> {
  try {
    const raw = await storage.getItem(STORAGE_KEY_PENDING_CELEBRATION);
    if (!raw) return null;
    const list: Achievement[] = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return null;

    const nextBadge = list[0];
    const remaining = list.slice(1);
    await storage.setItem(STORAGE_KEY_PENDING_CELEBRATION, JSON.stringify(remaining));
    return nextBadge;
  } catch {
    return null;
  }
}
