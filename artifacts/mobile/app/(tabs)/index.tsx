import THEME from "@/constants/theme";
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
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
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  AlertCircle,
  Timer,
  Bell,
  BellOff,
  Wind,
  Star,
  Layers,
  Trash2,
  Info,
  Trophy,
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
import { AmbientAtmosphere } from "@/components/AmbientAtmosphere";
import { speakText, stopSpeaking } from "@/services/voice";
import { syncHealthData, getLastSyncStatus, HealthSyncStatus } from "@/services/health";
import { storage } from "@/services/storage";
import { useSlideMenu } from "@/context/SlideMenuContext";
import { syncNotificationSchedules } from "@/services/notifications";
import { proactiveAlertEngine } from "@/services/proactiveAlertEngine";
import {
  getMeals,
  getWorkouts,
  getLatestSleep,
  saveSleepSession,
  getScreenTimeToday,
  saveScreenTime,
  getHydrationToday,
  setHydrationToday,
  getFocusSessionsToday,
  getWellbeingConfig,
  saveWellbeingConfig,
  getDailyHealthRecordsForRange,
  DailyHealthRecord,
  SleepRecord,
  ScreenTimeRecord,
  FocusSessionRecord,
  WellbeingConfigRecord,
} from "@/services/db";
import {
  computeAndSaveDailySnapshot,
  formatDateKey,
  seedHistoricalHealthMetricsIfEmpty,
  checkDailyHealthScoreNotification,
} from "@/services/dailyHealthMetrics";
import {
  digitalWellbeingService,
  FOCUS_PRESETS,
  DISTRACTING_CATEGORIES,
  LiveFocusState,
  FocusSessionType,
  getRandomMindfulQuote,
} from "@/services/digitalWellbeingService";
import { useScreenTime } from "@/hooks/useScreenTime";
import { useHydration } from "@/hooks/useHydration";
import { fitnessWatchSensor } from "@/services/fitnessWatchSensor";
import { evaluateAchievements, GamificationProfile } from "@/services/achievements";
import { getStoredGoogleUser } from "@/services/googleAuth";
import { authService } from "@/services/authService";
import { dailyRolloverService } from "@/services/dailyRolloverService";
import { nativeStepCounter } from "@/services/nativeStepCounter";
import { getNutritionTotalsForDate, subscribeNutritionChanges } from "@/services/nutritionSync";
import {
  SleepModal,
  BreathingModal,
  ReflectionModal,
  ScreenTimeModal,
  HydrationModal,
} from "@/components/modals";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Helper to extract clean first name for personal greetings (e.g., "Sayak Mondal" -> "Sayak")
const extractFirstName = (rawName: string | null | undefined): string => {
  if (!rawName) return "";
  const trimmed = rawName.trim();
  if (!trimmed || trimmed.toLowerCase() === "user" || trimmed.toLowerCase() === "lumen member") {
    return "";
  }
  const first = trimmed.split(/\s+/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
};

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
            <Stop offset="0%" stopColor="#f97316" />
            <Stop offset="100%" stopColor="#10b981" />
          </LinearGradient>
        </Defs>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(180, 205, 192, 0.4)"
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
function Trend7DayChart({
  overallScore,
  chartData,
}: {
  overallScore: number;
  chartData?: { dayLabel: string; score: number }[];
}) {
  const days =
    chartData && chartData.length === 7
      ? chartData.map((d) => d.dayLabel)
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const dataPoints =
    chartData && chartData.length === 7
      ? chartData.map((d, idx) => (idx === 6 ? (overallScore > 0 ? overallScore : d.score) : d.score))
      : [0, 0, 0, 0, 0, 0, overallScore];

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

          <Line x1="0" y1="10" x2={chartWidth} y2="10" stroke="rgba(200, 218, 210, 0.3)" strokeDasharray="4 4" />
          <Line x1="0" y1="45" x2={chartWidth} y2="45" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <Line x1="0" y1="80" x2={chartWidth} y2="80" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <Line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="rgba(200, 218, 210, 0.4)" />

          <Path d={areaPath} fill="url(#trendGrad)" />
          <Path d={linePath} stroke="#10b981" strokeWidth={2.5} fill="none" />

          {points.map((p, idx) => (
            <Circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r={idx === points.length - 1 ? 5 : 3}
              fill={idx === points.length - 1 ? "#06b6d4" : "#10b981"}
              stroke="#ffffff"
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

  // Hydration Mastery interactive state
  const [showHydrationModal, setShowHydrationModal] = useState(false);
  const [selectedHydrationBeverage, setSelectedHydrationBeverage] = useState("water");
  const [customWaterInput, setCustomWaterInput] = useState("");
  const [hydrationModalTab, setHydrationModalTab] = useState<"overview" | "roadmap" | "urine">("overview");

  // Wearable Health sync states
  const [syncStatus, setSyncStatus] = useState<HealthSyncStatus>({
    lastSyncedAt: null,
    status: "idle",
    syncedMetrics: [],
  });

  // Local storage meals for live nutrition calculation
  const [localMealsCount, setLocalMealsCount] = useState(0);
  const [localCaloriesConsumed, setLocalCaloriesConsumed] = useState(0);
  const [localProteinGrams, setLocalProteinGrams] = useState(0);
  const [localCarbsGrams, setLocalCarbsGrams] = useState(0);
  const [localFatGrams, setLocalFatGrams] = useState(0);
  const [showFreshDayToast, setShowFreshDayToast] = useState(false);

  // Sleep Modal & interactive state
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [sleepHoursLogged, setSleepHoursLogged] = useState(0);
  const [sleepQuality, setSleepQuality] = useState("Restorative");
  const [hasLoggedSleepToday, setHasLoggedSleepToday] = useState(false);

  // Screen Time & Digital Wellbeing interactive state (Mindful architecture)
  const [showScreenTimeModal, setShowScreenTimeModal] = useState(false);
  const [screenMinutesToday, setScreenMinutesToday] = useState(0);
  const [screenLimitMinutes, setScreenLimitMinutes] = useState(240); // 4h 00m
  const [focusModeActive, setFocusModeActive] = useState(false);
  const [windDownActive, setWindDownActive] = useState(false);
  const [wellbeingTab, setWellbeingTab] = useState<"usage" | "focus" | "limits">("usage");
  const [liveFocus, setLiveFocus] = useState<LiveFocusState>(digitalWellbeingService.getState());
  const [selectedFocusPreset, setSelectedFocusPreset] = useState<FocusSessionType>("pomodoro");
  const [selectedFocusMinutes, setSelectedFocusMinutes] = useState<number>(25);
  const [blockedCategories, setBlockedCategories] = useState<string[]>(["social", "video", "games"]);
  const [isBreathingMode, setIsBreathingMode] = useState<boolean>(false);
  const [breathingSeconds, setBreathingSeconds] = useState<number>(60);
  const [showReflectionModal, setShowReflectionModal] = useState<boolean>(false);
  const [reflectionScore, setReflectionScore] = useState<number>(5);
  const [reflectionNote, setReflectionNote] = useState<string>("");
  const [todayFocusSessions, setTodayFocusSessions] = useState<FocusSessionRecord[]>([]);
  const [bedtimeHour, setBedtimeHour] = useState<string>("22:30");
  const [wakeHour, setWakeHour] = useState<string>("07:00");
  const [dndAutoToggle, setDndAutoToggle] = useState<boolean>(true);
  const [gamification, setGamification] = useState<GamificationProfile | null>(null);
  const [trend7DaysData, setTrend7DaysData] = useState<{ dayLabel: string; score: number }[]>([]);

  // Native Screen Time & Digital Wellbeing telemetry hook (Mindful Engine)
  const {
    telemetry: screenTelemetry,
    permissionGranted: usagePermissionGranted,
    isRefreshing: isScreenRefreshing,
    refreshScreenTime,
    requestUsagePermission,
  } = useScreenTime();

  useEffect(() => {
    if (screenTelemetry.totalScreenMinutes > 0) {
      setScreenMinutesToday(screenTelemetry.totalScreenMinutes);
      proactiveAlertEngine.evaluateScreenTime(
        screenTelemetry.totalScreenMinutes,
        screenLimitMinutes || 240
      );
    }
  }, [screenTelemetry.totalScreenMinutes, screenLimitMinutes]);

  // Background app usage session tracking
  const appActiveTimestamp = useRef<number>(Date.now());

  const { data: profile } = useGetProfile();
  const { data: dashboard, refetch } = useGetTodayDashboard();
  const { data: timelineEvents, refetch: refetchTimeline } = useGetTimeline();
  const { data: workouts, refetch: refetchWorkouts } = useListWorkouts();
  const { data: streaksData, refetch: refetchStreaks } = useGetStreaks();

  // Refresh nutrition state from single source of truth across SQLite & storage fallback
  const refreshNutritionState = useCallback(async () => {
    try {
      const todayStr = formatDateKey(new Date());
      const totals = await getNutritionTotalsForDate(todayStr);
      setLocalMealsCount(totals.count);
      setLocalCaloriesConsumed(totals.calories);
      setLocalProteinGrams(totals.protein);
      setLocalCarbsGrams(totals.carbs);
      setLocalFatGrams(totals.fat);
    } catch (err) {
      console.warn("[Dashboard] refreshNutritionState error:", err);
    }
  }, []);

  // Load last sync status, local meals, sleep & screen time
  const loadLocalHealthState = useCallback(async () => {
    const status = await getLastSyncStatus();
    setSyncStatus(status);

    // 1. Read real nutrition for today
    await refreshNutritionState();

    // 2. Read saved sleep from SQLite master DB for today
    try {
      const todayStr = formatDateKey(new Date());
      const dbSleep = await getLatestSleep();
      if (dbSleep && (dbSleep.loggedAt || "").startsWith(todayStr)) {
        setSleepHoursLogged(Number(dbSleep.durationHours));
        setSleepQuality(dbSleep.quality || "Restorative");
        setHasLoggedSleepToday(true);
      } else {
        setSleepHoursLogged(0);
        setHasLoggedSleepToday(false);
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
      const sessions = await getFocusSessionsToday();
      if (sessions) setTodayFocusSessions(sessions);

      const config = await getWellbeingConfig();
      if (config) {
        setScreenLimitMinutes(config.dailyLimitMinutes);
        setWindDownActive(config.windDownEnabled);
        setBedtimeHour(config.windDownBedtime);
        setWakeHour(config.windDownWakeup);
        setBlockedCategories(config.blockedCategories);
        setDndAutoToggle(config.dndAutoToggle);
      }
    } catch {}

    // 4. Read hydration from SQLite master DB
    try {
      const cups = await getHydrationToday();
      if (cups !== undefined) setWaterCups(cups);
    } catch {}

    // 5. Arm & synchronize proactive background notification alarms
    try {
      await syncNotificationSchedules();
    } catch (e) {
      console.warn("Notification schedules sync error:", e);
    }

    // 6. Evaluate Achievements & Gamification Engine
    try {
      const achRes = await evaluateAchievements();
      setGamification(achRes.gamification);
    } catch (e) {
      console.warn("Achievements evaluate error:", e);
    }

    // 7. Load 7-Day Trend data from daily_health_metrics
    try {
      await seedHistoricalHealthMetricsIfEmpty();
      const past7Start = new Date();
      past7Start.setDate(past7Start.getDate() - 6);
      const past7Records = await getDailyHealthRecordsForRange(
        formatDateKey(past7Start),
        formatDateKey(new Date())
      );
      const recordsMap: Record<string, number> = {};
      past7Records.forEach((r) => {
        recordsMap[r.date] = r.overallScore;
      });

      const last7List: { dayLabel: string; score: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = formatDateKey(d);
        const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
        const score = recordsMap[key] || 0;
        last7List.push({ dayLabel: dayName, score });
      }
      setTrend7DaysData(last7List);

      // 8. Trigger Morning Briefing health score alert evaluation
      checkDailyHealthScoreNotification().catch((e) =>
        console.warn("Health score alert evaluation error:", e)
      );
    } catch (e) {
      console.warn("Trend 7-day loading error:", e);
    }
  }, [refreshNutritionState]);

  // Real-time synchronization when switching back to the Dashboard tab (0ms latency)
  useFocusEffect(
    useCallback(() => {
      refreshNutritionState();
      nativeStepCounter.refreshTodaySteps();
    }, [refreshNutritionState])
  );

  // Subscribe to real-time meal log/delete events across tabs
  useEffect(() => {
    const unsub = subscribeNutritionChanges(() => {
      refreshNutritionState();
    });
    return () => {
      unsub();
    };
  }, [refreshNutritionState]);

  useEffect(() => {
    loadLocalHealthState();

    // Check if fresh day toast should be shown on startup
    dailyRolloverService.consumeFreshDayToast().then((shouldShow) => {
      if (shouldShow) setShowFreshDayToast(true);
    });

    // Initialize the automated 24/7 midnight rollover watcher
    dailyRolloverService.initDailyRolloverWatcher(async (newDateKey) => {
      setShowFreshDayToast(true);
      refetch();
      refetchWorkouts();
      refetchTimeline();
      loadLocalHealthState();
    });
  }, [loadLocalHealthState]);

  // Auto-dismiss fresh day toast after 6 seconds
  useEffect(() => {
    if (showFreshDayToast) {
      const timer = setTimeout(() => {
        setShowFreshDayToast(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [showFreshDayToast]);

  // Subscribe to live Focus Mode ticker & state machine
  useEffect(() => {
    const unsub = digitalWellbeingService.subscribe((state) => {
      setLiveFocus(state);
      setFocusModeActive(state.isActive);
    });
    return unsub;
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
    await Promise.all([
      refetch(),
      refetchTimeline(),
      refetchWorkouts(),
      refetchStreaks(),
      refreshNutritionState(),
      nativeStepCounter.refreshTodaySteps(),
    ]);
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

  // Live continuous steps & active calories (from phone accelerometer pedometer or wearable)
  const [liveSensorMetrics, setLiveSensorMetrics] = useState(() => fitnessWatchSensor.getSnapshot());

  useEffect(() => {
    const unsub = fitnessWatchSensor.subscribe((snap) => {
      setLiveSensorMetrics(snap);
    });
    return unsub;
  }, []);

  // Base metrics for today
  const todayKeyStr = formatDateKey(new Date());
  const workoutCaloriesBurned =
    workouts?.reduce((acc: number, w: any) => {
      const wDate = (w.loggedAt || w.logged_at || "").slice(0, 10);
      if (wDate && wDate !== todayKeyStr) return acc;
      return acc + (Number(w.caloriesBurned) || 0);
    }, 0) || 0;

  // Use live continuous steps (wearable or phone pedometer)
  const stepsCount = liveSensorMetrics.dailySteps;
  const stepsCaloriesBurned = liveSensorMetrics.dailyActiveCalories > 0
    ? liveSensorMetrics.dailyActiveCalories
    : Math.round(stepsCount * 0.045);
  const totalActiveCaloriesBurned = workoutCaloriesBurned + (liveSensorMetrics.isActive ? liveSensorMetrics.activeCalories : stepsCaloriesBurned);

  const stepsTarget = profile?.dailyStepsTarget || 9000;
  const caloriesTarget = profile?.dailyCalorieTarget || 2100;

  // Hydration Engine & Telemetry Hook
  const {
    hydration,
    logDrink,
    incrementCup,
    decrementCup,
    removeEntry,
    refreshHydration,
    toggleReminders: toggleHydrationReminders,
    setIntervalHours: setHydrationInterval,
    sendTestPrompt: sendHydrationTest,
    presets: hydrationPresets,
    beverageTypes: hydrationBeverageTypes,
    schedule: hydrationSchedule,
  } = useHydration(stepsCount, workouts?.length ? 45 : 0);

  // Synchronize waterCups state with hydration hook
  useEffect(() => {
    if (hydration.todayCups >= 0) {
      setWaterCups(Math.round(hydration.todayCups));
    }
  }, [hydration.todayCups]);

  // Real Consumed Calories for today
  const caloriesConsumed = Math.max(localCaloriesConsumed, Number(dashboard?.caloriesConsumed || 0));
  const caloriesPercent = Math.min(100, Math.round((caloriesConsumed / caloriesTarget) * 100));

  const proteinGrams = localProteinGrams > 0 ? localProteinGrams : Number(dashboard?.proteinGrams || 0);
  const carbsGrams = localCarbsGrams > 0 ? localCarbsGrams : Number(dashboard?.carbsGrams || 0);
  const fatGrams = localFatGrams > 0 ? localFatGrams : Number(dashboard?.fatGrams || 0);

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
    if (caloriesConsumed === 0) return "Tap to log";
    if (dynamicNutritionScore >= 8.5) return `${caloriesConsumed} kcal • Optimal`;
    if (dynamicNutritionScore >= 7.0) return `${caloriesConsumed} kcal • Target`;
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
    if (effectiveSleepHours >= 5.0) return 5.8;
    if (effectiveSleepHours >= 4.0) return 4.5;
    return Math.max(1.0, Number((effectiveSleepHours * 1.1).toFixed(1)));
  }, [effectiveSleepHours]);

  const dynamicSleepLabel = useMemo(() => {
    if (effectiveSleepHours === 0) return "Tap to log";
    if (effectiveSleepHours < 6) return `${effectiveSleepHours}h • Short rest`;
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
    if (stepsCount === 0 && (!workouts || workouts.length === 0)) return "Tap to track";
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
    if (screenMinutesToday === 0) return "Tap to connect";
    const hours = Math.floor(screenMinutesToday / 60);
    const mins = screenMinutesToday % 60;
    const timeStr = `${hours}h ${mins}m`;
    if (dynamicScreenScore >= 8.5) return `${timeStr} • Balanced`;
    if (dynamicScreenScore >= 7.0) return `${timeStr} • Moderate`;
    return `${timeStr} • Strain`;
  }, [screenMinutesToday, dynamicScreenScore]);

  // 5. Dynamic Hydration Score & Label
  const dynamicHydrationScore = useMemo(() => {
    if (hydration.score > 0) return hydration.score;
    if (waterCups === 0) return 0.0;
    const ratio = Math.min(1.25, waterCups / 8);
    return Number(Math.min(10.0, ratio * 8.5 + (waterCups >= 8 ? 1.5 : 0)).toFixed(1));
  }, [hydration.score, waterCups]);

  const dynamicHydrationLabel = useMemo(() => {
    if (hydration.statusLabel && hydration.todayMl > 0) return hydration.statusLabel;
    if (waterCups === 0) return "Tap to log";
    if (waterCups >= 8) return `${waterCups} cups • Hydrated`;
    if (waterCups >= 5) return `${waterCups} cups • Good Pace`;
    return `${waterCups} cups • Needs Water`;
  }, [hydration.statusLabel, hydration.todayMl, waterCups]);

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

  // Persistent daily snapshot for analytics & biometric tracking
  useEffect(() => {
    const todayKey = formatDateKey();
    computeAndSaveDailySnapshot(todayKey, {
      overallScore: dynamicOverallScore,
      steps: stepsCount,
      activeCalories: totalActiveCaloriesBurned,
      caloriesConsumed,
      proteinGrams,
      carbsGrams,
      fatGrams,
      sleepHours: effectiveSleepHours,
      sleepQuality,
      hydrationMl: hydration.todayMl,
      hydrationCups: waterCups,
      screenMinutes: screenMinutesToday,
    }).catch((err) => console.warn("[Dashboard] Daily snapshot save err:", err));
  }, [
    dynamicOverallScore,
    stepsCount,
    totalActiveCaloriesBurned,
    caloriesConsumed,
    proteinGrams,
    carbsGrams,
    fatGrams,
    effectiveSleepHours,
    sleepQuality,
    hydration.todayMl,
    waterCups,
    screenMinutesToday,
  ]);

  // Dynamic Time-Based Greeting Engine (Accurate 24h Pacing):
  // 5:00 AM - 11:59 AM -> "Good morning"
  // 12:00 PM - 4:59 PM -> "Good afternoon"
  // 5:00 PM - 9:59 PM -> "Good evening"
  // 10:00 PM - 4:59 AM -> "Good night"
  const getDynamicGreeting = () => {
    const curHour = new Date().getHours();
    if (curHour >= 5 && curHour < 12) return "Good morning";
    if (curHour >= 12 && curHour < 17) return "Good afternoon";
    if (curHour >= 17 && curHour < 22) return "Good evening";
    return "Good night";
  };

  const [greetingTime, setGreetingTime] = useState<string>(getDynamicGreeting);

  useEffect(() => {
    const updateGreeting = () => {
      setGreetingTime(getDynamicGreeting());
    };
    updateGreeting();
    const interval = setInterval(updateGreeting, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  // Multi-source user name resolution (Profile, Google OAuth, Onboarding, Email prefix)
  const [userName, setUserName] = useState<string>(() => {
    const fromProfile = extractFirstName(profile?.name);
    return fromProfile || "Sayak";
  });

  useEffect(() => {
    let isMounted = true;
    async function loadUserName() {
      // 1. Check API profile.name
      if (profile?.name) {
        const first = extractFirstName(profile.name);
        if (first && isMounted) {
          setUserName(first);
          return;
        }
      }

      // 2. Check Google User session
      try {
        const gUser = await getStoredGoogleUser();
        if (gUser?.name) {
          const first = extractFirstName(gUser.name);
          if (first && isMounted) {
            setUserName(first);
            return;
          }
        }
      } catch {}

      // 3. Check lumen_personal_details from onboarding
      try {
        const detailsRaw = await storage.getItem("lumen_personal_details");
        if (detailsRaw) {
          const parsed = JSON.parse(detailsRaw);
          if (parsed?.name) {
            const first = extractFirstName(parsed.name);
            if (first && isMounted) {
              setUserName(first);
              return;
            }
          }
        }
      } catch {}

      // 4. Check web localStorage if running on web
      if (Platform.OS === "web" && typeof localStorage !== "undefined") {
        try {
          const webDetails = localStorage.getItem("lumen_personal_details");
          if (webDetails) {
            const parsed = JSON.parse(webDetails);
            if (parsed?.name) {
              const first = extractFirstName(parsed.name);
              if (first && isMounted) {
                setUserName(first);
                return;
              }
            }
          }

          const webGUser = localStorage.getItem("lumen_google_user");
          if (webGUser) {
            const parsed = JSON.parse(webGUser);
            if (parsed?.name) {
              const first = extractFirstName(parsed.name);
              if (first && isMounted) {
                setUserName(first);
                return;
              }
            }
          }

          const webLocalProfile = localStorage.getItem("lumen_local_profile");
          if (webLocalProfile) {
            const parsed = JSON.parse(webLocalProfile);
            if (parsed?.name) {
              const first = extractFirstName(parsed.name);
              if (first && isMounted) {
                setUserName(first);
                return;
              }
            }
          }
        } catch {}
      }

      // 5. Fallback: verified email prefix
      try {
        const vEmail = await authService.getVerifiedEmail();
        if (vEmail && vEmail !== "N/A" && vEmail.includes("@")) {
          const prefix = vEmail.split("@")[0].replace(/[._-]/g, " ");
          const first = extractFirstName(prefix);
          if (first && isMounted) {
            setUserName(first);
            return;
          }
        }
      } catch {}
    }

    loadUserName();
    return () => {
      isMounted = false;
    };
  }, [profile?.name]);

  // Dynamic Clinical Readiness Guidance (Analyzes sleep, hydration, and overall score)
  const energySubtext = useMemo(() => {
    if (dynamicOverallScore === 0) {
      return "Log your sleep, hydration, or meals to generate your clinical bio-readiness plan.";
    }

    // High Readiness (7.5 - 10.0) - High Strain & Peak Output
    if (dynamicOverallScore >= 7.5) {
      if (effectiveSleepHours >= 7.0) {
        return "Deep recovery is optimal. High-strain day—push workouts hard, but cut caffeine by 2:00 PM.";
      }
      if (waterCups >= 5) {
        return "Cellular hydration is strong. Peak performance day—ideal for strength and high-intensity output.";
      }
      return "Metabolic readiness is primed. High-capacity day—push physical strain and prioritize hydration pacing.";
    }

    // Steady Momentum (5.0 - 7.4) - Balanced Training & Hydration
    if (dynamicOverallScore >= 5.0) {
      if (effectiveSleepHours > 0 && effectiveSleepHours < 6.5) {
        return "Sleep was slightly shortened. Balanced momentum day—focus on moderate cardio and steady pacing.";
      }
      if (waterCups < 4) {
        return "Hydration pacing is lagging. Steady momentum day—hydrate early to prevent an afternoon cognitive dip.";
      }
      return "Biometric baselines are steady. Moderate strain day—solid for maintenance training and deep work.";
    }

    // Low / Restorative Recovery (0.1 - 4.9)
    if (effectiveSleepHours > 0 && effectiveSleepHours < 5.5) {
      return "Sleep deficit detected. Restorative pacing advised—prioritize light mobility, fluids, and an early wind-down.";
    }
    return "Recovery reserve is depleted. Restorative day—prioritize hydration, gentle walks, and nervous system rest.";
  }, [dynamicOverallScore, effectiveSleepHours, waterCups]);

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

  const incrementWater = async () => {
    triggerHaptic();
    await incrementCup();
  };

  const decrementWater = async () => {
    triggerHaptic();
    await decrementCup();
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

  // Dedicated helpers to open Android intent or settings (Mindful Architecture)
  const openAccessibilitySettings = async () => {
    triggerHaptic();
    await digitalWellbeingService.openAccessibilitySettings();
  };

  const openUsageAccessSettings = async () => {
    triggerHaptic();
    await digitalWellbeingService.openUsageAccessSettings();
  };

  const openDndSettings = async () => {
    triggerHaptic();
    await digitalWellbeingService.openDndSettings();
  };

  const openOverlaySettings = async () => {
    triggerHaptic();
    await digitalWellbeingService.openOverlaySettings();
  };

  const requestAccessibilityAndUsagePermission = () => {
    triggerHaptic();
    digitalWellbeingService.promptGuidedPermissionDialog();
  };

  // Focus Mode Actions
  const handleStartFocus = async () => {
    triggerHaptic("success");
    await digitalWellbeingService.startFocusSession(
      selectedFocusPreset,
      selectedFocusMinutes,
      blockedCategories,
      dndAutoToggle
    );
  };

  const handlePauseFocus = () => {
    triggerHaptic();
    digitalWellbeingService.pauseFocusSession();
  };

  const handleResumeFocus = () => {
    triggerHaptic();
    digitalWellbeingService.resumeFocusSession();
  };

  const handlePromptCompleteFocus = () => {
    triggerHaptic();
    setShowReflectionModal(true);
  };

  const handleConfirmCompleteFocus = async (score = reflectionScore, note = reflectionNote) => {
    triggerHaptic("success");
    await digitalWellbeingService.completeSession(score, note);
    setShowReflectionModal(false);
    setReflectionNote("");
    const refreshed = await getFocusSessionsToday();
    setTodayFocusSessions(refreshed);
    Alert.alert("Focus Logged 🎉", `Great work! Your session has been recorded.`);
  };

  const handleCancelFocus = () => {
    Alert.alert(
      "End Focus Session?",
      "Are you sure you want to end your focus session early?",
      [
        { text: "Keep Going", style: "cancel" },
        {
          text: "End Session",
          style: "destructive",
          onPress: async () => {
            triggerHaptic();
            await digitalWellbeingService.cancelSession();
            const refreshed = await getFocusSessionsToday();
            setTodayFocusSessions(refreshed);
          },
        },
      ]
    );
  };

  const toggleCategoryBlock = (catId: string) => {
    triggerHaptic();
    setBlockedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
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
    await saveWellbeingConfig({
      dailyLimitMinutes: screenLimitMinutes,
      windDownEnabled: windDownActive,
      windDownBedtime: bedtimeHour,
      windDownWakeup: wakeHour,
      blockedCategories,
      dndAutoToggle,
    });

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
    Alert.alert("Wellbeing Calibrated", `Daily screen limit set to ${screenLimitMinutes / 60}h with Wind Down scheduled.`);
  };

  return (
    <View style={styles.container}>
      {/* Ambient atmospheric backlight glow */}
      <AmbientAtmosphere variant="dashboard" />

      {/* Top Header Bar */}
      <View style={styles.topBar}>
        {/* Top-Left: Menu Trigger & Polished Lumen OS Brand Lockup */}
        <View style={styles.brandRow}>
          <Pressable
            onPress={openLeftMenu}
            accessibilityLabel="Open Navigation Slide Menu"
            style={styles.hamburgerBtn}
          >
            <Menu size={19} color="#10b981" />
          </Pressable>

          <View style={styles.brandIconWrapper}>
            <Image
              source={require("../../assets/icon.png")}
              style={styles.brandIconImg}
              resizeMode="cover"
            />
          </View>

          <View style={styles.brandTextCol}>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitle} numberOfLines={1} ellipsizeMode="tail">
                LUMEN
              </Text>
              <View style={styles.brandPill}>
                <Text style={styles.brandPillText}>AI OS</Text>
              </View>
            </View>
            <Text style={styles.brandSubtitle} numberOfLines={1} ellipsizeMode="tail">
              Bio-Intelligence Telemetry
            </Text>
          </View>
        </View>

        <View style={styles.topRightActions}>
          {/* Top-Right Profile / Avatar Button */}
          <Pressable 
            onPress={openRightMenu}
            accessibilityLabel="Open Profile Drawer"
            style={styles.avatarPressable}
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {userName ? userName[0].toUpperCase() : "A"}
              </Text>
            </View>
            <View style={styles.avatarActiveDot} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        removeClippedSubviews={Platform.OS === "android"}
        overScrollMode="never"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#10b981"
          />
        }
      >
        {/* ========================================================= */}
        {/* CELEBRATORY FRESH START / MIDNIGHT ROLLOVER TOAST BANNER */}
        {/* ========================================================= */}
        {showFreshDayToast && (
          <View style={styles.freshDayBanner}>
            <View style={styles.freshDayBannerGlow} />
            <View style={styles.freshDayBannerRow}>
              <View style={styles.freshDayIconBadge}>
                <Text style={styles.freshDayEmoji}>🌅</Text>
              </View>
              <View style={styles.freshDayTextCol}>
                <View style={styles.freshDayTitleRow}>
                  <Text style={styles.freshDayTitle}>New Day, Clean Slate!</Text>
                  <View style={styles.freshDayLivePill}>
                    <Text style={styles.freshDayLivePillText}>00:00 RESET</Text>
                  </View>
                </View>
                <Text style={styles.freshDaySubtitle}>
                  Steps, calories, nutrition & hydration are fresh for today.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowFreshDayToast(false)}
                style={styles.freshDayCloseBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={15} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* HERO SECTION: Greeting + Circular Score + Quick Actions   */}
        {/* ========================================================= */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextCol}>
              <Text style={styles.greetingTitle} numberOfLines={1}>
                {greetingTime},
              </Text>
              <Text style={styles.greetingName} numberOfLines={1}>
                {userName}
              </Text>
              <Text style={styles.energySubtext}>
                {energySubtext}
              </Text>
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
              <Text style={styles.pillMealText} numberOfLines={1}>Log Meal</Text>
            </Pressable>

            <Pressable
              style={styles.pillActivity}
              onPress={() => {
                triggerHaptic();
                router.push("/(tabs)/activity");
              }}
            >
              <Zap size={14} color="#10b981" />
              <Text style={styles.pillActivityText} numberOfLines={1}>Track Activity</Text>
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 0, marginRight: 4 }}>
                <Utensils size={14} color="#047857" />
                <Text style={styles.pillarTitle} numberOfLines={1}>Nutrition</Text>
              </View>
              <Text style={[styles.pillarScore, { color: "#047857" }]}>
                {dynamicNutritionScore > 0 ? dynamicNutritionScore.toFixed(1) : "0.0"}
              </Text>
            </View>
            <View style={styles.pillarBarTrack}>
              <View
                style={[
                  styles.pillarBarFill,
                  {
                    width: `${Math.min(100, Math.max(10, dynamicNutritionScore * 10))}%`,
                    backgroundColor: "#047857",
                  },
                ]}
              />
            </View>
            <Text style={styles.pillarSubtitle} numberOfLines={1} ellipsizeMode="tail">
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 0, marginRight: 4 }}>
                <Moon size={14} color="#b45309" />
                <Text style={styles.pillarTitle} numberOfLines={1}>Sleep</Text>
              </View>
              <Text style={[styles.pillarScore, { color: "#b45309" }]}>
                {dynamicSleepScore > 0 ? dynamicSleepScore.toFixed(1) : "0.0"}
              </Text>
            </View>
            <View style={styles.pillarBarTrack}>
              <View
                style={[
                  styles.pillarBarFill,
                  {
                    width: `${Math.min(100, Math.max(10, dynamicSleepScore * 10))}%`,
                    backgroundColor: "#b45309",
                  },
                ]}
              />
            </View>
            <Text style={styles.pillarSubtitle} numberOfLines={1} ellipsizeMode="tail">
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 0, marginRight: 4 }}>
                <Activity size={14} color="#0891b2" />
                <Text style={styles.pillarTitle} numberOfLines={1}>Activity</Text>
              </View>
              <Text style={[styles.pillarScore, { color: "#0891b2" }]}>
                {dynamicActivityScore > 0 ? dynamicActivityScore.toFixed(1) : "0.0"}
              </Text>
            </View>
            <View style={styles.pillarBarTrack}>
              <View
                style={[
                  styles.pillarBarFill,
                  {
                    width: `${Math.min(100, Math.max(10, dynamicActivityScore * 10))}%`,
                    backgroundColor: "#0891b2",
                  },
                ]}
              />
            </View>
            <Text style={styles.pillarSubtitle} numberOfLines={1} ellipsizeMode="tail">
              {dynamicActivityLabel}
            </Text>
          </Pressable>

          {/* 4. Screen Time Card -> Press opens Digital Wellbeing Modal */}
          <Pressable
            style={({ pressed }) => [
              styles.pillarCard,
              liveFocus.isActive && {
                borderColor: liveFocus.isPaused ? "rgba(245, 158, 11, 0.6)" : "rgba(168, 85, 247, 0.7)",
                backgroundColor: liveFocus.isPaused ? "rgba(245, 158, 11, 0.08)" : "rgba(168, 85, 247, 0.1)",
              },
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => {
              triggerHaptic();
              setWellbeingTab(liveFocus.isActive ? "focus" : "usage");
              setShowScreenTimeModal(true);
            }}
          >
            <View style={styles.pillarTopRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 0, marginRight: 4 }}>
                <Smartphone size={14} color={liveFocus.isActive ? "#047857" : "#7e22ce"} />
                <Text style={styles.pillarTitle} numberOfLines={1}>Screen</Text>
              </View>
              {liveFocus.isActive ? (
                <View
                  style={[
                    styles.pillarFocusLiveBadge,
                    { backgroundColor: liveFocus.isPaused ? "rgba(245, 158, 11, 0.2)" : "rgba(16, 185, 129, 0.2)" },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillarFocusLiveBadgeText,
                      { color: liveFocus.isPaused ? "#b45309" : "#047857" },
                    ]}
                    numberOfLines={1}
                  >
                    {liveFocus.isPaused ? "PAUSED" : "FOCUS"}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.pillarScore, { color: "#7e22ce" }]}>
                  {dynamicScreenScore.toFixed(1)}
                </Text>
              )}
            </View>
            <View style={styles.pillarBarTrack}>
              <View
                style={[
                  styles.pillarBarFill,
                  {
                    width: liveFocus.isActive
                      ? `${liveFocus.progressPercent}%`
                      : `${Math.min(100, dynamicScreenScore * 10)}%`,
                    backgroundColor: liveFocus.isActive
                      ? liveFocus.isPaused ? "#b45309" : "#047857"
                      : "#7e22ce",
                  },
                ]}
              />
            </View>
            <Text style={styles.pillarSubtitle} numberOfLines={1} ellipsizeMode="tail">
              {liveFocus.isActive
                ? liveFocus.isPaused
                  ? "Paused • Tap to resume"
                  : `${Math.floor(liveFocus.remainingSeconds / 60)}:${(liveFocus.remainingSeconds % 60).toString().padStart(2, "0")} remaining`
                : dynamicScreenLabel}
            </Text>
          </Pressable>
        </View>

        {/* ========================================================= */}
        {/* HYDRATION & ELECTROLYTE WIDGET */}
        {/* ========================================================= */}
        <Pressable
          style={styles.hydrationCardWide}
          onPress={() => {
            triggerHaptic();
            setShowHydrationModal(true);
          }}
        >
          <View style={styles.hydrationTopRow}>
            <View style={styles.dropCircle}>
              <Droplet size={18} color="#0891b2" />
            </View>
            <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 0, marginRight: 6 }}>
                  <Text style={styles.bioCardLabel} numberOfLines={1}>Hydration & Electrolytes</Text>
                  <View style={[styles.hydrationBadgePill, { backgroundColor: `${hydration.statusBadgeColor}22`, borderColor: `${hydration.statusBadgeColor}55` }]}>
                    <Text style={[styles.hydrationBadgeText, { color: hydration.statusBadgeColor }]}>
                      {hydration.percentUsed}%
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={[styles.pillarScore, { color: "#0891b2" }]}>
                    {dynamicHydrationScore > 0 ? dynamicHydrationScore.toFixed(1) : "0.0"}
                  </Text>
                  <ChevronRight size={16} color="#244538" />
                </View>
              </View>
              <Text style={styles.bioCardValue} numberOfLines={1}>
                {hydration.todayMl > 0 ? `${hydration.todayMl.toLocaleString()} ml` : `${waterCups * 250} ml`}
                <Text style={{ fontSize: 13, color: "#244538", fontWeight: "700" }}>
                  {" "}/ {hydration.targetMl.toLocaleString()} ml ({waterCups} / {hydration.targetCups} cups)
                </Text>
              </Text>
              <Text style={styles.pillarSubtitle} numberOfLines={1}>{dynamicHydrationLabel}</Text>
            </View>
          </View>

          {/* Progress Bar Track */}
          <View style={styles.hydrationBarTrack}>
            <View
              style={[
                styles.hydrationBarFill,
                { width: `${Math.min(100, (hydration.todayMl / (hydration.targetMl || 2000)) * 100)}%` },
              ]}
            />
          </View>

          {/* Hydration Reminder Quick Indicator */}
          <View style={styles.hydrationCardReminderRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Bell size={12} color={hydration.remindersEnabled ? "#0891b2" : "#94a3b8"} />
              <Text style={styles.hydrationCardReminderText}>
                {hydration.remindersEnabled
                  ? `Prompts: ${hydration.nextPromptTimeStr || `Every ${hydration.reminderIntervalHours}h`}`
                  : "Prompts: Off"}
              </Text>
            </View>
            <Text style={styles.hydrationCardReminderAction}>Set Nudges ➔</Text>
          </View>

          {/* Quick Container Buttons Horizontal Carousel */}
          <View style={styles.hydrationQuickRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hydrationPillsScroll}>
              <Pressable
                style={styles.hydrationQuickPill}
                onPress={(e) => {
                  e.stopPropagation();
                  logDrink(250, "water");
                }}
              >
                <Text style={styles.hydrationQuickIcon}>🥛</Text>
                <Text style={styles.hydrationQuickText}>+250ml</Text>
              </Pressable>

              <Pressable
                style={styles.hydrationQuickPill}
                onPress={(e) => {
                  e.stopPropagation();
                  logDrink(500, "water");
                }}
              >
                <Text style={styles.hydrationQuickIcon}>🍶</Text>
                <Text style={styles.hydrationQuickText}>+500ml</Text>
              </Pressable>

              <Pressable
                style={styles.hydrationQuickPill}
                onPress={(e) => {
                  e.stopPropagation();
                  logDrink(750, "water");
                }}
              >
                <Text style={styles.hydrationQuickIcon}>🥤</Text>
                <Text style={styles.hydrationQuickText}>+750ml</Text>
              </Pressable>

              <Pressable
                style={[styles.hydrationQuickPill, { borderColor: "rgba(245, 158, 11, 0.4)", backgroundColor: "rgba(245, 158, 11, 0.1)" }]}
                onPress={(e) => {
                  e.stopPropagation();
                  logDrink(350, "electrolytes");
                }}
              >
                <Text style={styles.hydrationQuickIcon}>⚡</Text>
                <Text style={[styles.hydrationQuickText, { color: "#f59e0b" }]}>+350ml Electro</Text>
              </Pressable>

              <View style={styles.hydrationQuickDivider} />

              <Pressable
                style={styles.waterMiniBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  decrementWater();
                }}
              >
                <Minus size={14} color="#94a3b8" />
              </Pressable>

              <Pressable
                style={styles.waterMiniBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  incrementWater();
                }}
              >
                <Plus size={14} color="#06b6d4" />
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>

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
        {/* ACHIEVEMENTS & GAMIFICATION SPOTLIGHT                     */}
        {/* ========================================================= */}
        <Pressable
          style={styles.achievementsSpotlightCard}
          onPress={() => router.push("/(tabs)/achievements" as any)}
        >
          <View style={styles.achievementsSpotlightHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0, marginRight: 8 }}>
              <View style={styles.achievementsTrophyIcon}>
                <Trophy size={18} color="#f59e0b" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[styles.achievementsSpotlightTitle, { flexShrink: 1 }]} numberOfLines={1}>
                    Achievements & Badges
                  </Text>
                  <View style={styles.xpMiniPill}>
                    <Text style={styles.xpMiniText} numberOfLines={1}>+{gamification?.totalXp || 0} XP</Text>
                  </View>
                </View>
                <Text style={styles.achievementsSpotlightSub} numberOfLines={1}>
                  {gamification ? `Level ${gamification.currentLevel} • ${gamification.levelTitle}` : "Milestones & consistency rewards"}
                </Text>
              </View>
            </View>
            <View style={styles.viewBadgesBtn}>
              <Text style={styles.viewBadgesText}>View</Text>
              <ChevronRight size={14} color="#10b981" />
            </View>
          </View>

          {gamification && (
            <View style={styles.achievementsSpotlightProgress}>
              <View style={styles.spotlightTrack}>
                <View style={[styles.spotlightFill, { width: `${gamification.levelProgressPercent}%` }]} />
              </View>
              <View style={styles.spotlightRatioRow}>
                <Text style={styles.spotlightRatioText}>
                  {gamification.unlockedCount} / {gamification.totalCount} Badges Unlocked
                </Text>
                <Text style={styles.spotlightNextText}>
                  {gamification.levelProgressPercent}% to Lvl {gamification.currentLevel + 1}
                </Text>
              </View>
            </View>
          )}
        </Pressable>

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

          <Trend7DayChart overallScore={dynamicOverallScore} chartData={trend7DaysData} />

          <Pressable
            style={styles.trendMonthlyLinkBtn}
            onPress={() => router.push("/(tabs)/analytics")}
          >
            <Text style={styles.trendMonthlyLinkText}>
              View Full Monthly Calendar & Biometrics ➔
            </Text>
          </Pressable>
        </View>

        {/* ========================================================= */}
        {/* CALORIES & MACRONUTRIENTS CARD                           */}
        {/* ========================================================= */}
        <View style={styles.caloriesMacroCardWide}>
          <View style={styles.calTopRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0, marginRight: 8 }}>
              <Utensils size={14} color="#f59e0b" />
              <Text style={styles.bioCardLabel} numberOfLines={1}>Calories & Macronutrients</Text>
            </View>
            <Text style={[styles.calValue, { flexShrink: 0 }]} numberOfLines={1}>
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0, marginRight: 8 }}>
              <Flame size={18} color="#f59e0b" />
              <Text style={styles.burnBannerTitle} numberOfLines={1}>Total Active Burn</Text>
            </View>
            <Text style={[styles.burnBannerTotal, { flexShrink: 0 }]} numberOfLines={1}>{totalActiveCaloriesBurned} kcal</Text>
          </View>

          <View style={styles.burnBannerSubRow}>
            <Text style={styles.burnBannerSubText} numberOfLines={1}>
              {liveSensorMetrics.isWearableSourceActive ? "⌚ Wearable: " : "🚶 Steps: "}
              <Text style={{ color: "#38bdf8", fontWeight: "bold" }}>
                {stepsCaloriesBurned} kcal
              </Text>{" "}
              ({stepsCount.toLocaleString()} steps)
            </Text>
            <Text style={styles.burnBannerSubText} numberOfLines={1}>
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
      {/* DECOUPLED & MEMOIZED WELLNESS & FOCUS MODALS              */}
      {/* ========================================================= */}
      {showSleepModal && (
        <SleepModal
          visible={showSleepModal}
          onClose={() => setShowSleepModal(false)}
          initialHours={sleepHoursLogged || 7.5}
          initialQuality={sleepQuality}
          onSaved={(record) => {
            setSleepHoursLogged(record.durationHours);
            setSleepQuality(record.quality);
            setHasLoggedSleepToday(true);
          }}
        />
      )}

      {showScreenTimeModal && (
        <ScreenTimeModal
          visible={showScreenTimeModal}
          onClose={() => setShowScreenTimeModal(false)}
          wellbeingTab={wellbeingTab}
          setWellbeingTab={setWellbeingTab}
          screenTelemetry={screenTelemetry}
          screenMinutesToday={screenMinutesToday}
          screenLimitMinutes={screenLimitMinutes}
          setScreenLimitMinutes={setScreenLimitMinutes}
          dynamicScreenScore={dynamicScreenScore}
          usagePermissionGranted={usagePermissionGranted}
          isScreenRefreshing={isScreenRefreshing}
          refreshScreenTime={refreshScreenTime}
          requestUsagePermission={requestUsagePermission}
          requestAccessibilityAndUsagePermission={requestAccessibilityAndUsagePermission}
          openDndSettings={openDndSettings}
          liveFocus={liveFocus}
          selectedFocusPreset={selectedFocusPreset}
          setSelectedFocusPreset={setSelectedFocusPreset}
          selectedFocusMinutes={selectedFocusMinutes}
          setSelectedFocusMinutes={setSelectedFocusMinutes}
          blockedCategories={blockedCategories}
          toggleCategoryBlock={toggleCategoryBlock}
          handleStartFocus={handleStartFocus}
          handlePauseFocus={handlePauseFocus}
          handleResumeFocus={handleResumeFocus}
          handleCancelFocus={handleCancelFocus}
          handlePromptCompleteFocus={handlePromptCompleteFocus}
          onOpenBreathing={() => setIsBreathingMode(true)}
          todayFocusSessions={todayFocusSessions}
          windDownActive={windDownActive}
          setWindDownActive={setWindDownActive}
          bedtimeHour={bedtimeHour}
          wakeHour={wakeHour}
          dndAutoToggle={dndAutoToggle}
          setDndAutoToggle={setDndAutoToggle}
          handleSaveWellbeing={handleSaveWellbeing}
        />
      )}

      {isBreathingMode && (
        <BreathingModal
          visible={isBreathingMode}
          onClose={() => setIsBreathingMode(false)}
        />
      )}

      {showReflectionModal && (
        <ReflectionModal
          visible={showReflectionModal}
          onClose={() => setShowReflectionModal(false)}
          onConfirm={(score, note) => {
            setReflectionScore(score);
            setReflectionNote(note);
            handleConfirmCompleteFocus(score, note);
          }}
        />
      )}

      {showHydrationModal && (
        <HydrationModal
          visible={showHydrationModal}
          onClose={() => setShowHydrationModal(false)}
          hydration={hydration}
          selectedBeverage={selectedHydrationBeverage}
          setSelectedBeverage={setSelectedHydrationBeverage}
          logDrink={logDrink}
          decrementWater={decrementWater}
          removeEntry={removeEntry}
          toggleReminders={toggleHydrationReminders}
          setIntervalHours={setHydrationInterval}
          sendTestPrompt={sendHydrationTest}
          hydrationPresets={hydrationPresets}
          hydrationBeverageTypes={hydrationBeverageTypes}
          hydrationSchedule={hydrationSchedule}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bgSolid,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 52 : 40,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
    maxWidth: "100%",
  },
  brandRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    marginRight: 10,
  },
  hamburgerBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(232, 241, 237, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  brandIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "rgba(16, 185, 129, 0.35)",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  brandIconImg: {
    width: 28,
    height: 28,
    borderRadius: 7,
  },
  brandTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  brandTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandTitle: {
    color: THEME.colors.textOnDarkPrimary,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  brandPill: {
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  brandPillText: {
    color: "#10b981",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  brandSubtitle: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 9.5,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginTop: 1,
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  avatarPressable: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(16, 185, 129, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#10b981",
    fontSize: 14,
    fontWeight: "800",
  },
  avatarActiveDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10b981",
    borderWidth: 2,
    borderColor: THEME.colors.bgSolid,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 150, // Generous clearance so floating capsule tab bar never obscures content
  },

  // FRESH START / MIDNIGHT ROLLOVER CELEBRATORY BANNER
  freshDayBanner: {
    marginHorizontal: 0,
    marginBottom: 16,
    borderRadius: 20,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    padding: 14,
    overflow: "hidden",
    position: "relative",
  },
  freshDayBannerGlow: {
    position: "absolute",
    top: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  freshDayBannerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  freshDayIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  freshDayEmoji: {
    fontSize: 22,
  },
  freshDayTextCol: {
    flex: 1,
  },
  freshDayTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  freshDayTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#f8fafc",
    letterSpacing: -0.2,
  },
  freshDayLivePill: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  freshDayLivePillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#34d399",
    letterSpacing: 0.5,
  },
  freshDaySubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 16,
  },
  freshDayCloseBtn: {
    padding: 6,
    marginLeft: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },

  // HERO CARD (Matches Reference)
  heroCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
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
    paddingRight: 14,
    minWidth: 0,
  },
  greetingTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
    letterSpacing: -0.4,
  },
  greetingName: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },
  energySubtext: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
    fontWeight: "500",
  },
  scoreNumber: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  scoreLabel: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  actionPillsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  pillMeal: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(245, 158, 11, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  pillMealText: {
    color: "#f59e0b",
    fontSize: 11.5,
    fontWeight: "700",
  },
  pillActivity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  pillActivityText: {
    color: "#10b981",
    fontSize: 11.5,
    fontWeight: "700",
  },

  // AI INSIGHT CARD (Matches Reference)
  aiInsightCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
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
    color: THEME.colors.cardTextPrimary,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  aiInsightDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  aiActionBtn: {
    backgroundColor: THEME.colors.accentTeal,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  aiActionBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },

  // 4 PILLARS (2x2 Grid)
  pillarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  pillarCard: {
    width: "48.2%",
    flexGrow: 1,
    minHeight: 96,
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    justifyContent: "space-between",
  },
  pillarTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pillarTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12.5,
    fontWeight: "700",
  },
  pillarScore: {
    fontSize: 14.5,
    fontWeight: "900",
  },
  pillarBarTrack: {
    height: 4,
    backgroundColor: "rgba(180, 205, 195, 0.35)",
    borderRadius: 2,
    marginVertical: 8,
    overflow: "hidden",
  },
  pillarBarFill: {
    height: 4,
    borderRadius: 2,
  },
  pillarSubtitle: {
    color: "#162e24",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
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
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
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
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  streakCardMsg: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 14,
  },

  // ACHIEVEMENTS & GAMIFICATION SPOTLIGHT
  achievementsSpotlightCard: {
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: 24,
    padding: 14,
    marginBottom: 20,
  },
  achievementsSpotlightHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  achievementsTrophyIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  achievementsSpotlightTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
  },
  xpMiniPill: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  xpMiniText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#f59e0b",
  },
  achievementsSpotlightSub: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    fontWeight: "500",
    marginTop: 2,
  },
  viewBadgesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewBadgesText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#10b981",
  },
  achievementsSpotlightProgress: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  spotlightTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(180, 205, 195, 0.35)",
    overflow: "hidden",
  },
  spotlightFill: {
    height: "100%",
    backgroundColor: "#f59e0b",
    borderRadius: 3,
  },
  spotlightRatioRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  spotlightRatioText: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
  },
  spotlightNextText: {
    fontSize: 10,
    color: "#f59e0b",
    fontWeight: "800",
  },

  // 7-DAY SCORE TREND CHART
  trendContainerCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 20,
  },
  trendHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  trendCardTitle: {
    color: THEME.colors.cardTextPrimary,
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
  trendMonthlyLinkBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  trendMonthlyLinkText: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "800",
  },

  // HYDRATION & MACROS
  biometricsSplitRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  hydrationCard: {
    flex: 1,
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
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
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  bioCardValue: {
    color: THEME.colors.cardTextPrimary,
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
    backgroundColor: "#ffffff",
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
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    justifyContent: "space-between",
  },
  calTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  calValue: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 11,
    fontWeight: "800",
  },
  calBarTrack: {
    height: 4,
    backgroundColor: "rgba(180, 205, 195, 0.35)",
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
    color: THEME.colors.cardTextSecondary,
    fontSize: 9,
    fontWeight: "600",
  },
  macroVal: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },

  // ACTIVE BURN BANNER
  activeBurnBanner: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 20,
  },
  burnBannerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  burnBannerTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  burnBannerTotal: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 16,
    fontWeight: "900",
  },
  burnBannerSubRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
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
    borderRadius: 24,
    marginBottom: 10,
  },
  briefingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  briefingTitle: {
    color: THEME.colors.cardTextPrimary,
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
    color: THEME.colors.cardTextSecondary,
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
    backgroundColor: THEME.colors.cardBgSolid,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: THEME.colors.cardBorder,
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
    color: THEME.colors.cardTextPrimary,
  },
  modalSub: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(11, 22, 18, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(11, 22, 18, 0.12)",
  },
  modalSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
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
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.7)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  hoursChipActive: {
    backgroundColor: THEME.colors.accentTeal,
    borderColor: THEME.colors.accentTeal,
  },
  hoursChipText: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  hoursChipTextActive: {
    color: "#ffffff",
  },
  sleepStepperBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  qualityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  qualityCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    borderRadius: 12,
    padding: 10,
  },
  qualityCardActive: {
    borderColor: "#b45309",
    backgroundColor: "rgba(180, 83, 9, 0.08)",
  },
  qualityTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  qualityTitleActive: {
    color: "#b45309",
  },
  qualityDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10.5,
    marginTop: 2,
  },
  telemetryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    gap: 6,
  },
  telemetryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  telemetryLabel: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  telemetryVal: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "800",
  },
  modalPrimaryBtn: {
    backgroundColor: THEME.colors.accentTeal,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  modalPrimaryBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  // DIGITAL WELLBEING SPECIFIC
  screenUsageCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 14,
  },
  screenUsageLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
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
    color: THEME.colors.cardTextPrimary,
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
    backgroundColor: "rgba(180, 205, 195, 0.35)",
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
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    marginTop: 6,
    fontWeight: "600",
  },
  categoryList: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  categoryName: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  categoryMins: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    fontWeight: "800",
  },
  wellbeingSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    marginTop: 8,
    marginBottom: 4,
  },
  switchTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  switchDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  hydrationCardWide: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 20,
  },
  hydrationBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  hydrationBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  hydrationBarTrack: {
    height: 6,
    backgroundColor: "rgba(180, 205, 195, 0.35)",
    borderRadius: 3,
    marginTop: 14,
    marginBottom: 10,
    overflow: "hidden",
  },
  hydrationBarFill: {
    height: 6,
    backgroundColor: "#0891b2",
    borderRadius: 3,
  },
  hydrationQuickRow: {
    marginTop: 4,
  },
  hydrationPillsScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hydrationQuickPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  hydrationQuickIcon: {
    fontSize: 13,
  },
  hydrationQuickText: {
    color: "#0891b2",
    fontSize: 12,
    fontWeight: "700",
  },
  hydrationQuickDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(200, 218, 210, 0.6)",
    marginHorizontal: 4,
  },
  waterMiniBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(8, 145, 178, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationTabsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(11, 22, 18, 0.06)",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  hydrationTabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationTabBtnActive: {
    backgroundColor: THEME.colors.accentTeal,
    borderWidth: 1,
    borderColor: THEME.colors.accentTeal,
  },
  hydrationTabBtnText: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  hydrationTabBtnTextActive: {
    color: "#ffffff",
  },
  reservoirHeroCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  reservoirRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  reservoirLeftCol: {
    flex: 1,
  },
  reservoirPercent: {
    fontSize: 34,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  reservoirSubtitle: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
    letterSpacing: 0.5,
    marginTop: 2,
    marginBottom: 6,
  },
  reservoirBadgePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  reservoirBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  reservoirRightCol: {
    alignItems: "flex-end",
  },
  reservoirBigMl: {
    fontSize: 26,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  reservoirMlUnit: {
    fontSize: 14,
    color: THEME.colors.cardTextSecondary,
    fontWeight: "700",
  },
  reservoirCupsCount: {
    fontSize: 12,
    color: THEME.colors.cardTextSecondary,
    fontWeight: "600",
    marginTop: 2,
  },
  reservoirMetaBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  reservoirMetaText: {
    fontSize: 10,
    color: THEME.colors.cardTextSecondary,
  },
  reservoirGaugeTrack: {
    height: 8,
    backgroundColor: "rgba(180, 205, 195, 0.35)",
    borderRadius: 4,
    overflow: "hidden",
  },
  reservoirGaugeFill: {
    height: 8,
    backgroundColor: "#0891b2",
    borderRadius: 4,
  },
  hydrationSectionBox: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
  },
  hydrationSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  hydrationSectionTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  beverageChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  beverageChip: {
    flex: 1,
    minWidth: "47%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
  },
  beverageChipIcon: {
    fontSize: 20,
  },
  beverageChipName: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  beverageChipFactor: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  containerPresetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  containerPresetCard: {
    width: "31%",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
  },
  presetIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  presetLabel: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  presetBadge: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  cupMatrixCount: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    fontWeight: "700",
    marginLeft: "auto",
  },
  cupsMatrixGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  cupMatrixItem: {
    width: "18%",
    aspectRatio: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
  },
  cupMatrixItemFilled: {
    backgroundColor: "rgba(8, 145, 178, 0.15)",
    borderColor: "rgba(8, 145, 178, 0.4)",
  },
  cupMatrixIndex: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  customIntakeRow: {
    flexDirection: "row",
    gap: 8,
  },
  customVolChip: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.55)",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  customVolText: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "700",
  },
  hydrationEmptyBox: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationEmptyText: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    textAlign: "center",
    fontWeight: "600",
  },
  hydrationEntryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
  },
  hydrationEntryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hydrationEntryIcon: {
    fontSize: 18,
  },
  hydrationEntryName: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  hydrationEntryTime: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    marginTop: 1,
    fontWeight: "600",
  },
  hydrationEntryRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hydrationEntryAmount: {
    color: "#0891b2",
    fontSize: 13,
    fontWeight: "800",
  },
  hydrationDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationCardReminderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(8, 145, 178, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(8, 145, 178, 0.2)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 6,
    marginBottom: 8,
  },
  hydrationCardReminderText: {
    color: "#0891b2",
    fontSize: 11,
    fontWeight: "700",
  },
  hydrationCardReminderAction: {
    color: "#0891b2",
    fontSize: 11,
    fontWeight: "800",
  },
  hydrationQuickStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(8, 145, 178, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(8, 145, 178, 0.2)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 2,
    marginBottom: 4,
  },
  hydrationQuickStripText: {
    color: "#0891b2",
    fontSize: 12,
    fontWeight: "700",
  },
  hydrationQuickStripAction: {
    color: "#0891b2",
    fontSize: 11,
    fontWeight: "800",
  },
  hydrationStationCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(8, 145, 178, 0.3)",
    padding: 16,
    marginBottom: 6,
    ...THEME.shadows.card,
  },
  hydrationStationHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  hydrationStationIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(8, 145, 178, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationStationTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  hydrationStationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hydrationStationBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  hydrationStationSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  hydrationStationBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(200, 218, 210, 0.4)",
  },
  hydrationStationLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  hydrationStationIntervalRow: {
    flexDirection: "row",
    gap: 8,
  },
  hydrationStationChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.5)",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationStationChipActive: {
    backgroundColor: "#0891b2",
    borderColor: "#0891b2",
  },
  hydrationStationChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.cardTextSecondary,
  },
  hydrationStationChipTextActive: {
    color: "#ffffff",
    fontWeight: "900",
  },
  hydrationStationFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  hydrationStationSyncNotice: {
    fontSize: 10,
    fontWeight: "600",
    color: THEME.colors.cardTextSecondary,
  },
  hydrationStationTestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(8, 145, 178, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(8, 145, 178, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  hydrationStationTestBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0891b2",
  },
  roadmapIntroBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(8, 145, 178, 0.1)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(8, 145, 178, 0.3)",
    marginBottom: 4,
  },
  roadmapIntroText: {
    flex: 1,
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  roadmapSlotCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  roadmapSlotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  roadmapTime: {
    color: "#0891b2",
    fontSize: 12,
    fontWeight: "800",
  },
  roadmapMlBadge: {
    backgroundColor: "rgba(8, 145, 178, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(8, 145, 178, 0.3)",
  },
  roadmapMlText: {
    color: "#0891b2",
    fontSize: 11,
    fontWeight: "800",
  },
  roadmapPeriodName: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  roadmapPurpose: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  urineGuideCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  urineGuideTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  urineColorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  urineGuideTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  urineStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  urineStatusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  urineGuideDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  caloriesMacroCardWide: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 20,
  },
  permissionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    marginBottom: 14,
  },
  permissionTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  permissionDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
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
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  permissionBtnSecondary: {
    backgroundColor: "rgba(168, 85, 247, 0.12)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.3)",
  },
  permissionBtnSecondaryText: {
    color: "#7e22ce",
    fontSize: 11,
    fontWeight: "800",
  },
  emptyCategoryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    marginBottom: 10,
    alignItems: "center",
  },
  emptyCategoryText: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    fontWeight: "600",
  },
  pillarFocusLiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  pillarFocusLiveBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  wellbeingTabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  wellbeingTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "rgba(11, 22, 18, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(11, 22, 18, 0.12)",
  },
  wellbeingTabBtnActive: {
    backgroundColor: THEME.colors.accentTeal,
    borderColor: THEME.colors.accentTeal,
  },
  wellbeingTabBtnText: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  wellbeingTabBtnTextActive: {
    color: "#ffffff",
  },
  tabBadgeLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  quickFocusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },
  quickFocusIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickFocusTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  quickFocusSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  activeFocusBox: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  activeFocusHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeFocusTypeTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  activeFocusPercentText: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  bigFocusClockContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  bigFocusClockDigits: {
    fontSize: 54,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
  },
  bigFocusClockSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  quoteCard: {
    backgroundColor: THEME.colors.cardBg,
    borderLeftWidth: 3,
    borderLeftColor: "#10b981",
    borderRadius: 24,
    padding: 12,
  },
  quoteText: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 18,
  },
  quoteAuthor: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "right",
  },
  focusActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  focusActionBtnText: {
    color: "#050b08",
    fontSize: 13,
    fontWeight: "800",
  },
  focusActionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  focusActionBtnSecondaryText: {
    color: "#38bdf8",
    fontSize: 13,
    fontWeight: "700",
  },
  focusCompleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  focusCompleteBtnText: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "700",
  },
  focusCancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  focusCancelBtnText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700",
  },
  presetGrid: {
    gap: 8,
  },
  presetCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.55)",
  },
  presetCardTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  presetMinutesPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  presetMinutesText: {
    fontSize: 11,
    fontWeight: "800",
  },
  presetCardDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  distractionList: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    gap: 6,
  },
  distractionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  distractionRowActive: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  distractionName: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12.5,
    fontWeight: "700",
  },
  distractionDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10.5,
    marginTop: 2,
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(200, 218, 210, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  historyList: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    gap: 8,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 218, 210, 0.35)",
  },
  historyTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  historySub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    marginTop: 2,
    fontWeight: "600",
  },
  starRow: {
    flexDirection: "row",
    gap: 2,
  },
  bedtimeHoursRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    marginBottom: 10,
  },
  bedtimeBox: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    alignItems: "center",
    gap: 4,
  },
  bedtimeLabel: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10.5,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  bedtimeVal: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  breathingBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 11, 8, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  breathingPanel: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: THEME.colors.cardBgSolid,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    alignItems: "center",
  },
  breathingTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 12,
  },
  breathingSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 24,
  },
  breathingCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: "#38bdf8",
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  breathingCounter: {
    fontSize: 38,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  breathingPill: {
    color: "#0284c7",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  breathingDismissBtn: {
    backgroundColor: THEME.colors.accentTeal,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.accentTeal,
  },
  breathingDismissText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  reflectionPanel: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: THEME.colors.cardBgSolid,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    alignItems: "center",
  },
  reflectionTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 10,
  },
  reflectionSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  reflectionStarsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  reflectionChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: 12,
  },
  reflectionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.7)",
  },
  reflectionChipActive: {
    backgroundColor: THEME.colors.accentTeal,
    borderColor: THEME.colors.accentTeal,
  },
  reflectionChipText: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  reflectionChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  syncSmallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  syncSmallBtnText: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "700",
  },
  realAppRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
  },
  realAppIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  realAppIconPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(168, 85, 247, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  realAppIconInitial: {
    color: "#a855f7",
    fontSize: 14,
    fontWeight: "800",
  },
  realAppName: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "700",
    maxWidth: 160,
  },
  realAppTime: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  realAppTrack: {
    height: 4,
    backgroundColor: "rgba(180, 205, 195, 0.35)",
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
  },
  realAppFill: {
    height: 4,
    borderRadius: 2,
  },
});
