import THEME from "@/constants/theme";
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
  TextInput,
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
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  AlertCircle,
  Timer,
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
  SleepRecord,
  ScreenTimeRecord,
  FocusSessionRecord,
  WellbeingConfigRecord,
} from "@/services/db";
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
    }
    loadLocalHealthState();
  }, []);

  // Subscribe to live Focus Mode ticker & state machine
  useEffect(() => {
    const unsub = digitalWellbeingService.subscribe((state) => {
      setLiveFocus(state);
      setFocusModeActive(state.isActive);
    });
    return unsub;
  }, []);

  // Guided breathing timer effect (60 seconds box breathing)
  useEffect(() => {
    let interval: any;
    if (isBreathingMode) {
      setBreathingSeconds(60);
      interval = setInterval(() => {
        setBreathingSeconds((prev) => {
          if (prev <= 1) {
            setIsBreathingMode(false);
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isBreathingMode]);

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

  // Live continuous steps & active calories (from phone accelerometer pedometer or wearable)
  const [liveSensorMetrics, setLiveSensorMetrics] = useState(() => fitnessWatchSensor.getSnapshot());

  useEffect(() => {
    const unsub = fitnessWatchSensor.subscribe((snap) => {
      setLiveSensorMetrics(snap);
    });
    return unsub;
  }, []);

  // Base metrics
  const workoutCaloriesBurned =
    workouts?.reduce((acc: number, w: any) => acc + (Number(w.caloriesBurned) || 0), 0) || 0;

  // Use live continuous steps (wearable or phone pedometer), fall back to backend dashboard
  const stepsCount = Math.max(liveSensorMetrics.dailySteps, dashboard?.steps || 0);
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
    if (hydration.score > 0) return hydration.score;
    if (waterCups === 0) return 0.0;
    const ratio = Math.min(1.25, waterCups / 8);
    return Number(Math.min(10.0, ratio * 8.5 + (waterCups >= 8 ? 1.5 : 0)).toFixed(1));
  }, [hydration.score, waterCups]);

  const dynamicHydrationLabel = useMemo(() => {
    if (hydration.statusLabel && hydration.todayMl > 0) return hydration.statusLabel;
    if (waterCups === 0) return "Not logged • Tap to log";
    if (waterCups >= 8) return `${waterCups} cups • Fully Hydrated`;
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

  const handleConfirmCompleteFocus = async () => {
    triggerHaptic("success");
    await digitalWellbeingService.completeSession(reflectionScore, reflectionNote);
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Smartphone size={14} color={liveFocus.isActive ? "#10b981" : "#a855f7"} />
                <Text style={styles.pillarTitle}>Screen</Text>
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
                      { color: liveFocus.isPaused ? "#f59e0b" : "#10b981" },
                    ]}
                  >
                    {liveFocus.isPaused ? "PAUSED" : "FOCUS"}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.pillarScore, { color: "#a855f7" }]}>
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
                      ? liveFocus.isPaused ? "#f59e0b" : "#10b981"
                      : "#a855f7",
                  },
                ]}
              />
            </View>
            <Text style={styles.pillarSubtitle} numberOfLines={1}>
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
              <Droplet size={18} color="#06b6d4" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.bioCardLabel}>Hydration & Electrolytes</Text>
                  <View style={[styles.hydrationBadgePill, { backgroundColor: `${hydration.statusBadgeColor}22`, borderColor: `${hydration.statusBadgeColor}55` }]}>
                    <Text style={[styles.hydrationBadgeText, { color: hydration.statusBadgeColor }]}>
                      {hydration.percentUsed}%
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={[styles.pillarScore, { color: "#06b6d4" }]}>
                    {dynamicHydrationScore > 0 ? dynamicHydrationScore.toFixed(1) : "0.0"}
                  </Text>
                  <ChevronRight size={16} color="#64748b" />
                </View>
              </View>
              <Text style={styles.bioCardValue}>
                {hydration.todayMl > 0 ? `${hydration.todayMl.toLocaleString()} ml` : `${waterCups * 250} ml`}
                <Text style={{ fontSize: 13, color: "#64748b", fontWeight: "600" }}>
                  {" "}/ {hydration.targetMl.toLocaleString()} ml ({waterCups} / {hydration.targetCups} cups)
                </Text>
              </Text>
              <Text style={styles.pillarSubtitle}>{dynamicHydrationLabel}</Text>
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={styles.achievementsTrophyIcon}>
                <Trophy size={18} color="#f59e0b" />
              </View>
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.achievementsSpotlightTitle}>Achievements & Badges</Text>
                  <View style={styles.xpMiniPill}>
                    <Text style={styles.xpMiniText}>+{gamification?.totalXp || 0} XP</Text>
                  </View>
                </View>
                <Text style={styles.achievementsSpotlightSub}>
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
              {liveSensorMetrics.isWearableSourceActive ? "⌚ Wearable: " : "🚶 Steps: "}
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
      {/* DIGITAL WELLBEING & MINDFUL FOCUS SUITE (MINDFUL ENGINE)  */}
      {/* ========================================================= */}
      <Modal
        visible={showScreenTimeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowScreenTimeModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalPanel, { maxHeight: "90%" }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[styles.modalIconBox, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
                  <Smartphone size={18} color="#a855f7" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Mindful Wellbeing & Focus</Text>
                  <Text style={styles.modalSub}>Android telemetry & distraction shield</Text>
                </View>
              </View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setShowScreenTimeModal(false)}>
                <X size={16} color="#94a3b8" />
              </Pressable>
            </View>

            {/* Sub-navigation Tabs */}
            <View style={styles.wellbeingTabsRow}>
              <Pressable
                style={[styles.wellbeingTabBtn, wellbeingTab === "usage" && styles.wellbeingTabBtnActive]}
                onPress={() => {
                  triggerHaptic();
                  setWellbeingTab("usage");
                }}
              >
                <Smartphone size={13} color={wellbeingTab === "usage" ? "#a855f7" : "#64748b"} />
                <Text style={[styles.wellbeingTabBtnText, wellbeingTab === "usage" && styles.wellbeingTabBtnTextActive]}>
                  Usage
                </Text>
              </Pressable>

              <Pressable
                style={[styles.wellbeingTabBtn, wellbeingTab === "focus" && styles.wellbeingTabBtnActive]}
                onPress={() => {
                  triggerHaptic();
                  setWellbeingTab("focus");
                }}
              >
                <Timer size={13} color={wellbeingTab === "focus" ? "#10b981" : "#64748b"} />
                <Text style={[styles.wellbeingTabBtnText, wellbeingTab === "focus" && styles.wellbeingTabBtnTextActive]}>
                  Focus Mode
                </Text>
                {liveFocus.isActive && (
                  <View style={[styles.tabBadgeLiveDot, { backgroundColor: liveFocus.isPaused ? "#f59e0b" : "#10b981" }]} />
                )}
              </Pressable>

              <Pressable
                style={[styles.wellbeingTabBtn, wellbeingTab === "limits" && styles.wellbeingTabBtnActive]}
                onPress={() => {
                  triggerHaptic();
                  setWellbeingTab("limits");
                }}
              >
                <Sliders size={13} color={wellbeingTab === "limits" ? "#38bdf8" : "#64748b"} />
                <Text style={[styles.wellbeingTabBtnText, wellbeingTab === "limits" && styles.wellbeingTabBtnTextActive]}>
                  Wind Down
                </Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* TAB 1: USAGE & TELEMETRY */}
              {wellbeingTab === "usage" && (
                <View>
                  {/* Today's Usage Banner */}
                  <View style={styles.screenUsageCard}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={styles.screenUsageLabel}>TODAY'S SCREEN TIME</Text>
                      {screenTelemetry.unlockCount > 0 && (
                        <Text style={{ fontSize: 11, color: "#94a3b8", fontWeight: "600" }}>
                          🔓 {screenTelemetry.unlockCount} Unlocks Today
                        </Text>
                      )}
                    </View>
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
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                      <Text style={styles.screenLimitSub}>
                        Daily Target: {Math.floor(screenLimitMinutes / 60)}h {screenLimitMinutes % 60}m
                      </Text>
                      <Text style={[styles.screenLimitSub, { color: "#cbd5e1" }]}>
                        {Math.min(100, Math.round((screenMinutesToday / screenLimitMinutes) * 100))}% used
                      </Text>
                    </View>
                  </View>

                  {/* Android Native Permissions Center (Mindful Engine) */}
                  {usagePermissionGranted ? (
                    <View style={[styles.permissionCard, { borderColor: "rgba(16, 185, 129, 0.35)", backgroundColor: "rgba(16, 185, 129, 0.08)" }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <CheckCircle2 size={17} color="#10b981" />
                          <Text style={[styles.permissionTitle, { color: "#10b981" }]}>Android UsageStats Active</Text>
                        </View>
                        <Pressable
                          style={styles.syncSmallBtn}
                          onPress={refreshScreenTime}
                          disabled={isScreenRefreshing}
                        >
                          <RotateCw size={11} color="#10b981" />
                          <Text style={styles.syncSmallBtnText}>{isScreenRefreshing ? "Syncing..." : "Sync Live"}</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.permissionDesc}>
                        Connected to Android UsageStatsManager. Reading live foreground screen time and app usage from your phone.
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.permissionCard, { borderColor: "rgba(245, 158, 11, 0.4)", backgroundColor: "rgba(245, 158, 11, 0.08)" }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <AlertCircle size={18} color="#f59e0b" />
                        <Text style={[styles.permissionTitle, { color: "#f59e0b" }]}>Usage Access Required</Text>
                      </View>
                      <Text style={styles.permissionDesc}>
                        Lumen needs Android Usage Access to read real screen time and show your installed app stats.
                      </Text>
                      <Pressable
                        style={[styles.permissionBtn, { backgroundColor: "#f59e0b" }]}
                        onPress={requestUsagePermission}
                      >
                        <Text style={[styles.permissionBtnText, { color: "#050b08" }]}>🛡️ Grant Usage Access (1-Tap)</Text>
                      </Pressable>
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                        <Pressable
                          style={[styles.permissionBtnSecondary, { flex: 1 }]}
                          onPress={requestAccessibilityAndUsagePermission}
                        >
                          <Text style={styles.permissionBtnSecondaryText}>Guided Wizard</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.permissionBtnSecondary, { flex: 1 }]}
                          onPress={openDndSettings}
                        >
                          <Text style={styles.permissionBtnSecondaryText}>DND Policy</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {/* App Category Breakdown */}
                  <Text style={styles.modalSectionLabel}>CATEGORY USAGE TELEMETRY</Text>
                  {screenMinutesToday === 0 ? (
                    <View style={styles.emptyCategoryCard}>
                      <Text style={styles.emptyCategoryText}>
                        No screen time recorded yet today. Tap "Grant Usage Access" above to read actual phone stats.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.categoryList}>
                      {[
                        {
                          name: "💼 Productivity & Work",
                          min: screenTelemetry.categories.productivity.minutes || Math.round(screenMinutesToday * 0.45),
                          pct: screenTelemetry.categories.productivity.percentage || 45,
                          color: "#10b981",
                        },
                        {
                          name: "💬 Social & Messages",
                          min: screenTelemetry.categories.social.minutes || Math.round(screenMinutesToday * 0.30),
                          pct: screenTelemetry.categories.social.percentage || 30,
                          color: "#a855f7",
                        },
                        {
                          name: "🎬 Video & Media",
                          min: screenTelemetry.categories.entertainment.minutes || Math.round(screenMinutesToday * 0.20),
                          pct: screenTelemetry.categories.entertainment.percentage || 20,
                          color: "#38bdf8",
                        },
                        {
                          name: "🎮 Gaming & Arcade",
                          min: screenTelemetry.categories.gaming.minutes || 0,
                          pct: screenTelemetry.categories.gaming.percentage || 0,
                          color: "#ef4444",
                        },
                        {
                          name: "⚡ Other & System",
                          min: screenTelemetry.categories.other.minutes || Math.max(1, Math.round(screenMinutesToday * 0.05)),
                          pct: screenTelemetry.categories.other.percentage || 5,
                          color: "#ec4899",
                        },
                      ].filter(c => c.min > 0 || c.pct > 0).map((cat, i) => (
                        <View key={i} style={{ marginBottom: 6 }}>
                          <View style={styles.categoryRow}>
                            <Text style={styles.categoryName}>{cat.name}</Text>
                            <Text style={[styles.categoryMins, { color: cat.color }]}>
                              {Math.floor(cat.min / 60)}h {cat.min % 60}m ({cat.pct}%)
                            </Text>
                          </View>
                          <View style={[styles.screenBarTrack, { height: 4, marginTop: 4 }]}>
                            <View style={[styles.screenBarFill, { width: `${cat.pct}%`, backgroundColor: cat.color, height: 4 }]} />
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Real Device Apps Telemetry (Mindful Engine) */}
                  {screenTelemetry.apps && screenTelemetry.apps.length > 0 && (
                    <View style={{ marginTop: 14 }}>
                      <Text style={styles.modalSectionLabel}>TOP APPS USED TODAY</Text>
                      <View style={{ gap: 8 }}>
                        {screenTelemetry.apps.slice(0, 10).map((app, i) => (
                          <View key={app.packageName || i} style={styles.realAppRow}>
                            {app.icon ? (
                              <Image source={{ uri: app.icon }} style={styles.realAppIcon} />
                            ) : (
                              <View style={styles.realAppIconPlaceholder}>
                                <Text style={styles.realAppIconInitial}>{app.appName.charAt(0).toUpperCase()}</Text>
                              </View>
                            )}
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                <Text style={styles.realAppName} numberOfLines={1}>{app.appName}</Text>
                                <Text style={styles.realAppTime}>
                                  {Math.floor(app.screenMinutes / 60) > 0 ? `${Math.floor(app.screenMinutes / 60)}h ` : ""}
                                  {app.screenMinutes % 60}m
                                </Text>
                              </View>
                              <View style={styles.realAppTrack}>
                                <View
                                  style={[
                                    styles.realAppFill,
                                    {
                                      width: `${Math.min(100, Math.max(4, (app.screenMinutes / (screenTelemetry.totalScreenMinutes || 1)) * 100))}%`,
                                      backgroundColor:
                                        app.category === "productivity"
                                          ? "#10b981"
                                          : app.category === "social"
                                          ? "#a855f7"
                                          : app.category === "entertainment"
                                          ? "#38bdf8"
                                          : app.category === "gaming"
                                          ? "#ef4444"
                                          : "#94a3b8",
                                    },
                                  ]}
                                />
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Quick Action to switch to Focus Mode */}
                  <Pressable
                    style={styles.quickFocusBanner}
                    onPress={() => {
                      triggerHaptic();
                      setWellbeingTab("focus");
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={styles.quickFocusIconBox}>
                        <Zap size={16} color="#10b981" />
                      </View>
                      <View>
                        <Text style={styles.quickFocusTitle}>Ready for Deep Work?</Text>
                        <Text style={styles.quickFocusSub}>Start a Focus Mode session to shield distractions</Text>
                      </View>
                    </View>
                    <ChevronRight size={16} color="#64748b" />
                  </Pressable>
                </View>
              )}

              {/* TAB 2: FOCUS MODE & POMODORO */}
              {wellbeingTab === "focus" && (
                <View>
                  {liveFocus.isActive ? (
                    /* Active Focus Session Countdown HUD */
                    <View style={styles.activeFocusBox}>
                      <View style={styles.activeFocusHeaderRow}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <View style={[styles.pulsingDot, { backgroundColor: liveFocus.isPaused ? "#f59e0b" : "#10b981" }]} />
                          <Text style={styles.activeFocusTypeTitle}>
                            {liveFocus.sessionType.toUpperCase().replace("_", " ")}
                          </Text>
                        </View>
                        <Text style={styles.activeFocusPercentText}>
                          {liveFocus.progressPercent}% DONE
                        </Text>
                      </View>

                      {/* Large Digital Clock readout */}
                      <View style={styles.bigFocusClockContainer}>
                        <Text style={styles.bigFocusClockDigits}>
                          {Math.floor(liveFocus.remainingSeconds / 60).toString().padStart(2, "0")}:
                          {(liveFocus.remainingSeconds % 60).toString().padStart(2, "0")}
                        </Text>
                        <Text style={styles.bigFocusClockSub}>
                          {liveFocus.isPaused ? "Session Paused • Take a Breath" : "Focus Flow In Progress"}
                        </Text>
                      </View>

                      {/* Progress Bar */}
                      <View style={[styles.screenBarTrack, { height: 8, marginTop: 4, marginBottom: 14 }]}>
                        <View
                          style={[
                            styles.screenBarFill,
                            {
                              width: `${liveFocus.progressPercent}%`,
                              backgroundColor: liveFocus.isPaused ? "#f59e0b" : "#10b981",
                              height: 8,
                            },
                          ]}
                        />
                      </View>

                      {/* Mindful Quote Banner */}
                      <View style={styles.quoteCard}>
                        <Text style={styles.quoteText}>"{liveFocus.currentQuote.text}"</Text>
                        <Text style={styles.quoteAuthor}>— {liveFocus.currentQuote.author}</Text>
                      </View>

                      {/* Control buttons */}
                      <View style={{ gap: 10, marginTop: 14 }}>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          {liveFocus.isPaused ? (
                            <Pressable
                              style={[styles.focusActionBtn, { backgroundColor: "#10b981", flex: 1 }]}
                              onPress={handleResumeFocus}
                            >
                              <Play size={16} color="#050b08" />
                              <Text style={styles.focusActionBtnText}>Resume</Text>
                            </Pressable>
                          ) : (
                            <Pressable
                              style={[styles.focusActionBtn, { backgroundColor: "#f59e0b", flex: 1 }]}
                              onPress={handlePauseFocus}
                            >
                              <Pause size={16} color="#050b08" />
                              <Text style={styles.focusActionBtnText}>Pause</Text>
                            </Pressable>
                          )}
                          <Pressable
                            style={[styles.focusActionBtnSecondary, { flex: 1 }]}
                            onPress={() => setIsBreathingMode(true)}
                          >
                            <Wind size={15} color="#38bdf8" />
                            <Text style={styles.focusActionBtnSecondaryText}>Breathe (60s)</Text>
                          </Pressable>
                        </View>

                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <Pressable
                            style={[styles.focusCompleteBtn, { flex: 1 }]}
                            onPress={handlePromptCompleteFocus}
                          >
                            <Check size={16} color="#10b981" />
                            <Text style={styles.focusCompleteBtnText}>Finish & Log</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.focusCancelBtn, { flex: 1 }]}
                            onPress={handleCancelFocus}
                          >
                            <X size={16} color="#ef4444" />
                            <Text style={styles.focusCancelBtnText}>End Early</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ) : (
                    /* Inactive: Setup New Focus Session */
                    <View>
                      <Text style={styles.modalSectionLabel}>CHOOSE FOCUS INTERVAL</Text>
                      <View style={styles.presetGrid}>
                        {FOCUS_PRESETS.map((p) => {
                          const isSelected = selectedFocusPreset === p.type;
                          return (
                            <Pressable
                              key={p.type}
                              style={[
                                styles.presetCard,
                                isSelected && { borderColor: p.accentColor, backgroundColor: "rgba(16, 185, 129, 0.08)" },
                              ]}
                              onPress={() => {
                                triggerHaptic();
                                setSelectedFocusPreset(p.type);
                                setSelectedFocusMinutes(p.minutes);
                              }}
                            >
                              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                                <Text style={[styles.presetCardTitle, isSelected && { color: p.accentColor }]}>
                                  {p.title}
                                </Text>
                                <View style={[styles.presetMinutesPill, { backgroundColor: `${p.accentColor}25` }]}>
                                  <Text style={[styles.presetMinutesText, { color: p.accentColor }]}>
                                    {p.minutes}m
                                  </Text>
                                </View>
                              </View>
                              <Text style={styles.presetCardDesc}>{p.description}</Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {/* Distracting App Categories Shield */}
                      <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>
                        DISTRACTION SHIELD (BLOCKLIST)
                      </Text>
                      <View style={styles.distractionList}>
                        {DISTRACTING_CATEGORIES.map((cat) => {
                          const isBlocked = blockedCategories.includes(cat.id);
                          return (
                            <Pressable
                              key={cat.id}
                              style={[styles.distractionRow, isBlocked && styles.distractionRowActive]}
                              onPress={() => toggleCategoryBlock(cat.id)}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.distractionName, isBlocked && { color: "#f8fafc" }]}>
                                  {cat.name}
                                </Text>
                                <Text style={styles.distractionDesc}>{cat.description}</Text>
                              </View>
                              <View
                                style={[
                                  styles.checkboxBox,
                                  isBlocked && { backgroundColor: "#10b981", borderColor: "#10b981" },
                                ]}
                              >
                                {isBlocked && <Check size={12} color="#050b08" />}
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>

                      {/* Mindful Quote Banner */}
                      <View style={[styles.quoteCard, { marginTop: 12 }]}>
                        <Text style={styles.quoteText}>
                          "Clarity about what matters provides clarity about what does not."
                        </Text>
                        <Text style={styles.quoteAuthor}>— Cal Newport</Text>
                      </View>

                      {/* Start Focus Button */}
                      <Pressable
                        style={[styles.modalPrimaryBtn, { backgroundColor: "#10b981", marginTop: 16 }]}
                        onPress={handleStartFocus}
                      >
                        <Play size={16} color="#050b08" style={{ marginRight: 6 }} />
                        <Text style={styles.modalPrimaryBtnText}>
                          Start Focus Session ({selectedFocusMinutes}m)
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Today's Focus Log Summary */}
                  {todayFocusSessions.length > 0 && (
                    <View style={{ marginTop: 16 }}>
                      <Text style={styles.modalSectionLabel}>TODAY'S COMPLETED SESSIONS</Text>
                      <View style={styles.historyList}>
                        {todayFocusSessions.map((s) => (
                          <View key={s.id} style={styles.historyRow}>
                            <View>
                              <Text style={styles.historyTitle}>
                                {s.sessionType.toUpperCase().replace("_", " ")}
                              </Text>
                              <Text style={styles.historySub}>
                                {new Date(s.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • {Math.round(s.completedSeconds / 60)} mins
                              </Text>
                            </View>
                            <View style={styles.starRow}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  size={12}
                                  color={(s.reflectionScore || 5) >= star ? "#f59e0b" : "#334155"}
                                  fill={(s.reflectionScore || 5) >= star ? "#f59e0b" : "transparent"}
                                />
                              ))}
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* TAB 3: LIMITS & WIND DOWN ROUTINE */}
              {wellbeingTab === "limits" && (
                <View>
                  {/* Daily Target Limit Selector */}
                  <Text style={styles.modalSectionLabel}>DAILY SCREEN LIMIT</Text>
                  <View style={styles.hoursChipsRow}>
                    {[120, 180, 240, 300, 360].map((mins) => {
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

                  {/* Bedtime Wind Down Routine */}
                  <Text style={[styles.modalSectionLabel, { marginTop: 16 }]}>BEDTIME WIND DOWN</Text>
                  <View style={styles.wellbeingSwitchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchTitle}>Bedtime Routine</Text>
                      <Text style={styles.switchDesc}>Mute alerts 30m before sleep to boost REM recovery</Text>
                    </View>
                    <Switch
                      value={windDownActive}
                      onValueChange={(val) => {
                        triggerHaptic();
                        setWindDownActive(val);
                      }}
                      trackColor={{ false: "#1e293b", true: "#38bdf8" }}
                      thumbColor={windDownActive ? "#050b08" : "#94a3b8"}
                    />
                  </View>

                  {/* Bedtime & Wakeup Hours Display */}
                  <View style={styles.bedtimeHoursRow}>
                    <View style={styles.bedtimeBox}>
                      <Moon size={16} color="#38bdf8" />
                      <Text style={styles.bedtimeLabel}>Bedtime Target</Text>
                      <Text style={styles.bedtimeVal}>{bedtimeHour} PM</Text>
                    </View>
                    <View style={styles.bedtimeBox}>
                      <Clock size={16} color="#10b981" />
                      <Text style={styles.bedtimeLabel}>Wake Up Target</Text>
                      <Text style={styles.bedtimeVal}>{wakeHour} AM</Text>
                    </View>
                  </View>

                  {/* Auto DND Toggle */}
                  <View style={styles.wellbeingSwitchRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.switchTitle}>Auto DND During Sleep</Text>
                      <Text style={styles.switchDesc}>Silence non-starred phone notifications</Text>
                    </View>
                    <Switch
                      value={dndAutoToggle}
                      onValueChange={(val) => {
                        triggerHaptic();
                        setDndAutoToggle(val);
                      }}
                      trackColor={{ false: "#1e293b", true: "#a855f7" }}
                      thumbColor={dndAutoToggle ? "#050b08" : "#94a3b8"}
                    />
                  </View>

                  {/* Save Button */}
                  <Pressable
                    style={[styles.modalPrimaryBtn, { marginTop: 16 }]}
                    onPress={handleSaveWellbeing}
                  >
                    <Check size={16} color="#050b08" style={{ marginRight: 6 }} />
                    <Text style={styles.modalPrimaryBtnText}>Save Wellbeing Settings</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* GUIDED BREATHING BREAK MODAL (60s RELAXATION)             */}
      {/* ========================================================= */}
      <Modal visible={isBreathingMode} transparent animationType="fade">
        <View style={styles.breathingBackdrop}>
          <View style={styles.breathingPanel}>
            <Wind size={36} color="#38bdf8" />
            <Text style={styles.breathingTitle}>Mindful Breath</Text>
            <Text style={styles.breathingSub}>
              Box Breathing: Inhale 4s • Hold 4s • Exhale 4s
            </Text>
            <View style={styles.breathingCircle}>
              <Text style={styles.breathingCounter}>{breathingSeconds}s</Text>
              <Text style={styles.breathingPill}>
                {breathingSeconds % 16 < 4
                  ? "Inhale Deeply"
                  : breathingSeconds % 16 < 8
                  ? "Hold Breath"
                  : breathingSeconds % 16 < 12
                  ? "Exhale Slowly"
                  : "Rest & Be Still"}
              </Text>
            </View>
            <Pressable
              style={styles.breathingDismissBtn}
              onPress={() => setIsBreathingMode(false)}
            >
              <Text style={styles.breathingDismissText}>Return to Focus</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* POST-SESSION REFLECTION MODAL                             */}
      {/* ========================================================= */}
      <Modal visible={showReflectionModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.reflectionPanel}>
            <Sparkles size={28} color="#10b981" />
            <Text style={styles.reflectionTitle}>Focus Session Complete!</Text>
            <Text style={styles.reflectionSub}>How focused did you feel during this session?</Text>
            <View style={styles.reflectionStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => {
                    triggerHaptic();
                    setReflectionScore(star);
                  }}
                  style={{ padding: 6 }}
                >
                  <Star
                    size={28}
                    color={reflectionScore >= star ? "#f59e0b" : "#475569"}
                    fill={reflectionScore >= star ? "#f59e0b" : "transparent"}
                  />
                </Pressable>
              ))}
            </View>
            <View style={styles.reflectionChipsRow}>
              {["Deep Flow", "High Output", "Minor Distractions", "Refreshed"].map((tag) => (
                <Pressable
                  key={tag}
                  style={[styles.reflectionChip, reflectionNote === tag && styles.reflectionChipActive]}
                  onPress={() => {
                    triggerHaptic();
                    setReflectionNote(tag);
                  }}
                >
                  <Text
                    style={[
                      styles.reflectionChipText,
                      reflectionNote === tag && styles.reflectionChipTextActive,
                    ]}
                  >
                    {tag}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[styles.modalPrimaryBtn, { backgroundColor: "#10b981", marginTop: 14 }]}
              onPress={handleConfirmCompleteFocus}
            >
              <Check size={16} color="#050b08" style={{ marginRight: 6 }} />
              <Text style={styles.modalPrimaryBtnText}>Log to Health OS</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ========================================================= */}
      {/* HYDRATION & ELECTROLYTE MASTERY MODAL                     */}
      {/* ========================================================= */}
      <Modal
        visible={showHydrationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHydrationModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalPanel, { maxHeight: "90%" }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={styles.hydrationHeaderIcon}>
                    <Droplet size={18} color="#06b6d4" />
                  </View>
                  <Text style={styles.modalTitle}>Cellular Hydration Hub</Text>
                </View>
                <Text style={styles.modalSub}>
                  Dynamic Target: {hydration.targetMl.toLocaleString()} ml • {hydration.targetCups} cups
                </Text>
              </View>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => {
                  triggerHaptic();
                  setShowHydrationModal(false);
                }}
              >
                <X size={18} color="#cbd5e1" />
              </Pressable>
            </View>

            {/* Segmented Navigation Tabs */}
            <View style={styles.hydrationTabsRow}>
              <Pressable
                style={[
                  styles.hydrationTabBtn,
                  hydrationModalTab === "overview" && styles.hydrationTabBtnActive,
                ]}
                onPress={() => {
                  triggerHaptic();
                  setHydrationModalTab("overview");
                }}
              >
                <Text
                  style={[
                    styles.hydrationTabBtnText,
                    hydrationModalTab === "overview" && styles.hydrationTabBtnTextActive,
                  ]}
                >
                  Overview & Log
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.hydrationTabBtn,
                  hydrationModalTab === "roadmap" && styles.hydrationTabBtnActive,
                ]}
                onPress={() => {
                  triggerHaptic();
                  setHydrationModalTab("roadmap");
                }}
              >
                <Text
                  style={[
                    styles.hydrationTabBtnText,
                    hydrationModalTab === "roadmap" && styles.hydrationTabBtnTextActive,
                  ]}
                >
                  Hourly Roadmap
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.hydrationTabBtn,
                  hydrationModalTab === "urine" && styles.hydrationTabBtnActive,
                ]}
                onPress={() => {
                  triggerHaptic();
                  setHydrationModalTab("urine");
                }}
              >
                <Text
                  style={[
                    styles.hydrationTabBtnText,
                    hydrationModalTab === "urine" && styles.hydrationTabBtnTextActive,
                  ]}
                >
                  Clinical Guide
                </Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              {/* TAB 1: OVERVIEW & QUICK LOG */}
              {hydrationModalTab === "overview" && (
                <View style={{ gap: 16 }}>
                  {/* HERO RESERVOIR CARD */}
                  <View style={styles.reservoirHeroCard}>
                    <View style={styles.reservoirRow}>
                      <View style={styles.reservoirLeftCol}>
                        <Text style={styles.reservoirPercent}>{hydration.percentUsed}%</Text>
                        <Text style={styles.reservoirSubtitle}>OF DAILY TARGET</Text>
                        <View
                          style={[
                            styles.reservoirBadgePill,
                            {
                              backgroundColor: `${hydration.statusBadgeColor}22`,
                              borderColor: `${hydration.statusBadgeColor}55`,
                            },
                          ]}
                        >
                          <Text style={[styles.reservoirBadgeText, { color: hydration.statusBadgeColor }]}>
                            {hydration.statusLabel}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.reservoirRightCol}>
                        <Text style={styles.reservoirBigMl}>
                          {hydration.todayMl.toLocaleString()}
                          <Text style={styles.reservoirMlUnit}> ml</Text>
                        </Text>
                        <Text style={styles.reservoirCupsCount}>
                          {hydration.todayCups.toFixed(1)} / {hydration.targetCups} cups logged
                        </Text>
                        <View style={styles.reservoirMetaBox}>
                          <Sparkles size={12} color="#06b6d4" />
                          <Text style={styles.reservoirMetaText}>
                            Base 2,000ml + {Math.max(0, hydration.targetMl - 2000)}ml active burn
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Fluid Gauge Bar */}
                    <View style={styles.reservoirGaugeTrack}>
                      <View
                        style={[
                          styles.reservoirGaugeFill,
                          {
                            width: `${Math.min(100, (hydration.todayMl / (hydration.targetMl || 2000)) * 100)}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* ACTIVE BEVERAGE TYPE SELECTOR */}
                  <View style={styles.hydrationSectionBox}>
                    <View style={styles.hydrationSectionHeader}>
                      <Droplet size={14} color="#06b6d4" />
                      <Text style={styles.hydrationSectionTitle}>Selected Beverage Type</Text>
                    </View>
                    <View style={styles.beverageChipsRow}>
                      {Object.values(hydrationBeverageTypes).map((bev: any) => {
                        const isSelected = selectedHydrationBeverage === bev.id;
                        return (
                          <Pressable
                            key={bev.id}
                            style={[
                              styles.beverageChip,
                              isSelected && {
                                borderColor: bev.color,
                                backgroundColor: `${bev.color}1a`,
                              },
                            ]}
                            onPress={() => {
                              triggerHaptic();
                              setSelectedHydrationBeverage(bev.id);
                            }}
                          >
                            <Text style={styles.beverageChipIcon}>{bev.icon}</Text>
                            <View>
                              <Text
                                style={[
                                  styles.beverageChipName,
                                  isSelected && { color: bev.color, fontWeight: "800" },
                                ]}
                              >
                                {bev.name}
                              </Text>
                              <Text style={styles.beverageChipFactor}>
                                {bev.hydrationFactor}x factor
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* QUICK CONTAINER PRESETS (6 TILES) */}
                  <View style={styles.hydrationSectionBox}>
                    <View style={styles.hydrationSectionHeader}>
                      <Zap size={14} color="#10b981" />
                      <Text style={styles.hydrationSectionTitle}>Quick Container Presets</Text>
                    </View>
                    <View style={styles.containerPresetsGrid}>
                      {hydrationPresets.map((preset) => (
                        <Pressable
                          key={preset.id}
                          style={styles.containerPresetCard}
                          onPress={() => {
                            logDrink(preset.amountMl, selectedHydrationBeverage);
                          }}
                        >
                          <Text style={styles.presetIcon}>{preset.icon}</Text>
                          <Text style={styles.presetLabel} numberOfLines={1}>
                            {preset.label}
                          </Text>
                          <View
                            style={[
                              styles.presetBadge,
                              { backgroundColor: `${preset.color}20`, borderColor: `${preset.color}40` },
                            ]}
                          >
                            <Text style={[styles.presetBadgeText, { color: preset.color }]}>
                              +{preset.amountMl} ml
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* INTERACTIVE 10-CUP MATRIX */}
                  <View style={styles.hydrationSectionBox}>
                    <View style={styles.hydrationSectionHeader}>
                      <Droplet size={14} color="#38bdf8" />
                      <Text style={styles.hydrationSectionTitle}>Interactive Cups Matrix</Text>
                      <Text style={styles.cupMatrixCount}>
                        ({Math.round(hydration.todayCups)} / 10 cups)
                      </Text>
                    </View>
                    <View style={styles.cupsMatrixGrid}>
                      {Array.from({ length: 10 }).map((_, idx) => {
                        const isFilled = idx < Math.floor(hydration.todayCups);
                        return (
                          <Pressable
                            key={idx}
                            style={[
                              styles.cupMatrixItem,
                              isFilled && styles.cupMatrixItemFilled,
                            ]}
                            onPress={() => {
                              if (isFilled && idx === Math.floor(hydration.todayCups) - 1) {
                                decrementWater();
                              } else {
                                logDrink(250, selectedHydrationBeverage);
                              }
                            }}
                          >
                            <Droplet
                              size={20}
                              color={isFilled ? "#06b6d4" : "#334155"}
                              fill={isFilled ? "#06b6d4" : "transparent"}
                            />
                            <Text
                              style={[
                                styles.cupMatrixIndex,
                                isFilled && { color: "#06b6d4", fontWeight: "800" },
                              ]}
                            >
                              {idx + 1}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  {/* CUSTOM INTAKE VOLUME LOGGER */}
                  <View style={styles.hydrationSectionBox}>
                    <View style={styles.hydrationSectionHeader}>
                      <Sliders size={14} color="#f59e0b" />
                      <Text style={styles.hydrationSectionTitle}>Custom Volume Intake</Text>
                    </View>
                    <View style={styles.customIntakeRow}>
                      {[100, 200, 300, 500].map((vol) => (
                        <Pressable
                          key={vol}
                          style={styles.customVolChip}
                          onPress={() => logDrink(vol, selectedHydrationBeverage)}
                        >
                          <Text style={styles.customVolText}>+{vol} ml</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* TODAY'S INTAKE HISTORY LOG */}
                  <View style={styles.hydrationSectionBox}>
                    <View style={styles.hydrationSectionHeader}>
                      <Clock size={14} color="#a855f7" />
                      <Text style={styles.hydrationSectionTitle}>Today's Logged Intakes</Text>
                      <Text style={styles.cupMatrixCount}>
                        ({hydration.entries.length} entries)
                      </Text>
                    </View>

                    {hydration.entries.length === 0 ? (
                      <View style={styles.hydrationEmptyBox}>
                        <Text style={styles.hydrationEmptyText}>
                          No entries logged yet today. Tap any container or cup above to start!
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 8 }}>
                        {hydration.entries.slice().reverse().map((entry) => {
                          const bev = hydrationBeverageTypes[entry.beverageType || "water"] || {
                            name: "Water",
                            icon: "💧",
                            color: "#06b6d4",
                          };
                          const timeStr = entry.loggedAt
                            ? new Date(entry.loggedAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Just now";

                          return (
                            <View key={entry.id} style={styles.hydrationEntryRow}>
                              <View style={styles.hydrationEntryLeft}>
                                <Text style={styles.hydrationEntryIcon}>{bev.icon}</Text>
                                <View>
                                  <Text style={styles.hydrationEntryName}>{bev.name}</Text>
                                  <Text style={styles.hydrationEntryTime}>{timeStr}</Text>
                                </View>
                              </View>

                              <View style={styles.hydrationEntryRight}>
                                <Text style={styles.hydrationEntryAmount}>
                                  +{entry.amountMl} ml
                                </Text>
                                <Pressable
                                  style={styles.hydrationDeleteBtn}
                                  onPress={() => removeEntry(entry.id)}
                                >
                                  <Trash2 size={14} color="#ef4444" />
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* TAB 2: HOURLY ROADMAP */}
              {hydrationModalTab === "roadmap" && (
                <View style={{ gap: 12 }}>
                  <View style={styles.roadmapIntroBox}>
                    <Info size={16} color="#38bdf8" />
                    <Text style={styles.roadmapIntroText}>
                      Circadian fluid intake sustains cognitive peak without midnight sleep interruptions.
                    </Text>
                  </View>

                  {hydrationSchedule.map((slot, sIdx) => (
                    <View key={sIdx} style={styles.roadmapSlotCard}>
                      <View style={styles.roadmapSlotHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Clock size={14} color="#06b6d4" />
                          <Text style={styles.roadmapTime}>{slot.timeWindow}</Text>
                        </View>
                        <View style={styles.roadmapMlBadge}>
                          <Text style={styles.roadmapMlText}>{slot.recommendedMl} ml</Text>
                        </View>
                      </View>
                      <Text style={styles.roadmapPeriodName}>{slot.periodName}</Text>
                      <Text style={styles.roadmapPurpose}>{slot.purpose}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* TAB 3: CLINICAL URINE GUIDE */}
              {hydrationModalTab === "urine" && (
                <View style={{ gap: 12 }}>
                  <View style={styles.roadmapIntroBox}>
                    <Info size={16} color="#10b981" />
                    <Text style={styles.roadmapIntroText}>
                      Clinical hydration monitoring scale based on metabolic solute concentration.
                    </Text>
                  </View>

                  {[
                    {
                      level: "Level 1: Pale Straw / Lemon",
                      color: "#fef08a",
                      badge: "Optimal",
                      badgeColor: "#10b981",
                      description: "Ideal intracellular hydration equilibrium. Maintain normal sipping pace.",
                    },
                    {
                      level: "Level 2: Completely Clear",
                      color: "#f8fafc",
                      badge: "High Hydration",
                      badgeColor: "#38bdf8",
                      description: "High fluid volume. Supplement with electrolytes to prevent sodium flushing.",
                    },
                    {
                      level: "Level 3: Light Golden Yellow",
                      color: "#fde047",
                      badge: "Good",
                      badgeColor: "#84cc16",
                      description: "Healthy range. Drink 1 glass (250 ml) within the next hour.",
                    },
                    {
                      level: "Level 4: Dark Amber / Honey",
                      color: "#eab308",
                      badge: "Dehydrated",
                      badgeColor: "#f59e0b",
                      description: "Cellular deficit. Drink 500 ml immediately and reduce caffeine intake.",
                    },
                    {
                      level: "Level 5: Tea Brown / Dark Copper",
                      color: "#b45309",
                      badge: "Critical Deficit",
                      badgeColor: "#ef4444",
                      description: "Severe dehydration or high sweat loss. Rehydrate with electrolytes urgently.",
                    },
                  ].map((guide, gIdx) => (
                    <View key={gIdx} style={styles.urineGuideCard}>
                      <View style={styles.urineGuideTop}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View
                            style={[
                              styles.urineColorSwatch,
                              { backgroundColor: guide.color },
                            ]}
                          />
                          <Text style={styles.urineGuideTitle}>{guide.level}</Text>
                        </View>
                        <View
                          style={[
                            styles.urineStatusBadge,
                            { backgroundColor: `${guide.badgeColor}20`, borderColor: `${guide.badgeColor}40` },
                          ]}
                        >
                          <Text style={[styles.urineStatusText, { color: guide.badgeColor }]}>
                            {guide.badge}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.urineGuideDesc}>{guide.description}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(232, 241, 237, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
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
    color: THEME.colors.textOnDarkPrimary,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1.5,
    borderColor: THEME.colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: THEME.colors.accentTeal,
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
    paddingRight: 12,
  },
  greetingTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  greetingName: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 24,
    fontWeight: "900",
  },
  energySubtext: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
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
    width: (SCREEN_WIDTH - 42) / 2,
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  pillarTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pillarTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  pillarScore: {
    fontSize: 15,
    fontWeight: "900",
  },
  pillarBarTrack: {
    height: 4,
    backgroundColor: "rgba(180, 205, 195, 0.35)",
    borderRadius: 2,
    marginVertical: 10,
    overflow: "hidden",
  },
  pillarBarFill: {
    height: 4,
    borderRadius: 2,
  },
  pillarSubtitle: {
    color: THEME.colors.cardTextSecondary,
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
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.55)",
    borderRadius: 12,
    padding: 10,
  },
  qualityCardActive: {
    borderColor: "#f59e0b",
    backgroundColor: "rgba(245, 158, 11, 0.1)",
  },
  qualityTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  qualityTitleActive: {
    color: "#f59e0b",
  },
  qualityDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  telemetryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.55)",
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
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  categoryMins: {
    color: THEME.colors.cardTextSecondary,
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
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 3,
    marginTop: 14,
    marginBottom: 10,
    overflow: "hidden",
  },
  hydrationBarFill: {
    height: 6,
    backgroundColor: "#06b6d4",
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
    borderColor: "rgba(200, 218, 210, 0.55)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  hydrationQuickIcon: {
    fontSize: 13,
  },
  hydrationQuickText: {
    color: "#06b6d4",
    fontSize: 12,
    fontWeight: "700",
  },
  hydrationQuickDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginHorizontal: 4,
  },
  waterMiniBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#16232b",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(6, 182, 212, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  hydrationTabsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
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
    backgroundColor: "rgba(6, 182, 212, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.4)",
  },
  hydrationTabBtnText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  hydrationTabBtnTextActive: {
    color: "#06b6d4",
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
    color: "#64748b",
    fontWeight: "600",
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
    color: "#64748b",
  },
  reservoirGaugeTrack: {
    height: 8,
    backgroundColor: "rgba(180, 205, 195, 0.35)",
    borderRadius: 4,
    overflow: "hidden",
  },
  reservoirGaugeFill: {
    height: 8,
    backgroundColor: "#06b6d4",
    borderRadius: 4,
  },
  hydrationSectionBox: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  hydrationSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  hydrationSectionTitle: {
    color: "#f8fafc",
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
    borderColor: "rgba(200, 218, 210, 0.55)",
  },
  beverageChipIcon: {
    fontSize: 20,
  },
  beverageChipName: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "700",
  },
  beverageChipFactor: {
    color: "#64748b",
    fontSize: 10,
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
    borderColor: "rgba(200, 218, 210, 0.55)",
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
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
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
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  cupMatrixItemFilled: {
    backgroundColor: "rgba(6, 182, 212, 0.15)",
    borderColor: "rgba(6, 182, 212, 0.4)",
  },
  cupMatrixIndex: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
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
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
  },
  hydrationEntryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
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
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
  },
  hydrationEntryTime: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 1,
  },
  hydrationEntryRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hydrationEntryAmount: {
    color: "#06b6d4",
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
  roadmapIntroBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.2)",
    marginBottom: 4,
  },
  roadmapIntroText: {
    flex: 1,
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 16,
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
    color: "#06b6d4",
    fontSize: 12,
    fontWeight: "800",
  },
  roadmapMlBadge: {
    backgroundColor: "rgba(6, 182, 212, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.3)",
  },
  roadmapMlText: {
    color: "#06b6d4",
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
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
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
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    marginBottom: 10,
    alignItems: "center",
  },
  emptyCategoryText: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
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
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  wellbeingTabBtnActive: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderColor: "rgba(168, 85, 247, 0.4)",
  },
  wellbeingTabBtnText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  wellbeingTabBtnTextActive: {
    color: "#f8fafc",
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
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
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
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "700",
  },
  quickFocusSub: {
    color: "#94a3b8",
    fontSize: 11,
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
    backgroundColor: "#0d1612",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 6,
  },
  distractionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  distractionRowActive: {
    opacity: 1,
  },
  distractionName: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  distractionDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#475569",
    alignItems: "center",
    justifyContent: "center",
  },
  historyList: {
    backgroundColor: "#0d1612",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 8,
  },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  historyTitle: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
  },
  historySub: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 2,
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
    borderColor: "rgba(200, 218, 210, 0.55)",
    alignItems: "center",
    gap: 4,
  },
  bedtimeLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  bedtimeVal: {
    color: "#f8fafc",
    fontSize: 14,
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
    color: "#f8fafc",
  },
  breathingPill: {
    color: "#38bdf8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  breathingDismissBtn: {
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  breathingDismissText: {
    color: "#38bdf8",
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
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  reflectionChipActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10b981",
  },
  reflectionChipText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  reflectionChipTextActive: {
    color: "#10b981",
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
    borderColor: "rgba(200, 218, 210, 0.55)",
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
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
    maxWidth: 160,
  },
  realAppTime: {
    color: "#cbd5e1",
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
