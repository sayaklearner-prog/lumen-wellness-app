import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import {
  useGetTodayDashboard,
  useGetProfile,
  useGetTimeline,
  useListWorkouts,
  useGetStreaks,
  getGetTimelineQueryKey,
  getGetTodayDashboardQueryKey,
  getListWorkoutsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Flame,
  Trophy,
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
} from "lucide-react-native";
import Svg, {
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Text as SvgText,
} from "react-native-svg";
import { GlassCard } from "@/components/GlassCard";
import { speakText, stopSpeaking } from "@/services/voice";
import { syncHealthData, getLastSyncStatus, HealthSyncStatus } from "@/services/health";

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
  // Historical data points simulated around the overallScore baseline
  const dataPoints = [4.2, 5.8, 6.5, 4.0, 7.2, 5.0, overallScore];
  const chartHeight = 110;
  const chartWidth = SCREEN_WIDTH - 64;
  const maxVal = 10;
  const stepX = chartWidth / (days.length - 1);

  // Build SVG path
  const points = dataPoints.map((val, idx) => {
    const x = idx * stepX;
    const y = chartHeight - (val / maxVal) * (chartHeight - 20) - 10;
    return { x, y, val };
  });

  const linePath = points.reduce((acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`, "");
  const areaPath = `${linePath} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

  return (
    <View style={styles.trendChartBox}>
      {/* Y-axis markers */}
      <View style={styles.yAxis}>
        <Text style={styles.yAxisText}>10</Text>
        <Text style={styles.yAxisText}>6</Text>
        <Text style={styles.yAxisText}>3</Text>
        <Text style={styles.yAxisText}>0</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <Stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {/* Horizontal grid guide lines */}
          <Line x1="0" y1="10" x2={chartWidth} y2="10" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <Line x1="0" y1="45" x2={chartWidth} y2="45" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <Line x1="0" y1="80" x2={chartWidth} y2="80" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
          <Line x1="0" y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="rgba(255,255,255,0.1)" />

          {/* Area under curve */}
          <Path d={areaPath} fill="url(#trendGrad)" />

          {/* Curve Line */}
          <Path d={linePath} stroke="#10b981" strokeWidth={2.5} fill="none" />

          {/* Data points */}
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

        {/* X-axis days row */}
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
  const [refreshing, setRefreshing] = useState(false);
  const [isSpeakingBriefing, setIsSpeakingBriefing] = useState(false);
  const [waterCups, setWaterCups] = useState(6);

  // Wearable Health sync states
  const [syncStatus, setSyncStatus] = useState<HealthSyncStatus>({
    lastSyncedAt: null,
    status: "idle",
    syncedMetrics: [],
  });

  const { data: profile } = useGetProfile();
  const { data: dashboard, refetch } = useGetTodayDashboard();
  const { data: timelineEvents, refetch: refetchTimeline } = useGetTimeline();
  const { data: workouts, refetch: refetchWorkouts } = useListWorkouts();
  const { data: streaksData, refetch: refetchStreaks } = useGetStreaks();

  // Load last sync status
  useEffect(() => {
    async function loadSync() {
      const status = await getLastSyncStatus();
      setSyncStatus(status);
    }
    loadSync();
  }, []);

  const handleRefresh = async () => {
    try {
      triggerHaptic();
    } catch {}
    setRefreshing(true);
    await Promise.all([refetch(), refetchTimeline(), refetchWorkouts(), refetchStreaks()]);
    setRefreshing(false);
  };

  const handleSyncHealth = async () => {
    try {
      triggerHaptic("success");
    } catch {}
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

  // Metrics computation
  const workoutCaloriesBurned =
    workouts?.reduce((acc: number, w: any) => acc + (Number(w.caloriesBurned) || 0), 0) || 0;
  const stepsCount = dashboard?.steps || 0;
  const stepsCaloriesBurned = Math.round(stepsCount * 0.045);
  const totalActiveCaloriesBurned = workoutCaloriesBurned + stepsCaloriesBurned;

  const stepsTarget = profile?.dailyStepsTarget || 9000;
  const stepsPercent = Math.min(100, Math.round((stepsCount / stepsTarget) * 100));

  const caloriesConsumed = dashboard?.caloriesConsumed || 0;
  const caloriesTarget = profile?.dailyCalorieTarget || 2100;
  const caloriesPercent = Math.min(100, Math.round((caloriesConsumed / caloriesTarget) * 100));

  const proteinGrams = dashboard?.proteinGrams || 0;
  const proteinTarget = profile?.dailyProteinTarget || 140;

  const carbsGrams = dashboard?.carbsGrams || 0;
  const fatGrams = dashboard?.fatGrams || 0;

  const sleepHours = dashboard?.sleepHours || 0;
  const sleepTarget = Number(profile?.dailySleepTargetHours) || 8;
  const sleepPercent = Math.min(100, Math.round((sleepHours / sleepTarget) * 100));

  const overallScore = Number(dashboard?.overallScore ?? 2.3);

  // Time of day greeting
  const greetingTime = useMemo(() => {
    const curHour = new Date().getHours();
    if (curHour < 12) return "Good morning";
    if (curHour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  const userName = profile?.name || "Somdutta Kirtaniya";

  // Score categories from backend
  const nutritionScore =
    dashboard?.scores?.find((s) => s.category === "nutrition")?.score ?? 0.0;
  const nutritionLabel =
    dashboard?.scores?.find((s) => s.category === "nutrition")?.label ?? "Not logged";

  const sleepScore = dashboard?.scores?.find((s) => s.category === "sleep")?.score ?? 0.0;
  const sleepLabel = dashboard?.scores?.find((s) => s.category === "sleep")?.label ?? "Not logged";

  const activityScore =
    dashboard?.scores?.find((s) => s.category === "activity")?.score ?? 0.0;
  const activityLabel =
    dashboard?.scores?.find((s) => s.category === "activity")?.label ?? "Not logged";

  const screenScore = dashboard?.scores?.find((s) => s.category === "screen")?.score ?? 9.0;
  const screenLabel =
    dashboard?.scores?.find((s) => s.category === "screen")?.label ?? "Outstanding";

  // Daily energy message
  const energySubtext =
    overallScore >= 7.5
      ? "Today is looking like an energized, peak-performance day."
      : overallScore >= 5.0
        ? "Today is looking like a balanced, steady momentum day."
        : "Today is looking like a low energy day.";

  // Dynamic AI Insight Card
  const aiInsightTitle =
    dashboard?.topRecommendation?.title || "Bump protein by 110g today";
  const aiInsightDesc =
    dashboard?.topRecommendation?.body ||
    "Yesterday you came in 110g under your protein target. Add a Greek yogurt at lunch to keep muscle synthesis optimal.";

  const streaksList = useMemo(() => {
    return Array.isArray(streaksData) ? (streaksData as any[]) : [];
  }, [streaksData]);

  // Briefing speech
  const briefingText =
    stepsCount > 5000
      ? `Movement is steady today with ${stepsCount.toLocaleString()} steps. Keep hydration continuous to finish strong.`
      : `Welcome, ${userName}. Active calorie burn is currently ${totalActiveCaloriesBurned} kcal. Let's hit a brisk walk before dinner.`;

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
    setWaterCups((prev) => prev + 1);
  };

  const decrementWater = () => {
    triggerHaptic();
    setWaterCups((prev) => Math.max(0, prev - 1));
  };

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brandTitle}>Lumen</Text>
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

          {/* Profile Avatar */}
          <Pressable onPress={() => router.push("/(tabs)/profile")}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {userName ? userName[0].toUpperCase() : "S"}
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
            <CircularScoreRing score={overallScore} />
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
        {/* 4 CORE PILLAR SCORE CARDS (2x2 Grid on Mobile)           */}
        {/* ========================================================= */}
        <View style={styles.pillarGrid}>
          {/* Nutrition */}
          <View style={styles.pillarCard}>
            <View style={styles.pillarTopRow}>
              <Text style={styles.pillarTitle}>Nutrition</Text>
              <Text style={[styles.pillarScore, { color: "#10b981" }]}>
                {nutritionScore.toFixed(1)}
              </Text>
            </View>
            <View style={styles.pillarBarTrack}>
              <View
                style={[
                  styles.pillarBarFill,
                  { width: `${Math.min(100, nutritionScore * 10)}%`, backgroundColor: "#10b981" },
                ]}
              />
            </View>
            <Text style={styles.pillarSubtitle}>{nutritionLabel}</Text>
          </View>

          {/* Sleep */}
          <View style={styles.pillarCard}>
            <View style={styles.pillarTopRow}>
              <Text style={styles.pillarTitle}>Sleep</Text>
              <Text style={[styles.pillarScore, { color: "#f59e0b" }]}>
                {sleepScore.toFixed(1)}
              </Text>
            </View>
            <View style={styles.pillarBarTrack}>
              <View
                style={[
                  styles.pillarBarFill,
                  { width: `${Math.min(100, sleepScore * 10)}%`, backgroundColor: "#f59e0b" },
                ]}
              />
            </View>
            <Text style={styles.pillarSubtitle}>{sleepLabel}</Text>
          </View>

          {/* Activity */}
          <View style={styles.pillarCard}>
            <View style={styles.pillarTopRow}>
              <Text style={styles.pillarTitle}>Activity</Text>
              <Text style={[styles.pillarScore, { color: "#06b6d4" }]}>
                {activityScore.toFixed(1)}
              </Text>
            </View>
            <View style={styles.pillarBarTrack}>
              <View
                style={[
                  styles.pillarBarFill,
                  { width: `${Math.min(100, activityScore * 10)}%`, backgroundColor: "#06b6d4" },
                ]}
              />
            </View>
            <Text style={styles.pillarSubtitle}>{activityLabel}</Text>
          </View>

          {/* Screen */}
          <View style={styles.pillarCard}>
            <View style={styles.pillarTopRow}>
              <Text style={styles.pillarTitle}>Screen</Text>
              <Text style={[styles.pillarScore, { color: "#a855f7" }]}>
                {screenScore.toFixed(1)}
              </Text>
            </View>
            <View style={styles.pillarBarTrack}>
              <View
                style={[
                  styles.pillarBarFill,
                  { width: `${Math.min(100, screenScore * 10)}%`, backgroundColor: "#a855f7" },
                ]}
              />
            </View>
            <Text style={styles.pillarSubtitle}>{screenLabel}</Text>
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
                {streaksList.find((s) => s.category === "nutrition")?.days ?? 0}
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
                {streaksList.find((s) => s.category === "sleep")?.days ?? 0}
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
                {streaksList.find((s) => s.category === "activity")?.days ?? 0}
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
              <Text style={styles.trendScoreTagVal}>{overallScore.toFixed(1)} / 10</Text>
            </View>
          </View>

          <Trend7DayChart overallScore={overallScore} />
        </View>

        {/* ========================================================= */}
        {/* HYDRATION & MACRONUTRIENTS ROW                            */}
        {/* ========================================================= */}
        <View style={styles.biometricsSplitRow}>
          {/* Hydration Card */}
          <View style={styles.hydrationCard}>
            <View style={styles.hydrationTopRow}>
              <View style={styles.dropCircle}>
                <Droplet size={16} color="#06b6d4" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.bioCardLabel}>Hydration</Text>
                <Text style={styles.bioCardValue}>{waterCups} cups</Text>
              </View>
              <ChevronRight size={16} color="#64748b" />
            </View>

            {/* Quick Increment/Decrement Buttons */}
            <View style={styles.waterControlsRow}>
              <Pressable style={styles.waterBtn} onPress={decrementWater}>
                <Minus size={14} color="#94a3b8" />
              </Pressable>
              <Text style={styles.waterTargetText}>Target: 8 cups</Text>
              <Pressable style={styles.waterBtn} onPress={incrementWater}>
                <Plus size={14} color="#06b6d4" />
              </Pressable>
            </View>
          </View>

          {/* Calories & Macros Card */}
          <View style={styles.caloriesMacroCard}>
            <View style={styles.calTopRow}>
              <Text style={styles.bioCardLabel}>Calories</Text>
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
    gap: 8,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(249, 115, 22, 0.4)",
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
    fontSize: 14,
    fontWeight: "800",
  },
  streakCardMsg: {
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },

  // 7-DAY TREND CARD
  trendContainerCard: {
    backgroundColor: "#0d1612",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 16,
  },
  trendHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
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
    alignItems: "flex-start",
    marginTop: 4,
  },
  yAxis: {
    width: 20,
    height: 100,
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  yAxisText: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "600",
  },
  xAxisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  xAxisText: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
  },

  // BIOMETRICS ROW: Hydration & Calories
  biometricsSplitRow: {
    gap: 12,
    marginBottom: 16,
  },
  hydrationCard: {
    backgroundColor: "#0d1612",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.2)",
  },
  hydrationTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dropCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(6, 182, 212, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  bioCardLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  bioCardValue: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  waterControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  waterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  waterTargetText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },
  caloriesMacroCard: {
    backgroundColor: "#0d1612",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
  },
  calTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  calValue: {
    color: "#f8fafc",
    fontSize: 13,
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
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  macroItem: {
    alignItems: "center",
  },
  macroLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
  },
  macroVal: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },

  // ACTIVE BURN BANNER
  activeBurnBanner: {
    backgroundColor: "#0c1813",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    borderRadius: 18,
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  burnBannerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  burnBannerTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  burnBannerTotal: {
    color: "#10b981",
    fontSize: 18,
    fontWeight: "900",
  },
  burnBannerSubRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    paddingTop: 8,
  },
  burnBannerSubText: {
    color: "#94a3b8",
    fontSize: 11,
  },

  // BRIEFING CARD
  briefingCard: {
    marginBottom: 16,
  },
  briefingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  briefingTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "800",
  },
  voiceBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  briefingBody: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
  },
});
