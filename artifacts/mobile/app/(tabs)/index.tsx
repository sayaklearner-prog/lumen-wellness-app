import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
  Dimensions,
  Modal,
  Alert,
  AppState,
  AppStateStatus,
  Switch,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import {
  useGetTodayDashboard,
  useGetProfile,
  useGetTimeline,
  useListWorkouts,
  useGetStreaks,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Flame,
  Moon,
  Brain,
  Sparkles,
  ChevronRight,
  Zap,
  Volume2,
  VolumeX,
  ShieldCheck,
  Utensils,
  Droplet,
  Plus,
  Minus,
  Smartphone,
  CheckCircle2,
  Menu,
  X,
  Clock,
  Shield,
  Sliders,
  Check,
} from "lucide-react-native";
import Svg, {
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
} from "react-native-svg";
import { GlassCard } from "@/components/GlassCard";
import { speakText, stopSpeaking } from "@/services/voice";
import { syncHealthData, getLastSyncStatus, HealthSyncStatus } from "@/services/health";
import { storage } from "@/services/storage";
import { useSlideMenu } from "@/context/SlideMenuContext";
import {
  getMeals,
  getWorkouts,
  getLatestSleep,
  saveSleepSession,
  getScreenTimeToday,
  saveScreenTime,
  getHydrationToday,
  setHydrationToday,
  SleepRecord,
  ScreenTimeRecord,
} from "@/services/db";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Tactile feedback helper
const triggerHaptic = (style?: string) => {
  if (Platform.OS === "web") return;
  try {
    const Haptics = require("expo-haptics");
    if (style === "success") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {}
};

// Circular Score Ring matching the reference mockup
function CircularScoreRing({ score, maxScore = 10 }: { score: number; maxScore?: number }) {
  const size = 96;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(100, Math.max(0, (score / maxScore) * 100));
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#10b981" />
            <Stop offset="100%" stopColor="#06b6d4" />
          </LinearGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1b2a22"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Fill */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#scoreGrad)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <Text style={styles.scoreNumber}>{score.toFixed(1)}</Text>
        <Text style={styles.scoreLabel}>SCORE</Text>
      </View>
    </View>
  );
}

// 7-Day Trend Chart Component matching the reference
function Trend7DayChart({ overallScore }: { overallScore: number }) {
  const days = ["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"];
  const dataPoints = [0, 0, 0, 0, 0, 0, overallScore];
  const chartHeight = 110;
  const chartWidth = SCREEN_WIDTH - 64;
  const maxVal = 10;
  const stepX = chartWidth / (days.length - 1);

  const points = dataPoints.map((val, idx) => {
    const x = idx * stepX;
    const y = chartHeight - (val / maxVal) * (chartHeight - 20) - 10;
    return { x, y, val };
  });

  const linePath = points.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");
  const areaPath = `${linePath} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

  return (
    <View style={styles.trendChartBox}>
      <View style={styles.yAxis}>
        <Text style={styles.yAxisText}>10</Text>
        <Text style={styles.yAxisText}>6</Text>
        <Text style={styles.yAxisText}>3</Text>
        <Text style={styles.yAxisText}>0</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="trendGrad" x1="0%" y1="0%" x2="0%" y2="1">
              <Stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <Stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          <Line x1="0" y1="10" x2={chartWidth} y2="10" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <Line x1="0" y1="45" x2={chartWidth} y2="45" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <Line x1="0" y1="80" x2={chartWidth} y2="80" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <Line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="rgba(255,255,255,0.1)" />

          <Path d={areaPath} fill="url(#trendGrad)" />
          <Path d={linePath} stroke="#10b981" strokeWidth={2.5} fill="none" />

          {points.map((p, idx) => (
            <Circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r={idx === points.length - 1 ? 5 : 3}
              fill={idx === points.length - 1 ? "#06b6d4" : "#10b981"}
              stroke="#070c0a"
              strokeWidth={2}
            />
          ))}
        </Svg>

        <View style={styles.xAxisRow}>
          {days.map((day, idx) => (
            <Text
              key={idx}
              style={[
                styles.xAxisText,
                idx === days.length - 1 && { color: "#10b981", fontWeight: "bold" },
              ]}
            >
              {day}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { openLeftMenu, openRightMenu } = useSlideMenu();

  const [refreshing, setRefreshing] = useState(false);
  const [isSpeakingBriefing, setIsSpeakingBriefing] = useState(false);
  const [waterCups, setWaterCups] = useState(0);

  // Wearable Health sync states
  const [syncStatus, setSyncStatus] = useState<HealthSyncStatus>({
    lastSyncedAt: null,
    status: "idle",
    syncedMetrics: [],
  });

  // Local storage meals for live nutrition calculation
  const [localMealsCount, setLocalMealsCount] = useState(0);
  const [localCaloriesConsumed, setLocalCaloriesConsumed] = useState(0);

  // Sleep Modal & interactive state
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [sleepHoursLogged, setSleepHoursLogged] = useState(0);
  const [sleepQuality, setSleepQuality] = useState("Restorative");
  const [hasLoggedSleepToday, setHasLoggedSleepToday] = useState(false);

  // Screen Time & Digital Wellbeing interactive state
  const [showScreenTimeModal, setShowScreenTimeModal] = useState(false);
  const [screenMinutesToday, setScreenMinutesToday] = useState(0);
  const [screenLimitMinutes, setScreenLimitMinutes] = useState(240); // 4h 00m
  const [focusModeActive, setFocusModeActive] = useState(false);
  const [windDownActive, setWindDownActive] = useState(false);

  // Background app usage session tracking
  const appActiveTimestamp = useRef<number>(Date.now());

  const { data: profile } = useGetProfile();
  const { data: dashboard, refetch } = useGetTodayDashboard();
  const { data: timelineEvents, refetch: refetchTimeline } = useGetTimeline();
  const { data: workouts, refetch: refetchWorkouts } = useListWorkouts();
  const { data: streaksData, refetch: refetchStreaks } = useGetStreaks();

  // Load last sync status, local meals, sleep & screen time
  useEffect(() => {
    async function loadLocalHealthState() {
      const status = await getLastSyncStatus();
      setSyncStatus(status);

      // 1. Read meals from SQLite master DB
      try {
        const dbMeals = await getMeals();
        if (dbMeals && dbMeals.length > 0) {
          setLocalMealsCount(dbMeals.length);
          const totalCal = dbMeals.reduce((sum: number, m: any) => sum + (Number(m.calories) || 0), 0);
          setLocalCaloriesConsumed(totalCal);
        } else {
          const storedMeals = await storage.getItem("lumen_local_meals");
          if (storedMeals) {
            const parsed = JSON.parse(storedMeals);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setLocalMealsCount(parsed.length);
              const totalCal = parsed.reduce((sum: number, m: any) => sum + (Number(m.calories) || 0), 0);
              setLocalCaloriesConsumed(totalCal);
            }
          }
        }
      } catch {}

      // 2. Read saved sleep from SQLite master DB
      try {
        const dbSleep = await getLatestSleep();
        if (dbSleep) {
          setSleepHoursLogged(Number(dbSleep.durationHours));
          setSleepQuality(dbSleep.quality || "Restorative");
          setHasLoggedSleepToday(true);
        } else {
          const storedSleep = await storage.getItem("lumen_sleep_session");
          if (storedSleep) {
            const parsed = JSON.parse(storedSleep);
            if (parsed.hours) {
              setSleepHoursLogged(Number(parsed.hours));
              setSleepQuality(parsed.quality || "Restorative");
              setHasLoggedSleepToday(true);
            }
          }
        }
      } catch {}

      // 3. Read digital wellbeing from SQLite master DB
      try {
        const dbScreen = await getScreenTimeToday();
        if (dbScreen) {
          setScreenMinutesToday(dbScreen.screenMinutes);
          setScreenLimitMinutes(dbScreen.limitMinutes);
          setFocusModeActive(dbScreen.focusMode);
          setWindDownActive(dbScreen.windDown);
        }
      } catch {}

      // 4. Read hydration from SQLite master DB
      try {
        const cups = await getHydrationToday();
        if (cups !== undefined) setWaterCups(cups);
      } catch {}
    }
    loadLocalHealthState();
  }, []);

  // Listen to AppState to accumulate live phone foreground screen time
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        appActiveTimestamp.current = Date.now();
      } else if (nextState === "background" || nextState === "inactive") {
        const elapsedSeconds = (Date.now() - appActiveTimestamp.current) / 1000;
        const additionalMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
        setScreenMinutesToday((prev) => {
          const nextVal = prev + additionalMinutes;
          storage.setItem(
            "lumen_digital_wellbeing",
            JSON.stringify({
              screenMinutes: nextVal,
              screenLimitMinutes,
              focusModeActive,
              windDownActive,
            })
          );
          return nextVal;
        });
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [screenLimitMinutes, focusModeActive, windDownActive]);

  const handleRefresh = async () => {
    triggerHaptic();
    setRefreshing(true);
    await Promise.all([refetch(), refetchTimeline(), refetchWorkouts(), refetchStreaks()]);
    // Also re-read local meals
    try {
      const storedMeals = await storage.getItem("lumen_local_meals");
      if (storedMeals) {
        const parsed = JSON.parse(storedMeals);
        if (Array.isArray(parsed)) {
          setLocalMealsCount(parsed.length);
          const totalCal = parsed.reduce((sum: number, m: any) => sum + (Number(m.calories) || 0), 0);
          setLocalCaloriesConsumed(totalCal);
        }
      }
    } catch {}
    setRefreshing(false);
  };

  const handleSyncHealth = async () => {
    triggerHaptic("success");
    setSyncStatus((prev) => ({ ...prev, status: "syncing" }));
    const success = await syncHealthData();
    if (success) {
      const status = await getLastSyncStatus();
      setSyncStatus(status);
      await refetch();
      await refetchTimeline();
    } else {
      setSyncStatus((prev) => ({ ...prev, status: "error" }));
    }
  };

  // Base metrics
  const workoutCaloriesBurned =
    workouts?.reduce((acc: number, w: any) => acc + (Number(w.caloriesBurned) || 0), 0) || 0;
  const stepsCount = dashboard?.steps || 0;
  const stepsCaloriesBurned = Math.round(stepsCount * 0.045);
  const totalActiveCaloriesBurned = workoutCaloriesBurned + stepsCaloriesBurned;

  const stepsTarget = profile?.dailyStepsTarget || 9000;
  const caloriesTarget = profile?.dailyCalorieTarget || 2100;

  // Real Consumed Calories (combine backend dashboard + local meals)
  const caloriesConsumed = Math.max(
    Number(dashboard?.caloriesConsumed || 0),
    localCaloriesConsumed
  );
  const caloriesPercent = Math.min(100, Math.round((caloriesConsumed / caloriesTarget) * 100));

  const proteinGrams = Math.max(Number(dashboard?.proteinGrams || 0), localMealsCount * 28);
  const carbsGrams = Math.max(Number(dashboard?.carbsGrams || 0), localMealsCount * 42);
  const fatGrams = Math.max(Number(dashboard?.fatGrams || 0), localMealsCount * 14);

  // =========================================================================
  // DYNAMIC 5 PILLAR CALCULATIONS (Nutrition, Hydration, Sleep, Activity, Screen Time)
  // =========================================================================

  // 1. Dynamic Nutrition Score & Label
  const dynamicNutritionScore = useMemo(() => {
    if (caloriesConsumed === 0) return 0.0;
    const ratio = caloriesConsumed / caloriesTarget;
    if (ratio >= 0.8 && ratio <= 1.15) return 9.5;
    if (ratio >= 0.5 && ratio < 0.8) return 7.5;
    if (ratio > 1.15) return 6.8;
    return 5.2;
  }, [caloriesConsumed, caloriesTarget]);

  const dynamicNutritionLabel = useMemo(() => {
    if (caloriesConsumed === 0) return "Not logged • Tap to log";
    if (dynamicNutritionScore >= 8.5) return `${caloriesConsumed} kcal • Optimal`;
    if (dynamicNutritionScore >= 7.0) return `${caloriesConsumed} kcal • On Target`;
    return `${caloriesConsumed} kcal • Deficit`;
  }, [caloriesConsumed, dynamicNutritionScore]);

  // 2. Dynamic Sleep Score & Label
  const effectiveSleepHours = hasLoggedSleepToday
    ? sleepHoursLogged
    : Number(dashboard?.sleepHours || 0);

  const dynamicSleepScore = useMemo(() => {
    if (effectiveSleepHours === 0) return 0.0;
    if (effectiveSleepHours >= 7.5 && effectiveSleepHours <= 8.5) return 9.5;
    if (effectiveSleepHours >= 7.0) return 8.5;
    if (effectiveSleepHours >= 6.0) return 7.2;
    return Math.max(1.0, Number((effectiveSleepHours * 1.1).toFixed(1)));
  }, [effectiveSleepHours]);

  const dynamicSleepLabel = useMemo(() => {
    if (effectiveSleepHours === 0) return "Not logged • Tap to log";
    return `${effectiveSleepHours}h • ${sleepQuality}`;
  }, [effectiveSleepHours, sleepQuality]);

  // 3. Dynamic Activity Score & Label
  const dynamicActivityScore = useMemo(() => {
    const workoutsCount = workouts?.length || 0;
    if (stepsCount === 0 && workoutsCount === 0 && totalActiveCaloriesBurned === 0) return 0.0;
    const stepRatio = Math.min(1.0, stepsCount / stepsTarget);
    const stepPart = stepRatio * 7.5;
    const workoutPart = Math.min(2.5, (totalActiveCaloriesBurned / 400) * 2.5);
    return Number(Math.min(10.0, Math.max(1.0, stepPart + workoutPart)).toFixed(1));
  }, [stepsCount, stepsTarget, workouts, totalActiveCaloriesBurned]);

  const dynamicActivityLabel = useMemo(() => {
    if (stepsCount === 0 && (!workouts || workouts.length === 0)) return "Not logged • Tap to track";
    if (dynamicActivityScore >= 8.0) return `${stepsCount.toLocaleString()} steps • Peak`;
    if (dynamicActivityScore >= 6.0) return `${stepsCount.toLocaleString()} steps • Active`;
    return `${stepsCount.toLocaleString()} steps • Light`;
  }, [stepsCount, workouts, dynamicActivityScore]);

  // 4. Dynamic Screen Time (Digital Wellbeing) Score & Label
  const dynamicScreenScore = useMemo(() => {
    if (screenMinutesToday === 0) return 0.0;
    const ratio = screenMinutesToday / screenLimitMinutes;
    if (ratio <= 0.7) return 9.5;
    if (ratio <= 0.9) return 8.5;
    if (ratio <= 1.05) return 7.2;
    return Math.max(1.0, Number((6.0 - (ratio - 1.05) * 8).toFixed(1)));
  }, [screenMinutesToday, screenLimitMinutes]);

  const dynamicScreenLabel = useMemo(() => {
    if (screenMinutesToday === 0) return "Not logged • Tap to connect";
    const hours = Math.floor(screenMinutesToday / 60);
    const mins = screenMinutesToday % 60;
    const timeStr = `${hours}h ${mins}m`;
    if (dynamicScreenScore >= 8.5) return `${timeStr} • Balanced`;
    if (dynamicScreenScore >= 7.0) return `${timeStr} • Moderate`;
    return `${timeStr} • Screen Strain`;
  }, [screenMinutesToday, dynamicScreenScore]);

  // 5. Dynamic Hydration Score & Label
  const dynamicHydrationScore = useMemo(() => {
    if (waterCups === 0) return 0.0;
    const ratio = Math.min(1.25, waterCups / 8);
    return Number(Math.min(10.0, ratio * 8.5 + (waterCups >= 8 ? 1.5 : 0)).toFixed(1));
  }, [waterCups]);

  const dynamicHydrationLabel = useMemo(() => {
    if (waterCups === 0) return "Not logged • Tap to log";
    if (waterCups >= 8) return `${waterCups} cups • Fully Hydrated`;
    if (waterCups >= 5) return `${waterCups} cups • Good Pace`;
    return `${waterCups} cups • Needs Water`;
  }, [waterCups]);

  // Composite Health Score: True average across all evaluated pillars (Nutrition, Hydration, Sleep, Activity, Screen Time)
  const dynamicOverallScore = useMemo(() => {
    const evaluatedPillars = [
      { name: "Nutrition", score: dynamicNutritionScore, hasData: caloriesConsumed > 0 },
      { name: "Hydration", score: dynamicHydrationScore, hasData: waterCups > 0 },
      { name: "Sleep", score: dynamicSleepScore, hasData: effectiveSleepHours > 0 },
      { name: "Activity", score: dynamicActivityScore, hasData: stepsCount > 0 || totalActiveCaloriesBurned > 0 },
      { name: "Screen Time", score: dynamicScreenScore, hasData: screenMinutesToday > 0 },
    ];

    const activePillars = evaluatedPillars.filter((p) => p.hasData);
    if (activePillars.length === 0) return 0.0;
    const sum = activePillars.reduce((acc, p) => acc + p.score, 0);
    return Number((sum / activePillars.length).toFixed(1));
  }, [
    dynamicNutritionScore,
    dynamicHydrationScore,
    dynamicSleepScore,
    dynamicActivityScore,
    dynamicScreenScore,
    caloriesConsumed,
    waterCups,
    effectiveSleepHours,
    stepsCount,
    totalActiveCaloriesBurned,
    screenMinutesToday,
  ]);

  // Greeting
  const greetingTime = useMemo(() => {
    const curHour = new Date().getHours();
    if (curHour < 12) return "Good morning";
    if (curHour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const userName = profile?.name || "User";

  // Energy message
  const energySubtext =
    dynamicOverallScore >= 7.5
      ? "Today is looking like an energized, peak-performance day."
      : dynamicOverallScore >= 5.0
        ? "Today is looking like a balanced, steady momentum day."
        : dynamicOverallScore > 0
          ? "Today is looking like a low energy recovery day."
          : "Log your nutrition, hydration, sleep, or activity to calculate your overall health score.";

  const aiInsightTitle =
    dashboard?.topRecommendation?.title || "Daily Bio-Intelligence Guidance";
  const aiInsightDesc =
    dashboard?.topRecommendation?.body ||
    "Log your nutrition, hydration, sleep, and activity to receive personalized daily recommendations.";

  const streaksList = useMemo(() => {
    return Array.isArray(streaksData) ? (streaksData as any[]) : [];
  }, [streaksData]);

  // Briefing speech
  const briefingText =
    stepsCount > 0
      ? `Movement is tracked today with ${stepsCount.toLocaleString()} steps. Keep hydration continuous to finish strong.`
      : `Welcome, ${userName}. Active calorie burn is currently ${totalActiveCaloriesBurned} kcal. Start an activity or log your meals to track your day.`;

  const toggleBriefingVoice = () => {
    if (isSpeakingBriefing) {
      stopSpeaking();
      setIsSpeakingBriefing(false);
    } else {
      setIsSpeakingBriefing(true);
      speakText(briefingText, () => setIsSpeakingBriefing(false));
    }
  };

  const incrementWater = () => {
    triggerHaptic();
    const nextVal = waterCups + 1;
    setWaterCups(nextVal);
    setHydrationToday(nextVal);
  };

  const decrementWater = () => {
    triggerHaptic();
    const nextVal = Math.max(0, waterCups - 1);
    setWaterCups(nextVal);
    setHydrationToday(nextVal);
  };

  // Sleep Modal save handler
  const handleSaveSleepSession = async () => {
    triggerHaptic("success");
    setHasLoggedSleepToday(true);
    const sleepRecord: SleepRecord = {
      id: `sleep-${Date.now()}`,
      durationHours: sleepHoursLogged,
      quality: sleepQuality,
      deepSleepHours: Math.round(sleepHoursLogged * 0.22 * 10) / 10,
      remSleepHours: Math.round(sleepHoursLogged * 0.25 * 10) / 10,
      loggedAt: new Date().toISOString(),
    };

    await saveSleepSession(sleepRecord);
    await storage.setItem(
      "lumen_sleep_session",
      JSON.stringify({
        hours: sleepHoursLogged,
        quality: sleepQuality,
        loggedAt: new Date().toISOString(),
      })
    );
    setShowSleepModal(false);
    Alert.alert("Sleep Logged", `Recorded ${sleepHoursLogged}h of ${sleepQuality.toLowerCase()} sleep.`);
  };

  // Dedicated helpers to open Android intent or settings
  const openAndroidSetting = async (action: string) => {
    try {
      if (Platform.OS === "android") {
        await Linking.sendIntent(action);
        return true;
      }
    } catch (e) {
      console.warn(`sendIntent ${action} failed:`, e);
    }
    return false;
  };

  const openAccessibilitySettings = async () => {
    triggerHaptic();
    if (Platform.OS === "android") {
      const ok = await openAndroidSetting("android.settings.ACCESSIBILITY_SETTINGS");
      if (!ok) {
        try {
          await Linking.openURL("intent:#Intent;action=android.settings.ACCESSIBILITY_SETTINGS;end");
        } catch {
          await Linking.openSettings();
        }
      }
    } else {
      await Linking.openSettings();
    }
  };

  const openUsageAccessSettings = async () => {
    triggerHaptic();
    if (Platform.OS === "android") {
      const ok = await openAndroidSetting("android.settings.USAGE_ACCESS_SETTINGS");
      if (!ok) {
        try {
          await Linking.openURL("intent:#Intent;action=android.settings.USAGE_ACCESS_SETTINGS;end");
        } catch {
          await Linking.openSettings();
        }
      }
    } else {
      await Linking.openSettings();
    }
  };

  // Request Accessibility & Usage Access permission for Screen Time
  const requestAccessibilityAndUsagePermission = async () => {
    triggerHaptic();
    if (Platform.OS === "android") {
      Alert.alert(
        "Screen Time & Wellbeing Access",
        "To track your daily screen time automatically like a native digital wellbeing app, Lumen requires Accessibility and Usage Access permissions.\n\nChoose which settings screen to open:",
        [
          {
            text: "Accessibility Settings",
            onPress: openAccessibilitySettings,
          },
          {
            text: "Usage Access Settings",
            onPress: openUsageAccessSettings,
          },
          {
            text: "Open App Settings",
            onPress: () => Linking.openSettings(),
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
    } else if (Platform.OS === "ios") {
      Alert.alert(
        "Screen Time Access",
        "On iOS, screen time is managed via Apple Screen Time in Settings.",
        [
          { text: "Open Settings", onPress: () => Linking.openSettings() },
          { text: "Dismiss", style: "cancel" },
        ]
      );
    } else {
      Alert.alert("Permission", "Screen time tracking is active on mobile devices.");
    }
  };

  // Digital Wellbeing save handler
  const handleSaveWellbeing = async () => {
    triggerHaptic("success");
    const screenRecord: ScreenTimeRecord = {
      id: `screen-${new Date().toISOString().slice(0, 10)}`,
      screenMinutes: screenMinutesToday,
      limitMinutes: screenLimitMinutes,
      productivityMinutes: Math.round(screenMinutesToday * 0.45),
      socialMinutes: Math.round(screenMinutesToday * 0.27),
      mediaMinutes: Math.round(screenMinutesToday * 0.21),
      wellbeingMinutes: Math.round(screenMinutesToday * 0.07),
      focusMode: focusModeActive,
      windDown: windDownActive,
      loggedAt: new Date().toISOString(),
    };

    await saveScreenTime(screenRecord);
    await storage.setItem(
      "lumen_digital_wellbeing",
      JSON.stringify({
        screenMinutes: screenMinutesToday,
        screenLimitMinutes,
        focusModeActive,
        windDownActive,
      })
    );
    setShowScreenTimeModal(false);
    Alert.alert("Wellbeing Calibrated", `Daily screen limit set to ${screenLimitMinutes / 60}h.`);
  };

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        {/* Top-Left: Menu Trigger shifted to top left as requested */}
        <View style={styles.brandRow}>
          <Pressable
            onPress={openLeftMenu}
            accessibilityLabel="Open Navigation Slide Menu"
            style={styles.hamburgerBtn}
          >
            <Menu size={20} color="#10b981" />
          </Pressable>
          <Image
            source={require("../../assets/icon.png")}
            style={{ width: 26, height: 26, borderRadius: 7, marginRight: 8 }}
            resizeMode="cover"
          />
          <Text style={styles.brandTitle}>Lumen OS</Text>
        </View>

        <View style={styles.topRightActions}>
          {/* Wearables sync status chip */}
          <Pressable
            style={styles.syncChip}
            onPress={handleSyncHealth}
            disabled={syncStatus.status === "syncing"}
          >
            <ShieldCheck size={12} color="#10b981" />
            <Text style={styles.syncChipText}>
              {syncStatus.status === "syncing"
                ? "Syncing..."
                : syncStatus.lastSyncedAt
                  ? "Wearables Live"
                  : "Sync Wearable"}
            </Text>
          </Pressable>

          {/* Top-Right Profile / Avatar Button (kept for later use as requested) */}
          <Pressable 
            onPress={openRightMenu}
            accessibilityLabel="Open Profile Drawer"
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {userName ? userName[0].toUpperCase() : "A"}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#10b981"
          />
        }
      >
        {/* ========================================================= */}
        {/* HERO SECTION: Greeting + Circular Score + Quick Actions   */}
        {/* ========================================================= */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextCol}>
              <Text style={styles.greetingTitle}>
                {greetingTime},{"\n"}
                <Text style={styles.greetingName}>{userName}</Text>
              </Text>
              <Text style={styles.energySubtext}>{energySubtext}</Text>
            </View>

            {/* Circular Score Gauge */}
            <CircularScoreRing score={dynamicOverallScore} />
          </View>

          {/* Quick Action Pills matching reference */}
          <View style={styles.actionPillsRow}>
            <Pressable
              style={styles.pillMeal}
              onPress={() => {
                triggerHaptic();
                router.push("/(tabs)/nutrition");
              }}
            >
              <Utensils size={14} color="#f59e0b" />
              <Text style={styles.pillMealText}>Log Meal</Text>
            </Pressable>

            <Pressable
              style={styles.pillActivity}
              onPress={() => {
                triggerHaptic();
                router.push("/(tabs)/activity");
              }}
            >
              <Zap size={14} color="#10b981" />
              <Text style={styles.pillActivityText}>Track Activity</Text>
            </Pressable>
          </View>
        </View>

        {/* ========================================================= */}
        {/* AI COACH PROACTIVE CARD (Matching Reference)             */}
        {/* ========================================================= */}
        <View style={styles.aiInsightCard}>
          <View style={styles.aiInsightHeader}>
            <View style={styles.aiBrainIconCircle}>
              <Brain size={16} color="#f59e0b" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.aiInsightTitle}>{aiInsightTitle}</Text>
              <Text style={styles.aiInsightDesc} numberOfLines={3}>
                {aiInsightDesc}
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.aiActionBtn}
            onPress={() => {
              triggerHaptic();
              router.push("/(tabs)/nutrition");
            }}
          >
            <Text style={styles.aiActionBtnText}>Log a protein-rich meal</Text>
            <ChevronRight size={14} color="#f59e0b" />
          </Pressable>
        </View>

        {/* ========================================================= */}
        {/* 4 CORE PILLAR SCORE CARDS (2x2 Fully Functional Grid)     */}
        {/* ========================================================= */}
        <View style={styles.pillarGrid}>
          {/* 1. Nutrition Card -> Press opens Nutrition tracker */}
          <Pressable
            style={({ pressed }) => [
              styles.pillarCard,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => {
              triggerHaptic();
              router.push("/(tabs)/nutrition");
            }}
          >
            <View style={styles.pillarTopRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Utensils size={14} color="#10b981" />
                <Text style={styles.pillarTitle}>Nutrition</Text>
              </View>
              <Text style={[styles.pillarScore, { color: "#10b981" }]}>
                {dynamicNutritionScore > 0 ? dynamicNutritionScore.toFixed(1) : "0.0"}
              </Text>
            </View>
            <View style={styles.pillarBarTrack}>
              <View
                style={[
                  styles.pillarBarFill,
                  {
                    width: `${Math.min(100, Math.max(10, dynamicNutritionScore * 10))}%`,
                    backgroundColor: "#10b981",
                  },
                ]}
              />
            </View>
            <Text style={styles.pillarSubtitle} numberOfLines={1}>
              {dynamicNutritionLabel}
            </Text>
          </Pressable>

          {/* 2. Sleep Card -> Press opens Sleep Logging Modal */}
          <Pressable
            style={({ pressed }) => [
              styles.pillarCard,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => {
              triggerHaptic();
              setShowSleepModal(true);
            }}
          >
            <View style={styles.pillarTopRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Moon size={14} color="#f59e0b" />
                <Text style={styles.pillarTitle}>Sleep</Text>
              </View>
              <Text style={[styles.pillarScore, { color: "#f59e0b" }]}>
                {dynamicSleepScore > 0 ? dynamicSleepScore.toFixed(1) : "0.0"}
              </Text>
            </View>
            <View style={styles.pillarBarTrack}>
              <View
                style={[
                  styles.pillarBarFill,
                  {
                    width: `${Math.min(100, Math.max(10, dynamicSleepScore * 10))}%`,
                    backgroundColor: "#f59e0b",
                  },
                ]}
              />
            </View>
            <Text style={styles.pillarSubtitle} numberOfLines={1}>
              {dynamicSleepLabel}
            </Text>
          </Pressable>

          {/* 3. Activity Card -> Press opens Activity tracker */}
          <Pressable
            style={({ pressed }) => [
              styles.pillarCard,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => {
              triggerHaptic();
              router.push("/(tabs)/activity");
            }}
          >
            <View style={styles.pillarTopRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Activity size={14} color="#06b6d4" />
                <Text style={styles.pillarTitle}>Activity</Text>
              </View>
              <Text style={[styles.pillarScore, { color: "#06b6d4" }]}>
                {dynamicActivityScore > 0 ? dynamicActivityScore.toFixed(1) : "0.0"}
              </Text>
            </View>
            <View style={styles.pillarBarTrack}>
              <View
                style={[
                  styles.pillarBarFill,
                  {
                    width: `${Math.min(100, Math.max(10, dynamicActivityScore * 10))}%`,
                    backgroundColor: "#06b6d4",
                  },
                ]}
              />
            </View>
            <Text style={styles.pillarSubtitle} numberOfLines={1}>
              {dynamicActivityLabel}
            </Text>
          </Pressable>

          {/* 4. Screen Time Card -> Press opens Digital Wellbeing Modal */}
          <Pressable
            style={({ pressed }) => [
              styles.pillarCard,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => {
              triggerHaptic();
              setShowScreenTimeModal(true);
            }}
          >
            <View style={styles.pillarTopRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Smartphone size={14} color="#a855f7" />
                <Text style={styles.pillarTitle}>Screen</Text>
              </View>
              <Text style={[styles.pillarScore, { color: "#a855f7" }]}>
                {dynamicScreenScore.toFixed(1)}
              </Text>
            </View>
            <View style={styles.pillarBarTrack}>
              <View
                style={[
                  styles.pillarBarFill,
                  {
                    width: `${Math.min(100, dynamicScreenScore * 10)}%`,
                    backgroundColor: "#a855f7",
                  },
                ]}
              />
            </View>
            <Text style={styles.pillarSubtitle} numberOfLines={1}>
              {dynamicScreenLabel}
            </Text>
          </Pressable>
        </View>

        {/* ========================================================= */}
        {/* HYDRATION WIDGET (Positioned below Nutrient, Sleep, Activity, Screen) */}
        {/* ========================================================= */}
        <View style={styles.hydrationCardWide}>
          <View style={styles.hydrationTopRow}>
            <View style={styles.dropCircle}>
              <Droplet size={18} color="#06b6d4" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.bioCardLabel}>Hydration</Text>
                <Text style={[styles.pillarScore, { color: "#06b6d4" }]}>
                  {dynamicHydrationScore > 0 ? dynamicHydrationScore.toFixed(1) : "0.0"}
                </Text>
              </View>
              <Text style={styles.bioCardValue}>{waterCups} / 8 cups ({waterCups * 250} ml)</Text>
              <Text style={styles.pillarSubtitle}>{dynamicHydrationLabel}</Text>
            </View>
          </View>

          {/* Quick Increment/Decrement Buttons & Progress Bar */}
          <View style={styles.waterControlsRowWide}>
            <View style={styles.waterBarTrack}>
              <View
                style={[
                  styles.waterBarFill,
                  { width: `${Math.min(100, (waterCups / 8) * 100)}%` },
                ]}
              />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Pressable style={styles.waterBtn} onPress={decrementWater}>
                <Minus size={14} color="#94a3b8" />
              </Pressable>
              <Text style={styles.waterTargetText}>Target: 8 cups</Text>
              <Pressable style={styles.waterBtn} onPress={incrementWater}>
                <Plus size={14} color="#06b6d4" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* ACTIVE STREAKS (Horizontal Carousel)                      */}
        {/* ========================================================= */}
        <View style={styles.sectionTitleRow}>
          <Flame size={16} color="#f97316" />
          <Text style={styles.sectionHeaderTitle}>Active Streaks</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.streaksCarousel}
        >
          {/* Nutrition Streak */}
          <View style={styles.streakCard}>
            <View style={styles.streakBadgeCol}>
              <Text style={styles.streakNumber}>
                {streaksList.find((s) => s.category === "nutrition")?.days ?? (localMealsCount > 0 ? 1 : 0)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.streakCardTitle}>Nutrition</Text>
              <Text style={styles.streakCardMsg} numberOfLines={2}>
                {streaksList.find((s) => s.category === "nutrition")?.message ??
                  "Keep logging — consistency builds habits"}
              </Text>
            </View>
          </View>

          {/* Sleep Streak */}
          <View style={styles.streakCard}>
            <View style={styles.streakBadgeCol}>
              <Text style={styles.streakNumber}>
                {streaksList.find((s) => s.category === "sleep")?.days ?? (hasLoggedSleepToday ? 1 : 0)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.streakCardTitle}>Sleep</Text>
              <Text style={styles.streakCardMsg} numberOfLines={2}>
                {streaksList.find((s) => s.category === "sleep")?.message ??
                  "Anchor tonight's bedtime to maintain circadian rhythm"}
              </Text>
            </View>
          </View>

          {/* Activity Streak */}
          <View style={styles.streakCard}>
            <View style={styles.streakBadgeCol}>
              <Text style={styles.streakNumber}>
                {streaksList.find((s) => s.category === "activity")?.days ?? 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.streakCardTitle}>Activity</Text>
              <Text style={styles.streakCardMsg} numberOfLines={2}>
                {streaksList.find((s) => s.category === "activity")?.message ??
                  "Two short walks today keeps the streak alive"}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* ========================================================= */}
        {/* 7-DAY SCORE TREND CHART (Matching Reference)              */}
        {/* ========================================================= */}
        <View style={styles.trendContainerCard}>
          <View style={styles.trendHeaderRow}>
            <Text style={styles.trendCardTitle}>7-Day Score Trend</Text>
            <View style={styles.trendScoreTag}>
              <Text style={styles.trendScoreTagVal}>{dynamicOverallScore.toFixed(1)} / 10</Text>
            </View>
          </View>

          <Trend7DayChart overallScore={dynamicOverallScore} />
        </View>

        {/* ========================================================= */}
        {/* CALORIES & MACRONUTRIENTS CARD                           */}
        {/* ========================================================= */}
        <View style={styles.caloriesMacroCardWide}>
          <View style={styles.calTopRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Utensils size={14} color="#f59e0b" />
              <Text style={styles.bioCardLabel}>Calories & Macronutrients</Text>
            </View>
            <Text style={styles.calValue}>
              {caloriesConsumed} / {caloriesTarget} kcal
            </Text>
          </View>

          {/* Calorie bar */}
          <View style={styles.calBarTrack}>
            <View
              style={[
                styles.calBarFill,
                { width: `${Math.min(100, caloriesPercent)}%`, backgroundColor: "#f59e0b" },
              ]}
            />
          </View>

          {/* Macro split breakdown */}
          <View style={styles.macrosRow}>
            <View style={styles.macroItem}>
              <Text style={styles.macroLabel}>Protein</Text>
              <Text style={styles.macroVal}>{proteinGrams}g</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroLabel}>Carbs</Text>
              <Text style={styles.macroVal}>{carbsGrams}g</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroLabel}>Fat</Text>
              <Text style={styles.macroVal}>{fatGrams}g</Text>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* TOTAL ACTIVE CALORIE BURN BANNER (Steps + Workouts)       */}
        {/* ========================================================= */}
        <View style={styles.activeBurnBanner}>
          <View style={styles.burnBannerTopRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Flame size={18} color="#f59e0b" />
              <Text style={styles.burnBannerTitle}>Total Active Burn</Text>
            </View>
            <Text style={styles.burnBannerTotal}>{totalActiveCaloriesBurned} kcal</Text>
          </View>

          <View style={styles.burnBannerSubRow}>
            <Text style={styles.burnBannerSubText}>
              🚶 Steps:{" "}
              <Text style={{ color: "#38bdf8", fontWeight: "bold" }}>
                {stepsCaloriesBurned} kcal
              </Text>{" "}
              ({stepsCount.toLocaleString()} steps)
            </Text>
            <Text style={styles.burnBannerSubText}>
              ⚡ Workouts:{" "}
              <Text style={{ color: "#10b981", fontWeight: "bold" }}>
                {workoutCaloriesBurned} kcal
              </Text>
            </Text>
          </View>
        </View>

        {/* ========================================================= */}
        {/* AI MORNING BRIEFING & VOICE PLAYBACK                      */}
        {/* ========================================================= */}
        <GlassCard style={styles.briefingCard}>
          <View style={styles.briefingHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Sparkles size={16} color="#10b981" />
              <Text style={styles.briefingTitle}>AI Bio-Intelligence Briefing</Text>
            </View>
            <Pressable onPress={toggleBriefingVoice} style={styles.voiceBtn}>
              {isSpeakingBriefing ? (
                <VolumeX size={16} color="#10b981" />
              ) : (
                <Volume2 size={16} color="#10b981" />
              )}
            </Pressable>
          </View>
          <Text style={styles.briefingBody}>{briefingText}</Text>
        </GlassCard>

        {/* Bottom space for safe area */}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ========================================================= */}
      {/* SLEEP TRACKER & RECOVERY MODAL                            */}
      {/* ========================================================= */}
      <Modal
        visible={showSleepModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSleepModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.modalIconBox, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                  <Moon size={18} color="#f59e0b" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Sleep & Recovery Session</Text>
                  <Text style={styles.modalSub}>Log hours and nightly restoration</Text>
                </View>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setShowSleepModal(false)}>
                <X size={16} color="#94a3b8" />
              </Pressable>
            </View>

            {/* Quick Hours Selector */}
            <Text style={styles.modalSectionLabel}>DURATION SLEPT</Text>
            <View style={styles.hoursChipsRow}>
              {[6.0, 7.0, 7.5, 8.0, 8.5, 9.0].map((h) => {
                const isSelected = sleepHoursLogged === h;
                return (
                  <Pressable
                    key={h}
                    style={[styles.hoursChip, isSelected && styles.hoursChipActive]}
                    onPress={() => {
                      triggerHaptic();
                      setSleepHoursLogged(h);
                    }}
                  >
                    <Text style={[styles.hoursChipText, isSelected && styles.hoursChipTextActive]}>
                      {h}h
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Sleep Quality Selector */}
            <Text style={[styles.modalSectionLabel, { marginTop: 16 }]}>SLEEP QUALITY</Text>
            <View style={styles.qualityGrid}>
              {[
                { id: "Restorative", desc: "Woke up fully charged" },
                { id: "Deep", desc: "Long undisturbed rest" },
                { id: "Normal", desc: "Standard sleep cycle" },
                { id: "Restless", desc: "Woke up multiple times" },
              ].map((q) => {
                const isSelected = sleepQuality === q.id;
                return (
                  <Pressable
                    key={q.id}
                    style={[styles.qualityCard, isSelected && styles.qualityCardActive]}
                    onPress={() => {
                      triggerHaptic();
                      setSleepQuality(q.id);
                    }}
                  >
                    <Text style={[styles.qualityTitle, isSelected && styles.qualityTitleActive]}>
                      {q.id}
                    </Text>
                    <Text style={styles.qualityDesc}>{q.desc}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Stage breakdown telemetry */}
            <View style={styles.telemetryCard}>
              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>Estimated Deep Sleep</Text>
                <Text style={styles.telemetryVal}>
                  {Math.round(sleepHoursLogged * 0.22 * 10) / 10}h (22%)
                </Text>
              </View>
              <View style={styles.telemetryRow}>
                <Text style={styles.telemetryLabel}>Estimated REM Sleep</Text>
                <Text style={styles.telemetryVal}>
                  {Math.round(sleepHoursLogged * 0.25 * 10) / 10}h (25%)
                </Text>
              </View>
            </View>

            {/* Save Button */}
            <Pressable style={styles.modalPrimaryBtn} onPress={handleSaveSleepSession}>
              <Check size={16} color="#050b08" style={{ marginRight: 6 }} />
              <Text style={styles.modalPrimaryBtnText}>Save Sleep Session</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* DIGITAL WELLBEING & SCREEN TIME MODAL                     */}
      {/* ========================================================= */}
      <Modal
        visible={showScreenTimeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowScreenTimeModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.modalIconBox, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
                  <Smartphone size={18} color="#a855f7" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Digital Wellbeing Telemetry</Text>
                  <Text style={styles.modalSub}>Real phone screen usage & balance</Text>
                </View>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setShowScreenTimeModal(false)}>
                <X size={16} color="#94a3b8" />
              </Pressable>
            </View>

            {/* Today's Usage Banner */}
            <View style={styles.screenUsageCard}>
              <Text style={styles.screenUsageLabel}>TODAY'S SCREEN TIME</Text>
              <View style={styles.screenTimeLargeRow}>
                <Text style={styles.screenTimeLarge}>
                  {Math.floor(screenMinutesToday / 60)}h {screenMinutesToday % 60}m
                </Text>
                <View
                  style={[
                    styles.screenStatusBadge,
                    screenMinutesToday === 0
                      ? { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.3)" }
                      : dynamicScreenScore >= 8.5
                      ? { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.3)" }
                      : { backgroundColor: "rgba(239, 68, 68, 0.15)", borderColor: "rgba(239, 68, 68, 0.3)" },
                  ]}
                >
                  <Text
                    style={[
                      styles.screenStatusBadgeText,
                      screenMinutesToday === 0
                        ? { color: "#10b981" }
                        : dynamicScreenScore >= 8.5
                        ? { color: "#10b981" }
                        : { color: "#ef4444" },
                    ]}
                  >
                    {screenMinutesToday === 0
                      ? "Standby • Ready"
                      : dynamicScreenScore >= 8.5
                      ? "Balanced"
                      : "Screen Heavy"}
                  </Text>
                </View>
              </View>

              {/* Progress bar against limit */}
              <View style={styles.screenBarTrack}>
                <View
                  style={[
                    styles.screenBarFill,
                    {
                      width: `${Math.min(100, (screenMinutesToday / screenLimitMinutes) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.screenLimitSub}>
                Limit: {Math.floor(screenLimitMinutes / 60)}h 00m daily
              </Text>
            </View>

            {/* Phone Accessibility & Usage Permission Card */}
            <View style={styles.permissionCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ShieldCheck size={18} color="#a855f7" />
                <Text style={styles.permissionTitle}>Phone Usage & Accessibility Access</Text>
              </View>
              <Text style={styles.permissionDesc}>
                Allow Lumen access to Android Accessibility & Usage Stats to automatically track screen time directly from your device.
              </Text>
              <View style={{ gap: 8 }}>
                <Pressable
                  style={styles.permissionBtn}
                  onPress={requestAccessibilityAndUsagePermission}
                >
                  <Text style={styles.permissionBtnText}>🛡️ Grant Phone Access (Guided)</Text>
                </Pressable>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    style={[styles.permissionBtnSecondary, { flex: 1 }]}
                    onPress={openAccessibilitySettings}
                  >
                    <Text style={styles.permissionBtnSecondaryText}>Accessibility Settings</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.permissionBtnSecondary, { flex: 1 }]}
                    onPress={openUsageAccessSettings}
                  >
                    <Text style={styles.permissionBtnSecondaryText}>Usage Access</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* App Category Breakdown */}
            <Text style={styles.modalSectionLabel}>CATEGORY TELEMETRY</Text>
            {screenMinutesToday === 0 ? (
              <View style={styles.emptyCategoryCard}>
                <Text style={styles.emptyCategoryText}>
                  No screen time recorded yet today. Tap "Grant Phone Access" above or use apps on your phone to start tracking.
                </Text>
              </View>
            ) : (
              <View style={styles.categoryList}>
                <View style={styles.categoryRow}>
                  <Text style={styles.categoryName}>💼 Productivity & Work</Text>
                  <Text style={styles.categoryMins}>
                    {Math.floor((screenMinutesToday * 0.45) / 60)}h {Math.round((screenMinutesToday * 0.45) % 60)}m (45%)
                  </Text>
                </View>
                <View style={styles.categoryRow}>
                  <Text style={styles.categoryName}>💬 Social & Messages</Text>
                  <Text style={styles.categoryMins}>
                    {Math.floor((screenMinutesToday * 0.3) / 60)}h {Math.round((screenMinutesToday * 0.3) % 60)}m (30%)
                  </Text>
                </View>
                <View style={styles.categoryRow}>
                  <Text style={styles.categoryName}>🎬 Video & Media</Text>
                  <Text style={styles.categoryMins}>
                    {Math.floor((screenMinutesToday * 0.2) / 60)}h {Math.round((screenMinutesToday * 0.2) % 60)}m (20%)
                  </Text>
                </View>
                <View style={styles.categoryRow}>
                  <Text style={styles.categoryName}>⚡ Lumen Health</Text>
                  <Text style={styles.categoryMins}>
                    {Math.floor((screenMinutesToday * 0.05) / 60)}h {Math.round((screenMinutesToday * 0.05) % 60)}m (5%)
                  </Text>
                </View>
              </View>
            )}

            {/* Daily Target Limit Selector */}
            <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>DAILY SCREEN LIMIT</Text>
            <View style={styles.hoursChipsRow}>
              {[120, 180, 240, 300].map((mins) => {
                const isSelected = screenLimitMinutes === mins;
                return (
                  <Pressable
                    key={mins}
                    style={[styles.hoursChip, isSelected && styles.hoursChipActive]}
                    onPress={() => {
                      triggerHaptic();
                      setScreenLimitMinutes(mins);
                    }}
                  >
                    <Text style={[styles.hoursChipText, isSelected && styles.hoursChipTextActive]}>
                      {mins / 60}h limit
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Focus Mode & Wind Down Switches */}
            <View style={styles.wellbeingSwitchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Focus Mode</Text>
                <Text style={styles.switchDesc}>Mute non-critical notifications</Text>
              </View>
              <Switch
                value={focusModeActive}
                onValueChange={(val) => {
                  triggerHaptic();
                  setFocusModeActive(val);
                }}
                trackColor={{ false: "#1e293b", true: "#a855f7" }}
                thumbColor={focusModeActive ? "#050b08" : "#94a3b8"}
              />
            </View>

            {/* Save Button */}
            <Pressable style={styles.modalPrimaryBtn} onPress={handleSaveWellbeing}>
              <Check size={16} color="#050b08" style={{ marginRight: 6 }} />
              <Text style={styles.modalPrimaryBtnText}>Save Wellbeing Settings</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050b08",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 54 : 44,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hamburgerBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10b981",
  },
  brandTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  syncChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  syncChipText: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "700",
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#13231c",
    borderWidth: 1.5,
    borderColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#10b981",
    fontSize: 14,
    fontWeight: "bold",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // HERO CARD (Matches Reference)
  heroCard: {
    backgroundColor: "#0d1813",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  greetingTitle: {
    color: "#cbd5e1",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  greetingName: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "900",
  },
  energySubtext: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  scoreNumber: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  scoreLabel: {
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  actionPillsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  pillMeal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(245, 158, 11, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  pillMealText: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "700",
  },
  pillActivity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  pillActivityText: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "700",
  },

  // AI INSIGHT CARD (Matches Reference)
  aiInsightCard: {
    backgroundColor: "#121b16",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    marginBottom: 16,
  },
  aiInsightHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  aiBrainIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  aiInsightTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  aiInsightDesc: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  aiActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  aiActionBtnText: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "700",
  },

  // 4 PILLARS (2x2 Grid)
  pillarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  pillarCard: {
    width: (SCREEN_WIDTH - 42) / 2,
    backgroundColor: "#0d1612",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  pillarTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pillarTitle: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "700",
  },
  pillarScore: {
    fontSize: 15,
    fontWeight: "900",
  },
  pillarBarTrack: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 2,
    marginVertical: 10,
    overflow: "hidden",
  },
  pillarBarFill: {
    height: 4,
    borderRadius: 2,
  },
  pillarSubtitle: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },

  // ACTIVE STREAKS SECTION
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  streaksCarousel: {
    gap: 12,
    paddingBottom: 4,
    marginBottom: 20,
  },
  streakCard: {
    width: 240,
    backgroundColor: "#0e1814",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(249, 115, 22, 0.2)",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  streakBadgeCol: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(249, 115, 22, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  streakNumber: {
    color: "#f97316",
    fontSize: 18,
    fontWeight: "900",
  },
  streakCardTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  streakCardMsg: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },

  // 7-DAY SCORE TREND CHART
  trendContainerCard: {
    backgroundColor: "#0c1511",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.15)",
    marginBottom: 20,
  },
  trendHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  trendCardTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  trendScoreTag: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  trendScoreTagVal: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "800",
  },
  trendChartBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 125,
  },
  yAxis: {
    justifyContent: "space-between",
    height: 105,
    paddingRight: 8,
    alignItems: "flex-end",
  },
  yAxisText: {
    color: "#475569",
    fontSize: 9,
    fontWeight: "600",
  },
  xAxisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  xAxisText: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
  },

  // HYDRATION & MACROS
  biometricsSplitRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  hydrationCard: {
    flex: 1,
    backgroundColor: "#0c1511",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.15)",
    justifyContent: "space-between",
  },
  hydrationTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dropCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(6, 182, 212, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  bioCardLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  bioCardValue: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  waterControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    backgroundColor: "rgba(6, 182, 212, 0.06)",
    borderRadius: 12,
    padding: 6,
  },
  waterBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#16232b",
    alignItems: "center",
    justifyContent: "center",
  },
  waterTargetText: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
  },
  caloriesMacroCard: {
    flex: 1,
    backgroundColor: "#0c1511",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.15)",
    justifyContent: "space-between",
  },
  calTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  calValue: {
    color: "#f59e0b",
    fontSize: 11,
    fontWeight: "800",
  },
  calBarTrack: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 2,
    marginVertical: 10,
    overflow: "hidden",
  },
  calBarFill: {
    height: 4,
    borderRadius: 2,
  },
  macrosRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  macroItem: {
    alignItems: "center",
  },
  macroLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "600",
  },
  macroVal: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },

  // ACTIVE BURN BANNER
  activeBurnBanner: {
    backgroundColor: "#101a14",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    marginBottom: 20,
  },
  burnBannerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  burnBannerTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "800",
  },
  burnBannerTotal: {
    color: "#f59e0b",
    fontSize: 16,
    fontWeight: "900",
  },
  burnBannerSubRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  burnBannerSubText: {
    color: "#94a3b8",
    fontSize: 11,
  },

  // BRIEFING CARD
  briefingCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 10,
  },
  briefingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  briefingTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "800",
  },
  voiceBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  briefingBody: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
  },

  // MODAL STYLING
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalPanel: {
    backgroundColor: "#070c0a",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 44 : 28,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  modalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#f8fafc",
  },
  modalSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  modalSectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 1,
    marginBottom: 8,
  },
  hoursChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  hoursChip: {
    backgroundColor: "#0d1612",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  hoursChipActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10b981",
  },
  hoursChipText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
  },
  hoursChipTextActive: {
    color: "#10b981",
  },
  qualityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  qualityCard: {
    width: "48%",
    backgroundColor: "#0d1612",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    padding: 10,
  },
  qualityCardActive: {
    borderColor: "#f59e0b",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
  },
  qualityTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  qualityTitleActive: {
    color: "#f59e0b",
  },
  qualityDesc: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 2,
  },
  telemetryCard: {
    backgroundColor: "#0b130f",
    borderRadius: 14,
    padding: 12,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    gap: 6,
  },
  telemetryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  telemetryLabel: {
    color: "#64748b",
    fontSize: 12,
  },
  telemetryVal: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "700",
  },
  modalPrimaryBtn: {
    backgroundColor: "#10b981",
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  modalPrimaryBtnText: {
    color: "#050b08",
    fontSize: 14,
    fontWeight: "800",
  },

  // DIGITAL WELLBEING SPECIFIC
  screenUsageCard: {
    backgroundColor: "#0d1612",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.25)",
    marginBottom: 14,
  },
  screenUsageLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#a855f7",
    letterSpacing: 1,
  },
  screenTimeLargeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  screenTimeLarge: {
    fontSize: 26,
    fontWeight: "900",
    color: "#f8fafc",
  },
  screenStatusBadge: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  screenStatusBadgeText: {
    color: "#a855f7",
    fontSize: 11,
    fontWeight: "700",
  },
  screenBarTrack: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 3,
    marginTop: 12,
    overflow: "hidden",
  },
  screenBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#a855f7",
  },
  screenLimitSub: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 6,
  },
  categoryList: {
    backgroundColor: "#0d1612",
    borderRadius: 14,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  categoryName: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "600",
  },
  categoryMins: {
    color: "#a855f7",
    fontSize: 12,
    fontWeight: "700",
  },
  wellbeingSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0d1612",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginTop: 8,
    marginBottom: 4,
  },
  switchTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
  },
  switchDesc: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  hydrationCardWide: {
    backgroundColor: "#0c1511",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.2)",
    marginBottom: 20,
  },
  waterControlsRowWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 12,
  },
  waterBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  waterBarFill: {
    height: 6,
    backgroundColor: "#06b6d4",
    borderRadius: 3,
  },
  caloriesMacroCardWide: {
    backgroundColor: "#0c1511",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    marginBottom: 20,
  },
  permissionCard: {
    backgroundColor: "rgba(168, 85, 247, 0.1)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.25)",
    marginBottom: 14,
  },
  permissionTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  permissionDesc: {
    color: "#cbd5e1",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
    marginBottom: 10,
  },
  permissionBtn: {
    backgroundColor: "#a855f7",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  permissionBtnText: {
    color: "#050b08",
    fontSize: 12,
    fontWeight: "800",
  },
  permissionBtnSecondary: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  permissionBtnSecondaryText: {
    color: "#d8b4fe",
    fontSize: 11,
    fontWeight: "700",
  },
  emptyCategoryCard: {
    backgroundColor: "#0d1612",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 10,
    alignItems: "center",
  },
  emptyCategoryText: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
