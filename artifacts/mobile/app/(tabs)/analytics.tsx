import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Share,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import {
  Sparkles,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Moon,
  Droplets,
  Utensils,
  Footprints,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Bell,
  RefreshCw,
  Info,
  CheckCircle2,
  Zap,
  Smartphone,
  TrendingUp,
  FileText,
  Share2,
  HeartPulse,
  Activity,
  Layers,
  Compass,
} from "lucide-react-native";
import { useGetProfile } from "@workspace/api-client-react";
import THEME from "@/constants/theme";
import {
  MonthlyHealthSummary,
  ThreePillarAiInsights,
  formatDateKey,
  getMonthName,
  getMonthlyHealthSummary,
  generateThreePillarAiInsights,
  checkDailyHealthScoreNotification,
  computeAndSaveDailySnapshot,
  purgeSimulatedHealthMetrics,
} from "@/services/dailyHealthMetrics";
import { DailyHealthRecord, getDailyHealthRecord } from "@/services/db";
import { storage } from "@/services/storage";
import { synthesizeThreePillarBiometricsWithGemini } from "@/services/geminiAi";
import { registerBackHandler } from "@/services/backNavigation";
import {
  AnalyticsHorizon,
  TimeInRangeMetrics,
  BloodPressureTelemetry,
  calculateTimeInRange,
  calculateBloodPressureMetrics,
  computeSevenDayTrend,
  computeNinetyDayProjection,
  compilePhysicianSoapBrief,
} from "@/services/clinicalAnalyticsEngine";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const HORIZON_TABS: { id: AnalyticsHorizon; label: string; icon: string }[] = [
  { id: "daily", label: "Day Inspector", icon: "☀️" },
  { id: "7day", label: "7-Day Trend", icon: "📈" },
  { id: "30day", label: "30-Day Calendar", icon: "🗓️" },
  { id: "90day", label: "90-Day Projection", icon: "🔬" },
];

export default function AnalyticsScreen() {
  const router = useRouter();
  const today = new Date();
  const todayKey = formatDateKey(today);
  const { data: profile } = useGetProfile();

  // Multi-Horizon View State: "daily" | "7day" | "30day" | "90day"
  const [selectedHorizon, setSelectedHorizon] = useState<AnalyticsHorizon>("daily");

  // Back press handler: return to Home tab (Capacitor Android & native)
  useFocusEffect(
    useCallback(() => {
      return registerBackHandler("screen-analytics", 40, () => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)");
        }
        return true;
      });
    }, [router])
  );

  // Month navigation state
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayKey);

  // Data states
  const [monthlySummary, setMonthlySummary] = useState<MonthlyHealthSummary | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<DailyHealthRecord | null>(null);
  const [prevDayRecord, setPrevDayRecord] = useState<DailyHealthRecord | null>(null);
  const [aiInsights, setAiInsights] = useState<ThreePillarAiInsights | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null);
  const [exportToast, setExportToast] = useState<string | null>(null);

  // Vitals logs from Control Center
  const [glucoseLogs, setGlucoseLogs] = useState<{ value: number; timestamp?: string }[]>([]);
  const [bpLogs, setBpLogs] = useState<{ systolic: number; diastolic: number }[]>([]);

  // Google Gemini AI Synthesis states
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);

  const triggerAiSynthesis = useCallback(
    async (dayRec: DailyHealthRecord, summary: MonthlyHealthSummary, forceRefresh = false) => {
      const cacheKey = `lumen_3pillar_ai_${dayRec.date}`;
      if (!forceRefresh) {
        try {
          const cached = await storage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed?.movement && parsed?.recovery && parsed?.nutrition) {
              setAiInsights(parsed);
              return;
            }
          }
        } catch {}
      }

      setIsGeneratingAi(true);
      try {
        const geminiResult = await synthesizeThreePillarBiometricsWithGemini(dayRec, summary);
        if (geminiResult) {
          setAiInsights(geminiResult);
        }
      } catch (err) {
        console.warn("[Analytics] Gemini synthesis failed, maintaining baseline:", err);
      } finally {
        setIsGeneratingAi(false);
      }
    },
    []
  );

  // Load telemetry data for selected month and selected day (Strictly Clean & Authentic)
  const loadData = useCallback(
    async (targetYear: number, targetMonth: number, targetDate: string) => {
      try {
        await purgeSimulatedHealthMetrics();

        // 1. Fetch monthly summary
        const summary = await getMonthlyHealthSummary(targetYear, targetMonth);
        setMonthlySummary(summary);

        // 2. Fetch or dynamically compile selected day record
        let dayRec = summary.recordsByDate[targetDate];
        if (!dayRec || dayRec.overallScore === 0) {
          dayRec = await computeAndSaveDailySnapshot(targetDate);
          summary.recordsByDate[targetDate] = dayRec;
        }
        setSelectedRecord(dayRec);

        // 3. Fetch or dynamically compile previous day record to compute Day-over-Day delta
        const [year, month, day] = targetDate.split("-").map(Number);
        const prevDateObj = new Date(year, month - 1, day - 1);
        const prevKey = formatDateKey(prevDateObj);
        let prevRec = summary.recordsByDate[prevKey];
        if (!prevRec || prevRec.overallScore === 0) {
          prevRec = await computeAndSaveDailySnapshot(prevKey);
          summary.recordsByDate[prevKey] = prevRec;
        }
        setPrevDayRecord(prevRec || null);
        setMonthlySummary({ ...summary });

        // 4. Generate baseline 3-Pillar AI Insights immediately for 0ms latency
        const insights = generateThreePillarAiInsights(dayRec, summary);
        setAiInsights(insights);

        // 5. Load vitals logs from storage (logged via Control Center HUD)
        try {
          const gStr = await storage.getItem("lumen_blood_glucose_log");
          if (gStr) {
            const parsed = JSON.parse(gStr);
            if (Array.isArray(parsed)) setGlucoseLogs(parsed);
          }
          const bpStr = await storage.getItem("lumen_blood_pressure_log");
          if (bpStr) {
            const parsed = JSON.parse(bpStr);
            if (Array.isArray(parsed)) setBpLogs(parsed);
          }
        } catch {}

        // 6. Asynchronously trigger Google Gemini AI clinical synthesis
        triggerAiSynthesis(dayRec, summary);
      } catch (err) {
        console.warn("[Analytics] Error loading monthly health telemetry:", err);
      } finally {
        setRefreshing(false);
      }
    },
    [triggerAiSynthesis]
  );

  useEffect(() => {
    loadData(selectedYear, selectedMonth, selectedDateStr);
  }, [selectedYear, selectedMonth, selectedDateStr, loadData]);

  // Clinical Physiology Computations
  const allMonthRecords = useMemo(() => {
    return monthlySummary ? Object.values(monthlySummary.recordsByDate) : [];
  }, [monthlySummary]);

  const tirMetrics = useMemo(() => calculateTimeInRange(glucoseLogs), [glucoseLogs]);
  const bpMetrics = useMemo(() => calculateBloodPressureMetrics(bpLogs), [bpLogs]);
  const sevenDaySummary = useMemo(() => computeSevenDayTrend(allMonthRecords), [allMonthRecords]);
  const ninetyDayProjection = useMemo(
    () => computeNinetyDayProjection(allMonthRecords, tirMetrics),
    [allMonthRecords, tirMetrics]
  );

  // 1-Tap Export Physician Consultation Brief (SOAP format)
  const handleExportPhysicianBrief = async () => {
    try {
      const brief = compilePhysicianSoapBrief({
        patientName: profile?.name || "Lumen Member",
        monthName: getMonthName(selectedMonth),
        year: selectedYear,
        daysLogged: monthlySummary?.daysLoggedCount || 0,
        avgScore: monthlySummary?.averageScore || 0,
        sevenDay: sevenDaySummary,
        tir: tirMetrics,
        bp: bpMetrics,
        ninetyDay: ninetyDayProjection,
      });

      await Share.share({
        title: `Lumen Health OS - Physician Brief (${getMonthName(selectedMonth)} ${selectedYear})`,
        message: brief,
      });
      setExportToast("Physician Consultation Brief Generated & Shared!");
      setTimeout(() => setExportToast(null), 4000);
    } catch (err) {
      console.warn("Share failed:", err);
    }
  };

  // Navigate to previous month
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((prev) => prev - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  // Navigate to next month
  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((prev) => prev + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  // Jump directly to Today
  const handleJumpToToday = () => {
    const curYear = today.getFullYear();
    const curMonth = today.getMonth() + 1;
    setSelectedYear(curYear);
    setSelectedMonth(curMonth);
    setSelectedDateStr(todayKey);
  };

  // Select a specific day on the calendar grid
  const handleSelectDay = async (dayNum: number) => {
    const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    setSelectedDateStr(dateKey);
    try {
      const snap = await computeAndSaveDailySnapshot(dateKey);
      setSelectedRecord(snap);
      if (monthlySummary) {
        monthlySummary.recordsByDate[dateKey] = snap;
        setMonthlySummary({ ...monthlySummary });
      }
    } catch (e) {
      console.warn("[Analytics] Error snapshotting on day select:", e);
    }
  };

  // Manual trigger for testing the 8:00 AM Morning Briefing notification
  const handleTestNotification = async () => {
    try {
      setAlertFeedback("Evaluating Morning Briefing health delta...");
      await checkDailyHealthScoreNotification();
      setAlertFeedback("✅ Briefing evaluation complete. Notification dispatched!");
      setTimeout(() => setAlertFeedback(null), 5000);
    } catch {
      setAlertFeedback("Briefing check complete.");
      setTimeout(() => setAlertFeedback(null), 3000);
    }
  };

  // Manual snapshot refresh for today
  const handleRefreshToday = async () => {
    setRefreshing(true);
    await computeAndSaveDailySnapshot(todayKey);
    await loadData(selectedYear, selectedMonth, selectedDateStr);
  };

  // Calendar Grid Calculations
  const firstDayOfMonth = new Date(selectedYear, selectedMonth - 1, 1).getDay();
  const leadingOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

  // Day-over-Day score calculation
  const currentDayScore = selectedRecord?.overallScore ?? 0;
  const prevDayScore = prevDayRecord?.overallScore ?? 0;
  const dayDelta =
    prevDayScore > 0 && currentDayScore > 0 ? Math.round((currentDayScore - prevDayScore) * 10) / 10 : 0;

  // Day-over-Day granular pillar deltas
  const currentSteps = selectedRecord?.steps ?? 0;
  const prevSteps = prevDayRecord?.steps ?? 0;
  const stepsDelta = prevSteps > 0 && currentSteps > 0 ? currentSteps - prevSteps : 0;

  const currentCals = selectedRecord?.activeCalories ?? 0;
  const prevCals = prevDayRecord?.activeCalories ?? 0;
  const calsDelta = prevCals > 0 && currentCals > 0 ? Math.round((currentCals - prevCals) * 10) / 10 : 0;

  const currentFatBurned =
    selectedRecord?.fatBurnedGrams !== undefined && selectedRecord?.fatBurnedGrams !== null
      ? selectedRecord.fatBurnedGrams
      : (currentCals > 0 ? Math.round(((currentCals * 0.75) / 7.7) * 10) / 10 : 0);
  const prevFatBurned =
    prevDayRecord?.fatBurnedGrams !== undefined && prevDayRecord?.fatBurnedGrams !== null
      ? prevDayRecord.fatBurnedGrams
      : (prevCals > 0 ? Math.round(((prevCals * 0.75) / 7.7) * 10) / 10 : 0);
  const fatDelta = prevFatBurned > 0 && currentFatBurned > 0 ? Math.round((currentFatBurned - prevFatBurned) * 10) / 10 : 0;

  const currentHydrationMl = selectedRecord?.hydrationMl ?? 0;
  const prevHydrationMl = prevDayRecord?.hydrationMl ?? 0;
  const hydrationDelta = prevHydrationMl > 0 && currentHydrationMl > 0 ? currentHydrationMl - prevHydrationMl : 0;

  // Format header date string for Day Inspector
  const [selY, selM, selD] = selectedDateStr.split("-").map(Number);
  const selDateObj = new Date(selY, selM - 1, selD);
  const formattedDayTitle = selDateObj.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const isSelectedDateToday = selectedDateStr === todayKey;
  const monthHasLogs = (monthlySummary?.daysLoggedCount ?? 0) > 0;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
            <Text style={styles.headerSub} numberOfLines={1}>
              HEALTH OS PLATFORM
            </Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Clinical Biometrics
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 6 }}>
            {/* 1-Tap Physician Brief Export Pill */}
            <Pressable
              style={styles.physicianExportBtn}
              onPress={handleExportPhysicianBrief}
              accessibilityLabel="Export Physician Consultation Brief"
            >
              <FileText size={12} color="#10b981" />
              <Text style={styles.physicianExportBtnText}>DOCTOR BRIEF</Text>
            </Pressable>

            <View style={[styles.aiBadge, { flexShrink: 0 }]}>
              <Sparkles size={11} color="#10b981" />
              <Text style={styles.aiBadgeText} numberOfLines={1}>
                AI Insights
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Export Toast Banner */}
      {exportToast && (
        <View style={styles.exportToastBanner}>
          <CheckCircle2 size={14} color="#050b08" />
          <Text style={styles.exportToastText} numberOfLines={1}>{exportToast}</Text>
        </View>
      )}

      {/* ========================================================= */}
      {/* MULTI-HORIZON SELECTOR (Daily, 7-Day, 30-Day, 90-Day)    */}
      {/* ========================================================= */}
      <View style={styles.horizonBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizonBar}>
          {HORIZON_TABS.map((tab) => (
            <Pressable
              key={tab.id}
              style={[
                styles.horizonPill,
                selectedHorizon === tab.id && styles.horizonPillActive,
              ]}
              onPress={() => setSelectedHorizon(tab.id)}
            >
              <Text style={styles.horizonIcon}>{tab.icon}</Text>
              <Text
                style={[
                  styles.horizonText,
                  selectedHorizon === tab.id && styles.horizonTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        removeClippedSubviews={Platform.OS === "android"}
        overScrollMode="never"
      >
        {/* ========================================================= */}
        {/* CLINICAL TIME-IN-RANGE (TIR) & VITALS HUD STRIP           */}
        {/* ========================================================= */}
        <View style={styles.tirTelemetryCard}>
          <View style={styles.tirHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flex: 1 }}>
              <HeartPulse size={16} color="#38bdf8" />
              <Text style={styles.tirCardTitle}>Clinical Time-In-Range (ADA Std)</Text>
            </View>
            <View style={styles.tirStatusBadge}>
              <Text style={styles.tirStatusBadgeText}>
                {tirMetrics.inRangePercent > 0 ? `${tirMetrics.inRangePercent}% TIR` : "Telemetric Baseline"}
              </Text>
            </View>
          </View>

          <View style={styles.tirMetricsGrid}>
            <View style={styles.tirMetricItem}>
              <Text style={styles.tirMetricLabel}>Target (70-180)</Text>
              <Text style={[styles.tirMetricVal, { color: "#10b981" }]}>
                {tirMetrics.inRangePercent > 0 ? `${tirMetrics.inRangePercent}%` : "≥70% req"}
              </Text>
            </View>

            <View style={styles.tirMetricDivider} />

            <View style={styles.tirMetricItem}>
              <Text style={styles.tirMetricLabel}>Hypo Risk (&lt;70)</Text>
              <Text style={[styles.tirMetricVal, { color: tirMetrics.hypoPercent > 4 ? "#ef4444" : "#94a3b8" }]}>
                {tirMetrics.totalReadings > 0 ? `${tirMetrics.hypoPercent}%` : "0%"}
              </Text>
            </View>

            <View style={styles.tirMetricDivider} />

            <View style={styles.tirMetricItem}>
              <Text style={styles.tirMetricLabel}>Mean Glucose</Text>
              <Text style={styles.tirMetricVal}>
                {tirMetrics.meanGlucoseMgDl > 0 ? `${tirMetrics.meanGlucoseMgDl} mg/dL` : "105 mg/dL"}
              </Text>
            </View>

            <View style={styles.tirMetricDivider} />

            <View style={styles.tirMetricItem}>
              <Text style={styles.tirMetricLabel}>Blood Pressure</Text>
              <Text style={[styles.tirMetricVal, { color: "#38bdf8" }]}>
                {bpMetrics.latestSystolic ? `${bpMetrics.latestSystolic}/${bpMetrics.latestDiastolic}` : "120/80"}
              </Text>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* HORIZON VIEW 1: 7-DAY ROLLING TREND                       */}
        {/* ========================================================= */}
        {selectedHorizon === "7day" && (
          <View style={{ gap: 16 }}>
            <View style={styles.horizonHeroCard}>
              <View style={styles.horizonHeroHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.horizonHeroLabel}>7-DAY AUTONOMIC RECOVERY PACING</Text>
                  <Text style={styles.horizonHeroStatus}>{sevenDaySummary.recoveryPacingStatus}</Text>
                  <Text style={styles.horizonHeroSub}>
                    Evaluates continuous biometrics against systemic fatigue debt.
                  </Text>
                </View>
                <View style={styles.fatigueGaugeBox}>
                  <Text style={styles.fatigueGaugeLabel}>FATIGUE</Text>
                  <Text style={styles.fatigueGaugeVal}>{sevenDaySummary.fatigueIndex}/10</Text>
                </View>
              </View>

              <View style={styles.sevenDayStatsRow}>
                <View style={styles.sevenDayStatTile}>
                  <Text style={styles.sevenDayStatLabel}>7d Mean Steps</Text>
                  <Text style={styles.sevenDayStatVal}>{sevenDaySummary.avgSteps.toLocaleString()}</Text>
                </View>
                <View style={styles.sevenDayStatTile}>
                  <Text style={styles.sevenDayStatLabel}>Active Burn</Text>
                  <Text style={[styles.sevenDayStatVal, { color: "#ea580c" }]}>{sevenDaySummary.avgActiveCals} kcal</Text>
                </View>
                <View style={styles.sevenDayStatTile}>
                  <Text style={styles.sevenDayStatLabel}>Mean Sleep</Text>
                  <Text style={[styles.sevenDayStatVal, { color: "#4338ca" }]}>{sevenDaySummary.avgSleepHours}h</Text>
                </View>
                <View style={styles.sevenDayStatTile}>
                  <Text style={styles.sevenDayStatLabel}>Hydration</Text>
                  <Text style={[styles.sevenDayStatVal, { color: "#0284c7" }]}>{sevenDaySummary.avgHydrationMl} ml</Text>
                </View>
              </View>
            </View>

            <View style={styles.infoBox}>
              <Sparkles size={16} color="#38bdf8" />
              <Text style={styles.infoBoxText}>
                <Text style={{ fontWeight: "bold", color: "#f8fafc" }}>Physiological Pacing: </Text>
                When 7-day average sleep exceeds 7.5 hours and daily steps remain within 8,000–12,000, cellular mitochondrial adaptation is in prime equilibrium.
              </Text>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* HORIZON VIEW 2: 30-DAY MONTHLY CALENDAR GRID              */}
        {/* ========================================================= */}
        {selectedHorizon === "30day" && (
          <View style={{ gap: 16 }}>
            {/* Month Navigation */}
            <View style={styles.monthNavRow}>
              <Pressable style={styles.monthNavArrow} onPress={handlePrevMonth} accessibilityLabel="Previous Month">
                <ChevronLeft size={18} color={THEME.colors.textOnDarkPrimary} />
              </Pressable>

              <View style={styles.monthNameWrapper}>
                <CalendarIcon size={14} color={THEME.colors.accentGreen} />
                <Text style={styles.monthNavTitle} numberOfLines={1}>
                  {getMonthName(selectedMonth)} {selectedYear}
                </Text>
              </View>

              <Pressable style={styles.monthNavArrow} onPress={handleNextMonth} accessibilityLabel="Next Month">
                <ChevronRight size={18} color={THEME.colors.textOnDarkPrimary} />
              </Pressable>

              {!isSelectedDateToday && (
                <Pressable style={styles.todayPill} onPress={handleJumpToToday}>
                  <Text style={styles.todayPillText}>Today</Text>
                </Pressable>
              )}
            </View>

            {/* Monthly Summary Hero Card */}
            <View style={styles.monthlyHeroCard}>
              <View style={styles.monthlyHeroHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.monthlyHeroLabel} numberOfLines={1}>
                    {getMonthName(selectedMonth).toUpperCase()} COMPOSITE SCORE
                  </Text>
                  <View style={styles.scoreRow}>
                    <Text style={styles.monthlyScoreLarge}>
                      {monthHasLogs && monthlySummary?.averageScore ? monthlySummary.averageScore.toFixed(1) : "0.0"}
                    </Text>
                    <Text style={styles.monthlyScoreMax}>/ 10</Text>
                  </View>
                </View>

                {monthHasLogs && monthlySummary && monthlySummary.prevMonthAverageScore > 0 ? (
                  <View
                    style={[
                      styles.deltaBadge,
                      monthlySummary.monthOverMonthDeltaPercent >= 0
                        ? styles.deltaBadgePositive
                        : styles.deltaBadgeNegative,
                    ]}
                  >
                    {monthlySummary.monthOverMonthDeltaPercent >= 0 ? (
                      <ArrowUpRight size={12} color="#047857" />
                    ) : (
                      <ArrowDownRight size={12} color="#dc2626" />
                    )}
                    <Text
                      style={[
                        styles.deltaBadgeText,
                        monthlySummary.monthOverMonthDeltaPercent >= 0
                          ? styles.deltaTextPositive
                          : styles.deltaTextNegative,
                      ]}
                      numberOfLines={1}
                    >
                      {monthlySummary.monthOverMonthDeltaPercent >= 0 ? "+" : ""}
                      {monthlySummary.monthOverMonthDeltaPercent.toFixed(1)}% MoM
                    </Text>
                  </View>
                ) : (
                  <View style={styles.deltaBadgeNeutral}>
                    <ShieldCheck size={12} color={THEME.colors.cardTextSecondary} />
                    <Text style={styles.deltaTextNeutral} numberOfLines={1}>
                      {monthHasLogs ? "Initial Baseline" : "Clean Baseline"}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.monthlyHeroSubtext} numberOfLines={2}>
                {monthHasLogs
                  ? `Aggregated across ${monthlySummary?.daysLoggedCount || 0} active telemetry day${(monthlySummary?.daysLoggedCount || 0) > 1 ? "s" : ""} in ${getMonthName(selectedMonth)}.`
                  : `No active telemetry recorded for ${getMonthName(selectedMonth)} yet. Log your health habits to see your score.`}
              </Text>

              {/* Monthly Aggregates 4-Column Bar */}
              <View style={styles.monthlyMetricsGrid}>
                <View style={styles.metricItem}>
                  <Footprints size={14} color="#047857" />
                  <Text style={styles.metricValue} numberOfLines={1}>
                    {monthlySummary && monthlySummary.totalSteps > 0
                      ? (monthlySummary.totalSteps / 1000).toFixed(1) + "k"
                      : "0"}
                  </Text>
                  <Text style={styles.metricLabel} numberOfLines={1}>Steps</Text>
                </View>

                <View style={styles.metricDivider} />

                <View style={styles.metricItem}>
                  <Flame size={14} color="#b45309" />
                  <Text style={styles.metricValue} numberOfLines={1}>
                    {monthlySummary && monthlySummary.totalActiveCalories > 0
                      ? Math.round(monthlySummary.totalActiveCalories).toLocaleString()
                      : "0"}
                  </Text>
                  <Text style={styles.metricLabel} numberOfLines={1}>Burn</Text>
                </View>

                <View style={styles.metricDivider} />

                <View style={styles.metricItem}>
                  <Moon size={14} color="#4338ca" />
                  <Text style={styles.metricValue} numberOfLines={1}>
                    {monthlySummary && monthlySummary.averageSleepHours > 0
                      ? `${monthlySummary.averageSleepHours}h`
                      : "0h"}
                  </Text>
                  <Text style={styles.metricLabel} numberOfLines={1}>Sleep</Text>
                </View>

                <View style={styles.metricDivider} />

                <View style={styles.metricItem}>
                  <CheckCircle2 size={14} color="#047857" />
                  <Text style={styles.metricValue} numberOfLines={1}>
                    {monthlySummary?.daysLoggedCount ?? 0}/{monthlySummary?.daysInMonth ?? daysInMonth}
                  </Text>
                  <Text style={styles.metricLabel} numberOfLines={1}>Logged</Text>
                </View>
              </View>
            </View>

            {/* Interactive Monthly Calendar Grid */}
            <View style={styles.calendarCard}>
              <View style={styles.calendarHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, marginRight: 8 }}>
                  <CalendarIcon size={15} color="#047857" />
                  <Text style={styles.cardTitle} numberOfLines={1}>Daily Calendar</Text>
                </View>
                <Text style={styles.calendarTapHint} numberOfLines={1}>Tap day to inspect</Text>
              </View>

              <View style={styles.weekdayRow}>
                {WEEKDAYS.map((wd, i) => (
                  <Text key={i} style={styles.weekdayLabel} numberOfLines={1}>{wd}</Text>
                ))}
              </View>

              <View style={styles.daysGrid}>
                {Array.from({ length: leadingOffset }).map((_, idx) => (
                  <View key={`empty-${idx}`} style={styles.emptyDayTile} />
                ))}

                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                  const dayRecord = monthlySummary?.recordsByDate[dateStr];
                  const score = dayRecord?.overallScore ?? 0;
                  const isSelected = dateStr === selectedDateStr;
                  const isToday = dateStr === todayKey;

                  let scoreColor = "#6b7280";
                  let scoreBg = "rgba(107, 114, 128, 0.1)";
                  if (score >= 8.0) {
                    scoreColor = "#047857";
                    scoreBg = "rgba(16, 185, 129, 0.18)";
                  } else if (score >= 6.0) {
                    scoreColor = "#b45309";
                    scoreBg = "rgba(245, 158, 11, 0.18)";
                  } else if (score > 0) {
                    scoreColor = "#dc2626";
                    scoreBg = "rgba(239, 68, 68, 0.18)";
                  }

                  return (
                    <Pressable
                      key={`day-${dayNum}`}
                      style={[
                        styles.dayTile,
                        isSelected && styles.dayTileSelected,
                        isToday && !isSelected && styles.dayTileToday,
                      ]}
                      onPress={() => {
                        handleSelectDay(dayNum);
                        setSelectedHorizon("daily"); // smoothly route to Day Inspector
                      }}
                    >
                      <Text
                        style={[
                          styles.dayNumberText,
                          isSelected && styles.dayNumberSelected,
                          isToday && styles.dayNumberToday,
                        ]}
                      >
                        {dayNum}
                      </Text>

                      {score > 0 ? (
                        <View style={[styles.dayScorePill, { backgroundColor: scoreBg }]}>
                          <Text style={[styles.dayScoreText, { color: scoreColor }]}>
                            {score.toFixed(1)}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.dayScoreDotEmpty} />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.calendarLegendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#047857" }]} />
                  <Text style={styles.legendLabel}>Optimal (≥8.0)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#b45309" }]} />
                  <Text style={styles.legendLabel}>Balanced (6.0 - 7.9)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#dc2626" }]} />
                  <Text style={styles.legendLabel}>{"Rest (<6.0)"}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* HORIZON VIEW 3: 90-DAY METABOLIC & CARDIO PROJECTION      */}
        {/* ========================================================= */}
        {selectedHorizon === "90day" && (
          <View style={{ gap: 16 }}>
            <View style={styles.horizonHeroCard}>
              <View style={styles.horizonHeroHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.horizonHeroLabel}>90-DAY CLINICAL RISK STRATIFICATION</Text>
                  <Text style={styles.horizonHeroStatus}>Metabolic Stability: {ninetyDayProjection.metabolicStabilityScore}/100</Text>
                  <Text style={styles.horizonHeroSub}>
                    Longitudinal forecast reflecting red blood cell turnover and cardiovascular conditioning.
                  </Text>
                </View>
              </View>

              <View style={styles.sevenDayStatsRow}>
                <View style={styles.sevenDayStatTile}>
                  <Text style={styles.sevenDayStatLabel}>Projected HbA1c</Text>
                  <Text style={[styles.sevenDayStatVal, { color: ninetyDayProjection.projectedHbA1c > 5.7 ? "#f59e0b" : "#10b981" }]}>
                    {ninetyDayProjection.projectedHbA1c}%
                  </Text>
                </View>
                <View style={styles.sevenDayStatTile}>
                  <Text style={styles.sevenDayStatLabel}>Estimated VO2 Max</Text>
                  <Text style={[styles.sevenDayStatVal, { color: "#38bdf8" }]}>
                    {ninetyDayProjection.projectedVo2Max}
                  </Text>
                  <Text style={{ fontSize: 9, color: "#94a3b8", fontWeight: "700" }}>mL/kg/min</Text>
                </View>
                <View style={styles.sevenDayStatTile}>
                  <Text style={styles.sevenDayStatLabel}>Fitness Tier</Text>
                  <Text style={[styles.sevenDayStatVal, { color: "#10b981" }]}>
                    {ninetyDayProjection.cardioFitnessTier}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Physiological Trajectory Advisory</Text>
              <Text style={styles.cardSub}>Longitudinal clinical reasoning from biometric baseline</Text>
              <Text style={{ color: "#e2e8f0", fontSize: 13, lineHeight: 19, marginTop: 4 }}>
                {ninetyDayProjection.longitudinalGuidance}
              </Text>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* HORIZON VIEW 4: DAY INSPECTOR & 5 BIOMETRIC PILLARS      */}
        {/* ========================================================= */}
        {selectedHorizon === "daily" && (
          <View style={{ gap: 16 }}>
            {/* Selected Day Inspector Header */}
            <View style={styles.dayInspectorCard}>
              <View style={styles.dayInspectorHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={styles.inspectorDateTitle} numberOfLines={1}>
                      {formattedDayTitle}
                    </Text>
                    {isSelectedDateToday && (
                      <View style={styles.inspectorTodayBadge}>
                        <Text style={styles.inspectorTodayBadgeText}>TODAY</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.inspectorSubtitle} numberOfLines={1}>
                    Individual Daily Biometrics & Telemetry
                  </Text>
                </View>

                {isSelectedDateToday && (
                  <Pressable
                    style={styles.refreshIconBtn}
                    onPress={handleRefreshToday}
                    disabled={refreshing}
                    accessibilityLabel="Refresh Today's Snapshot"
                  >
                    {refreshing ? (
                      <ActivityIndicator size="small" color="#047857" />
                    ) : (
                      <RefreshCw size={14} color="#047857" />
                    )}
                  </Pressable>
                )}
              </View>

              {/* Score Banner */}
              <View style={styles.dayScoreBanner}>
                <View style={styles.dayScoreLeft}>
                  <Text style={styles.dayScoreVal}>
                    {selectedRecord?.overallScore && selectedRecord.overallScore > 0
                      ? selectedRecord.overallScore.toFixed(1)
                      : "0.0"}
                  </Text>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={styles.dayScoreUnit}>/ 10 Overall Score</Text>
                    <Text style={styles.dayScoreTier} numberOfLines={1}>
                      {currentDayScore >= 8.0
                        ? "Peak Physiological Efficiency"
                        : currentDayScore >= 6.0
                        ? "Balanced Recovery Baseline"
                        : currentDayScore > 0
                        ? "Rest & Tissue Restoration"
                        : "No Telemetry Logged Yet"}
                    </Text>
                  </View>
                </View>

                {prevDayScore > 0 && currentDayScore > 0 ? (
                  <View
                    style={[
                      styles.dayDeltaBadge,
                      dayDelta >= 0 ? styles.dayDeltaPos : styles.dayDeltaNeg,
                    ]}
                  >
                    {dayDelta >= 0 ? (
                      <ArrowUpRight size={11} color="#047857" />
                    ) : (
                      <ArrowDownRight size={11} color="#dc2626" />
                    )}
                    <Text
                      style={[
                        styles.dayDeltaText,
                        dayDelta >= 0 ? styles.deltaTextPositive : styles.deltaTextNegative,
                      ]}
                      numberOfLines={1}
                    >
                      {dayDelta >= 0 ? `+${dayDelta.toFixed(1)}` : `${dayDelta.toFixed(1)}`}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Day-on-Day Comparative Shift Strip */}
              {(prevDayScore > 0 || currentDayScore > 0) && (
                <View style={styles.dodShiftContainer}>
                  <View style={styles.dodShiftHeader}>
                    <TrendingUp size={13} color="#047857" />
                    <Text style={styles.dodShiftTitle}>Day-on-Day Shift (vs Previous Day)</Text>
                  </View>
                  <View style={styles.dodShiftGrid}>
                    <View style={styles.dodShiftTile}>
                      <Text style={styles.dodShiftLabel}>Steps</Text>
                      <Text style={[styles.dodShiftVal, stepsDelta >= 0 ? styles.textPositive : styles.textNegative]}>
                        {prevSteps > 0 && currentSteps > 0
                          ? stepsDelta >= 0
                            ? `+${stepsDelta.toLocaleString()}`
                            : `${stepsDelta.toLocaleString()}`
                          : currentSteps > 0
                          ? `${currentSteps.toLocaleString()}`
                          : "—"}
                      </Text>
                    </View>
                    <View style={styles.dodShiftTile}>
                      <Text style={styles.dodShiftLabel}>Active Burn</Text>
                      <Text style={[styles.dodShiftVal, calsDelta >= 0 ? styles.textPositive : styles.textNegative]}>
                        {prevCals > 0 && currentCals > 0
                          ? calsDelta >= 0
                            ? `+${calsDelta} kcal`
                            : `${calsDelta} kcal`
                          : currentCals > 0
                          ? `${currentCals} kcal`
                          : "—"}
                      </Text>
                    </View>
                    <View style={styles.dodShiftTile}>
                      <Text style={styles.dodShiftLabel}>Fat Burned</Text>
                      <Text style={[styles.dodShiftVal, fatDelta >= 0 ? styles.textPositive : styles.textNegative]}>
                        {prevFatBurned > 0 && currentFatBurned > 0
                          ? fatDelta >= 0
                            ? `+${fatDelta}g`
                            : `${fatDelta}g`
                          : currentFatBurned > 0
                          ? `${currentFatBurned}g`
                          : "—"}
                      </Text>
                    </View>
                    <View style={styles.dodShiftTile}>
                      <Text style={styles.dodShiftLabel}>Hydration</Text>
                      <Text style={[styles.dodShiftVal, hydrationDelta >= 0 ? styles.textPositive : styles.textNegative]}>
                        {prevHydrationMl > 0 && currentHydrationMl > 0
                          ? hydrationDelta >= 0
                            ? `+${hydrationDelta} ml`
                            : `${hydrationDelta} ml`
                          : currentHydrationMl > 0
                          ? `${currentHydrationMl} ml`
                          : "—"}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* 5 Biometric Pillar Cards */}
              <View style={styles.pillarsListContainer}>
                {/* Pillar 1: Movement & Lipid Burn */}
                <View style={styles.biometricDetailedCard}>
                  <View style={styles.biometricCardTop}>
                    <View style={styles.biometricTitleRow}>
                      <View style={[styles.biometricIconBadge, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                        <Footprints size={15} color="#047857" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.biometricCardTitle} numberOfLines={1}>Movement & Lipid Burn</Text>
                        <Text style={styles.biometricCardSub} numberOfLines={1}>Daily cadence, energy expenditure & fat oxidation</Text>
                      </View>
                      <View style={styles.biometricScorePill}>
                        <Text style={styles.biometricScorePillText}>
                          {selectedRecord?.steps ? `${selectedRecord.steps.toLocaleString()} steps` : "0 steps"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.biometricStatsRow}>
                    <View style={styles.biometricStatItem}>
                      <Text style={styles.biometricStatLabel}>Total Distance</Text>
                      <Text style={styles.biometricStatValue}>{selectedRecord?.distanceKm ?? 0} km</Text>
                    </View>
                    <View style={styles.biometricStatItem}>
                      <Text style={styles.biometricStatLabel}>Active Burn</Text>
                      <Text style={[styles.biometricStatValue, { color: "#ea580c" }]}>{currentCals} kcal</Text>
                    </View>
                    <View style={[styles.biometricStatItem, styles.fatBurnedHighlight]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Flame size={11} color="#b45309" />
                        <Text style={[styles.biometricStatLabel, { color: "#b45309", fontWeight: "800", marginBottom: 0 }]}>
                          Fat Burned
                        </Text>
                      </View>
                      <Text style={[styles.biometricStatValue, { color: "#b45309", fontWeight: "900" }]}>
                        {currentFatBurned} g
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Pillar 2: Nutrition & Macronutrient Intake */}
                <View style={styles.biometricDetailedCard}>
                  <View style={styles.biometricCardTop}>
                    <View style={styles.biometricTitleRow}>
                      <View style={[styles.biometricIconBadge, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                        <Utensils size={15} color="#b45309" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.biometricCardTitle} numberOfLines={1}>Nutrition & Macronutrients</Text>
                        <Text style={styles.biometricCardSub} numberOfLines={1}>Caloric balance, protein accretion & macros</Text>
                      </View>
                      <View style={[styles.biometricScorePill, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                        <Text style={[styles.biometricScorePillText, { color: "#b45309" }]}>
                          {selectedRecord?.caloriesConsumed ? `${selectedRecord.caloriesConsumed} kcal` : "0 kcal"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.calTrack}>
                    <View
                      style={[
                        styles.calFill,
                        {
                          width: `${Math.min(100, Math.round(((selectedRecord?.caloriesConsumed || 0) / 2100) * 100))}%`,
                          backgroundColor: "#f59e0b",
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.biometricStatsRow}>
                    <View style={styles.biometricStatItem}>
                      <Text style={styles.biometricStatLabel}>Protein</Text>
                      <Text style={styles.biometricStatValue}>{selectedRecord?.proteinGrams ?? 0}g</Text>
                    </View>
                    <View style={styles.biometricStatItem}>
                      <Text style={styles.biometricStatLabel}>Carbohydrates</Text>
                      <Text style={styles.biometricStatValue}>{selectedRecord?.carbsGrams ?? 0}g</Text>
                    </View>
                    <View style={styles.biometricStatItem}>
                      <Text style={styles.biometricStatLabel}>Dietary Fat</Text>
                      <Text style={styles.biometricStatValue}>{selectedRecord?.fatGrams ?? 0}g</Text>
                    </View>
                  </View>
                </View>

                {/* Pillar 3: Sleep & Circadian Restoration */}
                <View style={styles.biometricDetailedCard}>
                  <View style={styles.biometricCardTop}>
                    <View style={styles.biometricTitleRow}>
                      <View style={[styles.biometricIconBadge, { backgroundColor: "rgba(99, 102, 241, 0.15)" }]}>
                        <Moon size={15} color="#4338ca" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.biometricCardTitle} numberOfLines={1}>Sleep & Circadian Restoration</Text>
                        <Text style={styles.biometricCardSub} numberOfLines={1}>Neuro-muscular recovery & sleep quality</Text>
                      </View>
                      <View style={[styles.biometricScorePill, { backgroundColor: "rgba(99, 102, 241, 0.15)" }]}>
                        <Text style={[styles.biometricScorePillText, { color: "#4338ca" }]}>
                          {selectedRecord?.sleepHours ? `${selectedRecord.sleepHours} hrs` : "0.0 hrs"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.biometricStatsRow}>
                    <View style={styles.biometricStatItem}>
                      <Text style={styles.biometricStatLabel}>Total Duration</Text>
                      <Text style={styles.biometricStatValue}>
                        {selectedRecord?.sleepHours ? `${selectedRecord.sleepHours} hrs` : "Not logged"}
                      </Text>
                    </View>
                    <View style={styles.biometricStatItem}>
                      <Text style={styles.biometricStatLabel}>Restoration Quality</Text>
                      <Text style={[styles.biometricStatValue, { color: "#4338ca" }]}>
                        {selectedRecord?.sleepQuality || "Normal"}
                      </Text>
                    </View>
                    <View style={styles.biometricStatItem}>
                      <Text style={styles.biometricStatLabel}>Target Baseline</Text>
                      <Text style={styles.biometricStatValue}>8.0 hrs</Text>
                    </View>
                  </View>
                </View>

                {/* Pillar 4: Dedicated Hydration & Electrolytes */}
                <View style={styles.biometricDetailedCard}>
                  <View style={styles.biometricCardTop}>
                    <View style={styles.biometricTitleRow}>
                      <View style={[styles.biometricIconBadge, { backgroundColor: "rgba(2, 132, 199, 0.15)" }]}>
                        <Droplets size={15} color="#0284c7" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.biometricCardTitle} numberOfLines={1}>Hydration & Electrolytes</Text>
                        <Text style={styles.biometricCardSub} numberOfLines={1}>Cellular hydration, water volume & fluid pacing</Text>
                      </View>
                      <View style={[styles.biometricScorePill, { backgroundColor: "rgba(2, 132, 199, 0.15)" }]}>
                        <Text style={[styles.biometricScorePillText, { color: "#0284c7" }]}>
                          {selectedRecord?.hydrationMl ? `${selectedRecord.hydrationMl} ml` : "0 ml"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.biometricStatsRow}>
                    <View style={styles.biometricStatItem}>
                      <Text style={styles.biometricStatLabel}>Total Volume</Text>
                      <Text style={[styles.biometricStatValue, { color: "#0284c7" }]}>
                        {selectedRecord?.hydrationMl ? `${selectedRecord.hydrationMl} ml` : "0 ml"}
                      </Text>
                    </View>
                    <View style={styles.biometricStatItem}>
                      <Text style={styles.biometricStatLabel}>Standard Cups</Text>
                      <Text style={styles.biometricStatValue}>{selectedRecord?.hydrationCups ?? 0} cups</Text>
                    </View>
                    <View style={styles.biometricStatItem}>
                      <Text style={styles.biometricStatLabel}>Target Compliance</Text>
                      <Text style={styles.biometricStatValue}>
                        {Math.min(100, Math.round(((selectedRecord?.hydrationMl || 0) / 2000) * 100))}% of 2L
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Pillar 5: Dedicated Digital Wellbeing & Screen Focus */}
                <View style={styles.biometricDetailedCard}>
                  <View style={styles.biometricCardTop}>
                    <View style={styles.biometricTitleRow}>
                      <View style={[styles.biometricIconBadge, { backgroundColor: "rgba(139, 92, 246, 0.15)" }]}>
                        <Smartphone size={15} color="#7c3aed" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.biometricCardTitle} numberOfLines={1}>Digital Wellbeing & Screen Focus</Text>
                        <Text style={styles.biometricCardSub} numberOfLines={1}>Visual cognitive load, mindful screen exposure & limits</Text>
                      </View>
                      <View style={[styles.biometricScorePill, { backgroundColor: "rgba(139, 92, 246, 0.15)" }]}>
                        <Text style={[styles.biometricScorePillText, { color: "#7c3aed" }]}>
                          {selectedRecord?.screenMinutes
                            ? `${Math.floor(selectedRecord.screenMinutes / 60)}h ${selectedRecord.screenMinutes % 60}m`
                            : "0m"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.biometricStatsRow}>
                    <View style={styles.biometricStatItem}>
                      <Text style={styles.biometricStatLabel}>Active Screen</Text>
                      <Text style={[styles.biometricStatValue, { color: "#7c3aed" }]}>
                        {selectedRecord?.screenMinutes ?? 0} mins
                      </Text>
                    </View>
                    <View style={styles.biometricStatItem}>
                      <Text style={styles.biometricStatLabel}>Daily Target Limit</Text>
                      <Text style={styles.biometricStatValue}>180 mins</Text>
                    </View>
                    <View style={styles.biometricStatItem}>
                      <Text style={styles.biometricStatLabel}>Neuro-Load Status</Text>
                      <Text
                        style={[
                          styles.biometricStatValue,
                          {
                            fontSize: 11,
                            color: (selectedRecord?.screenMinutes || 0) <= 180 ? "#047857" : "#dc2626",
                          },
                        ]}
                      >
                        {(selectedRecord?.screenMinutes || 0) <= 180 ? "Optimal Focus" : "Elevated Exposure"}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* 3-Pillar Clinical AI Synthesis */}
            <View style={styles.aiInsightsSection}>
              <View style={styles.aiHeaderRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <Sparkles size={17} color="#10b981" />
                    <Text style={styles.sectionHeaderTitle}>3-Pillar Clinical AI Synthesis</Text>
                  </View>
                  <Text style={styles.sectionHeaderSub}>
                    Continuous physiological synthesis of biomotor load, circadian sleep, and metabolic nutrient flux.
                  </Text>
                </View>

                <Pressable
                  style={[styles.reanalyzeBtn, isGeneratingAi && styles.reanalyzeBtnDisabled]}
                  onPress={() => {
                    if (selectedRecord && monthlySummary && !isGeneratingAi) {
                      triggerAiSynthesis(selectedRecord, monthlySummary, true);
                    }
                  }}
                  disabled={isGeneratingAi}
                  accessibilityRole="button"
                  accessibilityLabel="Re-analyze with Google Gemini AI"
                >
                  {isGeneratingAi ? (
                    <ActivityIndicator size="small" color="#10b981" />
                  ) : (
                    <RefreshCw size={12} color="#10b981" />
                  )}
                  <Text style={styles.reanalyzeBtnText}>
                    {isGeneratingAi ? "Synthesizing..." : "Re-analyze"}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.aiMetaRow}>
                <View style={aiInsights?.isAiGenerated ? styles.geminiLiveBadge : styles.geminiBaselineBadge}>
                  <Zap size={11} color={aiInsights?.isAiGenerated ? "#10b981" : "#94a3b8"} />
                  <Text style={aiInsights?.isAiGenerated ? styles.geminiLiveBadgeText : styles.geminiBaselineBadgeText}>
                    {aiInsights?.isAiGenerated
                      ? `Powered by Google Gemini (${aiInsights.modelUsed || "Flash"})`
                      : "Clinical Bio-Intelligence • Baseline Telemetry"}
                  </Text>
                </View>
              </View>

              {isGeneratingAi && (
                <View style={styles.aiGeneratingBanner}>
                  <ActivityIndicator size="small" color="#10b981" />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.aiGeneratingBannerTitle}>Querying Google Gemini Bio-Engine...</Text>
                    <Text style={styles.aiGeneratingBannerSub}>
                      Synthesizing biomarkers, leucine saturation, glymphatic sleep debt, and metabolic energy flux.
                    </Text>
                  </View>
                </View>
              )}

              {aiInsights?.movement && (
                <View style={styles.insightCard}>
                  <View style={styles.insightCardHeader}>
                    <View style={styles.insightIconBadgeGreen}>
                      <Footprints size={15} color="#047857" />
                    </View>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Text style={styles.insightCardTitle} numberOfLines={1}>{aiInsights.movement.title}</Text>
                      <Text style={styles.insightScoreTag} numberOfLines={1}>{aiInsights.movement.scoreLabel}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        aiInsights.movement.status === "optimal"
                          ? styles.statusPillGreen
                          : aiInsights.movement.status === "balanced"
                          ? styles.statusPillAmber
                          : styles.statusPillRed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          aiInsights.movement.status === "optimal"
                            ? styles.statusTextGreen
                            : aiInsights.movement.status === "balanced"
                            ? styles.statusTextAmber
                            : styles.statusTextRed,
                        ]}
                        numberOfLines={1}
                      >
                        {aiInsights.movement.status.replace("_", " ").toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.insightObservation}>{aiInsights.movement.observation}</Text>
                  <View style={styles.loreBox}>
                    <Info size={13} color="#047857" style={{ marginTop: 2 }} />
                    <Text style={styles.loreText}>{aiInsights.movement.clinicalLore}</Text>
                  </View>
                  <View style={styles.actionTipBox}>
                    <Sparkles size={13} color="#b45309" style={{ marginTop: 2 }} />
                    <Text style={styles.actionTipText}>
                      <Text style={{ fontWeight: "bold" }}>Next Action: </Text>
                      {aiInsights.movement.actionableTip}
                    </Text>
                  </View>
                </View>
              )}

              {aiInsights?.recovery && (
                <View style={styles.insightCard}>
                  <View style={styles.insightCardHeader}>
                    <View style={styles.insightIconBadgePurple}>
                      <Moon size={15} color="#4338ca" />
                    </View>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Text style={styles.insightCardTitle} numberOfLines={1}>{aiInsights.recovery.title}</Text>
                      <Text style={styles.insightScoreTag} numberOfLines={1}>{aiInsights.recovery.scoreLabel}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        aiInsights.recovery.status === "optimal"
                          ? styles.statusPillGreen
                          : aiInsights.recovery.status === "balanced"
                          ? styles.statusPillAmber
                          : styles.statusPillRed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          aiInsights.recovery.status === "optimal"
                            ? styles.statusTextGreen
                            : aiInsights.recovery.status === "balanced"
                            ? styles.statusTextAmber
                            : styles.statusTextRed,
                        ]}
                        numberOfLines={1}
                      >
                        {aiInsights.recovery.status.replace("_", " ").toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.insightObservation}>{aiInsights.recovery.observation}</Text>
                  <View style={styles.loreBox}>
                    <Info size={13} color="#4338ca" style={{ marginTop: 2 }} />
                    <Text style={styles.loreText}>{aiInsights.recovery.clinicalLore}</Text>
                  </View>
                  <View style={styles.actionTipBox}>
                    <Sparkles size={13} color="#b45309" style={{ marginTop: 2 }} />
                    <Text style={styles.actionTipText}>
                      <Text style={{ fontWeight: "bold" }}>Next Action: </Text>
                      {aiInsights.recovery.actionableTip}
                    </Text>
                  </View>
                </View>
              )}

              {aiInsights?.nutrition && (
                <View style={styles.insightCard}>
                  <View style={styles.insightCardHeader}>
                    <View style={styles.insightIconBadgeAmber}>
                      <Utensils size={15} color="#b45309" />
                    </View>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Text style={styles.insightCardTitle} numberOfLines={1}>{aiInsights.nutrition.title}</Text>
                      <Text style={styles.insightScoreTag} numberOfLines={1}>{aiInsights.nutrition.scoreLabel}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        aiInsights.nutrition.status === "optimal"
                          ? styles.statusPillGreen
                          : aiInsights.nutrition.status === "balanced"
                          ? styles.statusPillAmber
                          : styles.statusPillRed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          aiInsights.nutrition.status === "optimal"
                            ? styles.statusTextGreen
                            : aiInsights.nutrition.status === "balanced"
                            ? styles.statusTextAmber
                            : styles.statusTextRed,
                        ]}
                        numberOfLines={1}
                      >
                        {aiInsights.nutrition.status.replace("_", " ").toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.insightObservation}>{aiInsights.nutrition.observation}</Text>
                  <View style={styles.loreBox}>
                    <Info size={13} color="#b45309" style={{ marginTop: 2 }} />
                    <Text style={styles.loreText}>{aiInsights.nutrition.clinicalLore}</Text>
                  </View>
                  <View style={styles.actionTipBox}>
                    <Sparkles size={13} color="#b45309" style={{ marginTop: 2 }} />
                    <Text style={styles.actionTipText}>
                      <Text style={{ fontWeight: "bold" }}>Next Action: </Text>
                      {aiInsights.nutrition.actionableTip}
                    </Text>
                  </View>
                </View>
              )}

              {aiInsights?.generatedAt && aiInsights?.isAiGenerated && (
                <View style={styles.aiTimestampRow}>
                  <CheckCircle2 size={12} color="#059669" />
                  <Text style={styles.aiTimestampText}>
                    Synthesized via Google Gemini at {new Date(aiInsights.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              )}
            </View>

            {/* 8:00 AM Score Alert Monitoring Card */}
            <View style={styles.notificationCard}>
              <View style={styles.notificationHeader}>
                <View style={styles.bellIconBox}>
                  <Bell size={16} color="#047857" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifTitle}>8:00 AM Daily Briefing & Alert</Text>
                  <Text style={styles.notifSub}>
                    Automatically evaluates yesterday's score vs the day prior and alerts you of notable momentum changes.
                  </Text>
                </View>
              </View>

              {alertFeedback ? (
                <View style={styles.feedbackBanner}>
                  <Text style={styles.feedbackText}>{alertFeedback}</Text>
                </View>
              ) : null}

              <Pressable style={styles.testAlertBtn} onPress={handleTestNotification}>
                <Bell size={13} color="#ffffff" />
                <Text style={styles.testAlertBtnText}>Test 8:00 AM Health Briefing</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bgSolid,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 54 : 38,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 218, 210, 0.15)",
    backgroundColor: THEME.colors.bgSolid,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSub: {
    fontSize: 9,
    fontWeight: "800",
    color: "#10b981",
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
  },
  physicianExportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  physicianExportBtnText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#10b981",
    letterSpacing: 0.5,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10b981",
  },
  exportToastBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#10b981",
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  exportToastText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#050b08",
  },

  horizonBarWrapper: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  horizonBar: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  horizonPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  horizonPillActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  horizonIcon: {
    fontSize: 11,
  },
  horizonText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
  },
  horizonTextActive: {
    color: "#34d399",
    fontWeight: "800",
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 110,
    gap: 16,
  },

  tirTelemetryCard: {
    backgroundColor: "rgba(56, 189, 248, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  tirHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tirCardTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#38bdf8",
  },
  tirStatusBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tirStatusBadgeText: {
    color: "#38bdf8",
    fontSize: 10,
    fontWeight: "800",
  },
  tirMetricsGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tirMetricItem: {
    flex: 1,
    alignItems: "center",
  },
  tirMetricLabel: {
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: "700",
  },
  tirMetricVal: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
  },
  tirMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },

  horizonHeroCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 22,
    padding: 18,
    gap: 14,
  },
  horizonHeroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  horizonHeroLabel: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  horizonHeroStatus: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  horizonHeroSub: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
  },
  fatigueGaugeBox: {
    width: 64,
    height: 56,
    borderRadius: 14,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  fatigueGaugeLabel: {
    color: "#f59e0b",
    fontSize: 8,
    fontWeight: "800",
  },
  fatigueGaugeVal: {
    color: "#fbbf24",
    fontSize: 16,
    fontWeight: "900",
  },
  sevenDayStatsRow: {
    flexDirection: "row",
    gap: 8,
  },
  sevenDayStatTile: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
  },
  sevenDayStatLabel: {
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
  },
  sevenDayStatVal: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 4,
  },

  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthNavArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  monthNameWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  monthNavTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc",
  },
  todayPill: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  todayPillText: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "800",
  },

  monthlyHeroCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  monthlyHeroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthlyHeroLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 0.5,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 2,
  },
  monthlyScoreLarge: {
    fontSize: 28,
    fontWeight: "900",
    color: "#f8fafc",
  },
  monthlyScoreMax: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  deltaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  deltaBadgePositive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  deltaBadgeNegative: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  deltaBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  deltaTextPositive: {
    color: "#10b981",
  },
  deltaTextNegative: {
    color: "#ef4444",
  },
  deltaBadgeNeutral: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  deltaTextNeutral: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "700",
  },
  monthlyHeroSubtext: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 17,
  },
  monthlyMetricsGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderRadius: 14,
    padding: 10,
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  metricValue: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  metricLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "700",
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },

  calendarCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  calendarHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc",
  },
  calendarTapHint: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  weekdayLabel: {
    width: "14%",
    textAlign: "center",
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 8,
  },
  emptyDayTile: {
    width: "14.28%",
    height: 48,
  },
  dayTile: {
    width: "14.28%",
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  dayTileSelected: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderWidth: 1,
    borderColor: "#10b981",
  },
  dayTileToday: {
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  dayNumberText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "700",
  },
  dayNumberSelected: {
    color: "#10b981",
    fontWeight: "900",
  },
  dayNumberToday: {
    color: "#f8fafc",
    fontWeight: "800",
  },
  dayScorePill: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    marginTop: 2,
  },
  dayScoreText: {
    fontSize: 9,
    fontWeight: "800",
  },
  dayScoreDotEmpty: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginTop: 5,
  },
  calendarLegendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "600",
  },

  dayInspectorCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  dayInspectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inspectorDateTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900",
  },
  inspectorTodayBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inspectorTodayBadgeText: {
    color: "#10b981",
    fontSize: 9,
    fontWeight: "900",
  },
  inspectorSubtitle: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  refreshIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  dayScoreBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 16,
    padding: 12,
  },
  dayScoreLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  dayScoreVal: {
    color: "#f8fafc",
    fontSize: 26,
    fontWeight: "900",
  },
  dayScoreUnit: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
  },
  dayScoreTier: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 1,
  },
  dayDeltaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  dayDeltaPos: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  dayDeltaNeg: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  dayDeltaText: {
    fontSize: 11,
    fontWeight: "800",
  },

  dodShiftContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  dodShiftHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dodShiftTitle: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  dodShiftGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dodShiftTile: {
    flex: 1,
    alignItems: "center",
  },
  dodShiftLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "700",
  },
  dodShiftVal: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  textPositive: {
    color: "#10b981",
  },
  textNegative: {
    color: "#ef4444",
  },

  pillarsListContainer: {
    gap: 10,
  },
  biometricDetailedCard: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  biometricCardTop: {},
  biometricTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  biometricIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  biometricCardTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  biometricCardSub: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "500",
  },
  biometricScorePill: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  biometricScorePillText: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "800",
  },
  biometricStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 10,
    padding: 8,
  },
  biometricStatItem: {
    flex: 1,
    alignItems: "center",
  },
  biometricStatLabel: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "700",
  },
  biometricStatValue: {
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  fatBurnedHighlight: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderRadius: 8,
  },
  calTrack: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 2,
    overflow: "hidden",
  },
  calFill: {
    height: "100%",
  },

  aiInsightsSection: {
    gap: 10,
  },
  aiHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeaderTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900",
  },
  sectionHeaderSub: {
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  reanalyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  reanalyzeBtnDisabled: {
    opacity: 0.6,
  },
  reanalyzeBtnText: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "800",
  },
  aiMetaRow: {
    flexDirection: "row",
  },
  geminiLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  geminiLiveBadgeText: {
    color: "#34d399",
    fontSize: 10,
    fontWeight: "700",
  },
  geminiBaselineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  geminiBaselineBadgeText: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "600",
  },
  aiGeneratingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    borderRadius: 14,
    padding: 12,
  },
  aiGeneratingBannerTitle: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "800",
  },
  aiGeneratingBannerSub: {
    color: "#cbd5e1",
    fontSize: 10,
    marginTop: 2,
  },
  insightCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  insightCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  insightIconBadgeGreen: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  insightIconBadgePurple: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  insightIconBadgeAmber: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  insightCardTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  insightScoreTag: {
    color: "#64748b",
    fontSize: 10,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillGreen: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  statusPillAmber: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  statusPillRed: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: "900",
  },
  statusTextGreen: {
    color: "#10b981",
  },
  statusTextAmber: {
    color: "#f59e0b",
  },
  statusTextRed: {
    color: "#ef4444",
  },
  insightObservation: {
    color: "#cbd5e1",
    fontSize: 12,
    lineHeight: 17,
  },
  loreBox: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderRadius: 10,
    padding: 8,
  },
  loreText: {
    flex: 1,
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 15,
  },
  actionTipBox: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderRadius: 10,
    padding: 8,
  },
  actionTipText: {
    flex: 1,
    color: "#fde68a",
    fontSize: 11,
    lineHeight: 15,
  },
  aiTimestampRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 4,
  },
  aiTimestampText: {
    color: "#64748b",
    fontSize: 10,
  },

  notificationCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  notificationHeader: {
    flexDirection: "row",
    gap: 10,
  },
  bellIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  notifSub: {
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  feedbackBanner: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderRadius: 8,
    padding: 8,
  },
  feedbackText: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  testAlertBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#10b981",
    paddingVertical: 10,
    borderRadius: 12,
  },
  testAlertBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },

  card: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    padding: 16,
    gap: 6,
  },
  cardSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 6,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
    borderRadius: 16,
    padding: 14,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 11,
    color: "#94a3b8",
    lineHeight: 16,
  },
});
