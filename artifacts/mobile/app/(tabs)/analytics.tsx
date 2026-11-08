import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
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
} from "lucide-react-native";
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

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function AnalyticsScreen() {
  const today = new Date();
  const todayKey = formatDateKey(today);

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
        // Enforce clean state - purge any prewritten simulated mock metrics
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

        // 5. Asynchronously trigger Google Gemini AI clinical synthesis
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

  // Select a specific day on the calendar grid and store day-on-day data
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
  // Monday = 0, ..., Sunday = 6
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

  const currentNutrientCals = selectedRecord?.caloriesConsumed ?? 0;
  const prevNutrientCals = prevDayRecord?.caloriesConsumed ?? 0;
  const nutrientCalsDelta = prevNutrientCals > 0 && currentNutrientCals > 0 ? currentNutrientCals - prevNutrientCals : 0;

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
      {/* Top Header - Safe & Responsive */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
            <Text style={styles.headerSub} numberOfLines={1}>
              Longitudinal Telemetry
            </Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Biometric Analytics
            </Text>
          </View>
          <View style={[styles.aiBadge, { flexShrink: 0 }]}>
            <Sparkles size={11} color="#10b981" />
            <Text style={styles.aiBadgeText} numberOfLines={1}>
              AI Insights
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        removeClippedSubviews={Platform.OS === "android"}
        overScrollMode="never"
      >
        {/* ========================================================= */}
        {/* 1. MONTH SELECTOR & MONTHLY SCORE HERO CARD               */}
        {/* ========================================================= */}
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

            {/* Month-over-Month Delta Badge - Compact & Contained */}
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

          {/* Monthly Aggregates 4-Column Bar - Completely Responsive */}
          <View style={styles.monthlyMetricsGrid}>
            <View style={styles.metricItem}>
              <Footprints size={14} color="#047857" />
              <Text style={styles.metricValue} numberOfLines={1}>
                {monthlySummary && monthlySummary.totalSteps > 0
                  ? (monthlySummary.totalSteps / 1000).toFixed(1) + "k"
                  : "0"}
              </Text>
              <Text style={styles.metricLabel} numberOfLines={1}>
                Steps
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <Flame size={14} color="#b45309" />
              <Text style={styles.metricValue} numberOfLines={1}>
                {monthlySummary && monthlySummary.totalActiveCalories > 0
                  ? Math.round(monthlySummary.totalActiveCalories).toLocaleString()
                  : "0"}
              </Text>
              <Text style={styles.metricLabel} numberOfLines={1}>
                Burn
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <Moon size={14} color="#4338ca" />
              <Text style={styles.metricValue} numberOfLines={1}>
                {monthlySummary && monthlySummary.averageSleepHours > 0
                  ? `${monthlySummary.averageSleepHours}h`
                  : "0h"}
              </Text>
              <Text style={styles.metricLabel} numberOfLines={1}>
                Sleep
              </Text>
            </View>

            <View style={styles.metricDivider} />

            <View style={styles.metricItem}>
              <CheckCircle2 size={14} color="#047857" />
              <Text style={styles.metricValue} numberOfLines={1}>
                {monthlySummary?.daysLoggedCount ?? 0}/{monthlySummary?.daysInMonth ?? daysInMonth}
              </Text>
              <Text style={styles.metricLabel} numberOfLines={1}>
                Logged
              </Text>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* 2. INTERACTIVE MONTHLY CALENDAR GRID                      */}
        {/* ========================================================= */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, marginRight: 8 }}>
              <CalendarIcon size={15} color="#047857" />
              <Text style={styles.cardTitle} numberOfLines={1}>
                Daily Calendar
              </Text>
            </View>
            <Text style={styles.calendarTapHint} numberOfLines={1}>
              Tap day to inspect
            </Text>
          </View>

          {/* Weekday Labels Header */}
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((wd, i) => (
              <Text key={i} style={styles.weekdayLabel} numberOfLines={1}>
                {wd}
              </Text>
            ))}
          </View>

          {/* Grid of days - Zero Mock Data: Only displays real logged scores */}
          <View style={styles.daysGrid}>
            {/* Blank offset tiles */}
            {Array.from({ length: leadingOffset }).map((_, idx) => (
              <View key={`empty-${idx}`} style={styles.emptyDayTile} />
            ))}

            {/* Actual Month Days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              const dayRecord = monthlySummary?.recordsByDate[dateStr];
              const score = dayRecord?.overallScore ?? 0;
              const isSelected = dateStr === selectedDateStr;
              const isToday = dateStr === todayKey;

              // Color badge logic
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
                  onPress={() => handleSelectDay(dayNum)}
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

                  {/* Clean State: If not logged, display empty subtle dot; never mock data */}
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

          {/* Calendar Legend */}
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
              <Text style={styles.legendLabel}>Rest (&lt;6.0)</Text>
            </View>
          </View>
        </View>

        {/* ========================================================= */}
        {/* 3. SELECTED DAY INSPECTOR & INDIVIDUAL PILLARS CARD        */}
        {/* ========================================================= */}
        <View style={styles.dayInspectorCard}>
          {/* Day Header */}
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

            {/* Day-over-day delta (Only shown if authentic data exists) */}
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

          {/* 5 Biometric Pillar Cards: Steps & Fat Burned, Nutrition, Sleep, Hydration, Screen Time */}
          <View style={styles.pillarsListContainer}>
            {/* Pillar 1: Movement & Lipid Burn (Steps, Calorie Burn, Fat Burned) */}
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

              {/* Calorie bar */}
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

        {/* ========================================================= */}
        {/* 4. 3-PILLAR CLINICAL AI SYNTHESIS                         */}
        {/* ========================================================= */}
        <View style={styles.aiInsightsSection}>
          {/* Main Section Header with Live Status & Re-Analyze Action */}
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

          {/* Subheader Badge: Model & Generation Status */}
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

          {/* Real-time generating banner */}
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

          {/* Card 1: Movement & Biomotor Capacity */}
          {aiInsights?.movement && (
            <View style={styles.insightCard}>
              <View style={styles.insightCardHeader}>
                <View style={styles.insightIconBadgeGreen}>
                  <Footprints size={15} color="#047857" />
                </View>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.insightCardTitle} numberOfLines={1}>
                    {aiInsights.movement.title}
                  </Text>
                  <Text style={styles.insightScoreTag} numberOfLines={1}>
                    {aiInsights.movement.scoreLabel}
                  </Text>
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

          {/* Card 2: Cellular Recovery & Circadian Sleep */}
          {aiInsights?.recovery && (
            <View style={styles.insightCard}>
              <View style={styles.insightCardHeader}>
                <View style={styles.insightIconBadgePurple}>
                  <Moon size={15} color="#4338ca" />
                </View>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.insightCardTitle} numberOfLines={1}>
                    {aiInsights.recovery.title}
                  </Text>
                  <Text style={styles.insightScoreTag} numberOfLines={1}>
                    {aiInsights.recovery.scoreLabel}
                  </Text>
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

          {/* Card 3: Metabolic Synthesis & Nutrition */}
          {aiInsights?.nutrition && (
            <View style={styles.insightCard}>
              <View style={styles.insightCardHeader}>
                <View style={styles.insightIconBadgeAmber}>
                  <Utensils size={15} color="#b45309" />
                </View>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.insightCardTitle} numberOfLines={1}>
                    {aiInsights.nutrition.title}
                  </Text>
                  <Text style={styles.insightScoreTag} numberOfLines={1}>
                    {aiInsights.nutrition.scoreLabel}
                  </Text>
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

        {/* ========================================================= */}
        {/* 5. 8:00 AM SCORE ALERT MONITORING CARD                    */}
        {/* ========================================================= */}
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
            <Text style={styles.testAlertBtnText}>Test Morning Health Score Alert</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bgSolid,
    paddingTop: Platform.OS === "ios" ? 54 : 36,
  },
  header: {
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerSub: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: THEME.colors.textOnDarkPrimary,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    flexShrink: 0,
  },
  aiBadgeText: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "800",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 160, // Generous padding so the floating capsule tab bar NEVER overlaps calendar days
    gap: 14,
  },

  /* 1. Month Navigation & Hero Card */
  monthNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(238, 245, 242, 0.08)",
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  monthNavArrow: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  monthNameWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  monthNavTitle: {
    color: THEME.colors.textOnDarkPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  todayPill: {
    backgroundColor: THEME.colors.accentGreen,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  todayPillText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  monthlyHeroCard: {
    backgroundColor: THEME.colors.cardBgSolid,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  monthlyHeroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  monthlyHeroLabel: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 2,
  },
  monthlyScoreLarge: {
    fontSize: 34,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
    letterSpacing: -0.5,
  },
  monthlyScoreMax: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.colors.cardTextTertiary,
  },
  deltaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    maxWidth: "42%",
  },
  deltaBadgePositive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  deltaBadgeNegative: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  deltaBadgeNeutral: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(100, 116, 139, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    maxWidth: "45%",
  },
  deltaBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  deltaTextPositive: {
    color: "#047857",
  },
  deltaTextNegative: {
    color: "#dc2626",
  },
  deltaTextNeutral: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    fontWeight: "700",
  },
  monthlyHeroSubtext: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  monthlyMetricsGrid: {
    flexDirection: "row",
    backgroundColor: "rgba(228, 238, 233, 0.75)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    gap: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(190, 210, 202, 0.6)",
  },
  metricValue: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  metricLabel: {
    color: THEME.colors.cardTextTertiary,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    textAlign: "center",
  },

  /* 2. Interactive Monthly Calendar Grid */
  calendarCard: {
    backgroundColor: THEME.colors.cardBgSolid,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    overflow: "hidden",
  },
  calendarHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  calendarTapHint: {
    color: THEME.colors.cardTextTertiary,
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 0,
  },
  weekdayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  weekdayLabel: {
    width: "13.2%",
    textAlign: "center",
    color: THEME.colors.cardTextTertiary,
    fontSize: 10,
    fontWeight: "800",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 6,
  },
  emptyDayTile: {
    width: "13.2%",
    height: 48,
  },
  dayTile: {
    width: "13.2%",
    height: 48,
    borderRadius: 10,
    backgroundColor: "rgba(228, 238, 233, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  dayTileSelected: {
    backgroundColor: "#ffffff",
    borderColor: "#047857",
    borderWidth: 2,
    shadowColor: "#047857",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  dayTileToday: {
    borderColor: "#0284c7",
    borderWidth: 1.5,
  },
  dayNumberText: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  dayNumberSelected: {
    color: "#047857",
    fontWeight: "900",
  },
  dayNumberToday: {
    color: "#0284c7",
    fontWeight: "900",
  },
  dayScorePill: {
    borderRadius: 5,
    paddingHorizontal: 3,
    paddingVertical: 1,
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
    backgroundColor: "rgba(100, 116, 139, 0.3)",
    marginTop: 5,
  },
  calendarLegendRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(190, 210, 202, 0.4)",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLabel: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    fontWeight: "700",
  },

  /* 3. Selected Day Inspector */
  dayInspectorCard: {
    backgroundColor: THEME.colors.cardBgSolid,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    overflow: "hidden",
  },
  dayInspectorHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  inspectorDateTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 15,
    fontWeight: "900",
  },
  inspectorTodayBadge: {
    backgroundColor: "rgba(2, 132, 199, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(2, 132, 199, 0.35)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  inspectorTodayBadgeText: {
    color: "#0284c7",
    fontSize: 8,
    fontWeight: "800",
  },
  inspectorSubtitle: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  refreshIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  dayScoreBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(228, 238, 233, 0.8)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  dayScoreLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginRight: 6,
  },
  dayScoreVal: {
    fontSize: 26,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  dayScoreUnit: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    fontWeight: "700",
  },
  dayScoreTier: {
    color: "#047857",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 1,
  },
  dayDeltaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dayDeltaPos: {
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  dayDeltaNeg: {
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  dayDeltaText: {
    fontSize: 10,
    fontWeight: "800",
  },
  /* Day-on-Day Comparative Shift Strip */
  dodShiftContainer: {
    backgroundColor: "rgba(240, 246, 243, 0.95)",
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 220, 212, 0.7)",
  },
  dodShiftHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  dodShiftTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
    textTransform: "uppercase",
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
    fontSize: 9,
    fontWeight: "700",
    color: THEME.colors.cardTextSecondary,
    marginBottom: 2,
  },
  dodShiftVal: {
    fontSize: 11,
    fontWeight: "900",
  },
  textPositive: {
    color: "#047857",
  },
  textNegative: {
    color: "#dc2626",
  },

  /* 5 Dedicated Pillars List Container & Detailed Cards */
  pillarsListContainer: {
    gap: 10,
  },
  biometricDetailedCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.7)",
    gap: 8,
  },
  biometricCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  biometricTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  biometricIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  biometricCardTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  biometricCardSub: {
    fontSize: 9,
    fontWeight: "600",
    color: THEME.colors.cardTextSecondary,
    marginTop: 1,
  },
  biometricScorePill: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  biometricScorePillText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#047857",
  },
  biometricStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(245, 248, 246, 0.8)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  biometricStatItem: {
    flex: 1,
    alignItems: "center",
  },
  biometricStatLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: THEME.colors.cardTextSecondary,
    marginBottom: 2,
  },
  biometricStatValue: {
    fontSize: 12,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  fatBurnedHighlight: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  calTrack: {
    height: 6,
    backgroundColor: "rgba(220, 230, 224, 0.7)",
    borderRadius: 3,
    overflow: "hidden",
  },
  calFill: {
    height: "100%",
    borderRadius: 3,
  },
  pillarsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  pillarTile: {
    width: "48.5%",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
  },
  pillarHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 2,
  },
  pillarName: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    fontWeight: "700",
    flex: 1,
  },
  pillarMainVal: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 14,
    fontWeight: "900",
  },
  pillarSubVal: {
    color: THEME.colors.cardTextTertiary,
    fontSize: 9,
    fontWeight: "600",
    marginTop: 2,
  },

  /* 4. 3-Pillar AI Synthesis */
  aiInsightsSection: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionHeaderTitle: {
    color: THEME.colors.textOnDarkPrimary,
    fontSize: 16,
    fontWeight: "900",
  },
  sectionHeaderSub: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  insightCard: {
    backgroundColor: THEME.colors.cardBgSolid,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    gap: 8,
    overflow: "hidden",
  },
  insightCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  insightIconBadgeGreen: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  insightIconBadgePurple: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(67, 56, 202, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  insightIconBadgeAmber: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  insightCardTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  insightScoreTag: {
    color: THEME.colors.cardTextTertiary,
    fontSize: 10,
    fontWeight: "700",
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  statusPillGreen: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  statusPillAmber: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  statusPillRed: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  statusPillText: {
    fontSize: 8,
    fontWeight: "800",
  },
  statusTextGreen: {
    color: "#047857",
  },
  statusTextAmber: {
    color: "#b45309",
  },
  statusTextRed: {
    color: "#dc2626",
  },
  insightObservation: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  loreBox: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "rgba(228, 238, 233, 0.65)",
    borderRadius: 8,
    padding: 8,
  },
  loreText: {
    flex: 1,
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    lineHeight: 15,
    fontStyle: "italic",
  },
  actionTipBox: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "rgba(254, 243, 199, 0.7)",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  actionTipText: {
    flex: 1,
    color: "#92400e",
    fontSize: 11,
    lineHeight: 15,
  },

  /* 5. 8:00 AM Score Alert Monitoring Card */
  notificationCard: {
    backgroundColor: THEME.colors.cardBgSolid,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    gap: 10,
    overflow: "hidden",
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bellIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  notifSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  feedbackBanner: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  feedbackText: {
    color: "#047857",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  testAlertBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#047857",
    paddingVertical: 10,
    borderRadius: 12,
  },
  testAlertBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },

  aiHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  reanalyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  reanalyzeBtnDisabled: {
    opacity: 0.6,
  },
  reanalyzeBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10b981",
  },
  aiMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: -4,
  },
  geminiLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  geminiLiveBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#10b981",
  },
  geminiBaselineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.25)",
  },
  geminiBaselineBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
  },
  aiGeneratingBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  aiGeneratingBannerTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#10b981",
  },
  aiGeneratingBannerSub: {
    fontSize: 10,
    color: THEME.colors.cardTextSecondary,
    marginTop: 2,
  },
  aiTimestampRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
    justifyContent: "center",
  },
  aiTimestampText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#059669",
  },
});
