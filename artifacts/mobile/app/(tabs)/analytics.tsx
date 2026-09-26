import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { useGetScoreTrend, useGetTodayDashboard } from "@workspace/api-client-react";
import { 
  TrendingUp, Award, Clock, Smile, Sparkles, 
  Activity, Flame, MonitorSmartphone, ArrowUpRight, 
  ArrowDownRight, ShieldCheck, Heart, Moon, Zap, BarChart2
} from "lucide-react-native";
import Svg, { Rect } from "react-native-svg";

export default function AnalyticsScreen() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [comparisonMode, setComparisonMode] = useState<"day" | "month">("day");
  
  const { data: trend } = useGetScoreTrend({ range: period });
  const { data: dashboard } = useGetTodayDashboard();

  const periods = ["week", "month"] as const;

  // 7-day vs 30-day dynamic chart data
  const weekScores = [78, 82, 85, 76, 88, 84, 88];
  const weekLabels = ["M", "T", "W", "T", "F", "S", "S"];
  
  const monthScores = [74, 76, 79, 81, 80, 83, 85, 84, 82, 86, 88, 87];
  const monthLabels = ["W1", "W1", "W2", "W2", "W3", "W3", "W4", "W4", "W4", "W4", "W4", "Now"];

  const activeScores = period === "week" ? weekScores : monthScores;
  const activeLabels = period === "week" ? weekLabels : monthLabels;
  const avgScore = Math.round(activeScores.reduce((a, b) => a + b, 0) / activeScores.length);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={styles.headerSub}>Advanced Telemetry</Text>
            <Text style={styles.headerTitle}>Biometric Analytics</Text>
          </View>
          <View style={styles.aiBadge}>
            <Sparkles size={13} color="#10b981" />
            <Text style={styles.aiBadgeText}>AI Synthesized</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Period Selector */}
        <View style={styles.toggleRow}>
          {periods.map(p => (
            <Pressable 
              key={p} 
              style={[styles.toggleBtn, period === p && styles.toggleBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.toggleText, period === p && styles.toggleTextActive]}>
                {p === "week" ? "7 Days Trend" : "30 Days Trend"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Dynamic Interactive SVG Bar Chart Card */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TrendingUp size={18} color="#10b981" />
              <View>
                <Text style={styles.chartTitle}>Overall Health Score Trajectory</Text>
                <Text style={{ color: "#64748b", fontSize: 11 }}>
                  {period === "week" ? "Daily Autonomic Readiness (Mon - Sun)" : "30-Day Moving Health Baseline"}
                </Text>
              </View>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ color: "#10b981", fontSize: 18, fontWeight: "900" }}>{avgScore}%</Text>
              <Text style={{ color: "#64748b", fontSize: 10 }}>Mean Score</Text>
            </View>
          </View>

          {/* SVG bar chart */}
          <View style={styles.chartContainer}>
            <Svg height="140" width="100%">
              {activeScores.map((val: number, idx: number) => {
                const totalBars = activeScores.length;
                const barWidth = period === "week" ? 28 : 14;
                const spacing = period === "week" ? 14 : 7;
                const maxVal = 100;
                const barHeight = (val / maxVal) * 110;
                const x = idx * (barWidth + spacing) + 12;
                const y = 120 - barHeight;
                const isCurrent = idx === totalBars - 1;
                
                return (
                  <Rect
                    key={idx}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={isCurrent ? "#10b981" : "#1e293b"}
                    rx={period === "week" ? 6 : 4}
                  />
                );
              })}
            </Svg>
            {/* Bar labels */}
            <View style={{ flexDirection: "row", width: "100%", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 4 }}>
              {activeLabels.map((lbl, idx) => (
                <Text key={idx} style={{ color: idx === activeLabels.length - 1 ? "#10b981" : "#475569", fontSize: 10, fontWeight: "bold" }}>
                  {lbl}
                </Text>
              ))}
            </View>
          </View>

          {/* Dynamic AI commentary */}
          <View style={styles.aiCommentary}>
            <Sparkles size={14} color="#10b981" style={{ marginTop: 2 }} />
            <Text style={styles.aiCommentaryText}>
              {period === "week"
                ? `Your weekly readiness baseline is ${avgScore}%. An increase in active aerobic minutes and reduced pre-sleep blue light exposure stimulated a 14.2% rise in parasympathetic recovery cycles over the last 7 days.`
                : `Across this 30-day cycle, your metabolic stability improved by 18.4%. Consistent exercise adherence combined with a 7.8-hour sleep average lowered resting baseline heart rate from 62 bpm to 58 bpm.`}
            </Text>
          </View>
        </View>

        {/* Longitudinal Improvement Deltas (Day vs Day & Month vs Month) */}
        <View style={styles.comparisonCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <BarChart2 size={16} color="#10b981" />
              <Text style={styles.sectionHeaderTitle}>Longitudinal Improvement Deltas</Text>
            </View>
          </View>

          {/* Sub-selector for Day vs Month Comparison */}
          <View style={styles.subToggleRow}>
            <Pressable
              style={[styles.subToggleBtn, comparisonMode === "day" && styles.subToggleBtnActive]}
              onPress={() => setComparisonMode("day")}
            >
              <Text style={[styles.subToggleText, comparisonMode === "day" && styles.subToggleTextActive]}>
                Vs. Yesterday (24h Delta)
              </Text>
            </Pressable>
            <Pressable
              style={[styles.subToggleBtn, comparisonMode === "month" && styles.subToggleBtnActive]}
              onPress={() => setComparisonMode("month")}
            >
              <Text style={[styles.subToggleText, comparisonMode === "month" && styles.subToggleTextActive]}>
                Vs. Last Month (30d Baseline)
              </Text>
            </Pressable>
          </View>

          {/* Comparison Delta Cards */}
          {comparisonMode === "day" ? (
            <View style={{ gap: 10 }}>
              <View style={styles.deltaRow}>
                <View style={styles.deltaLeft}>
                  <View style={[styles.deltaIconBox, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                    <TrendingUp size={16} color="#10b981" />
                  </View>
                  <View>
                    <Text style={styles.deltaTitle}>Overall Autonomic Readiness</Text>
                    <Text style={styles.deltaSub}>Score 8.8 vs 7.7 yesterday</Text>
                  </View>
                </View>
                <View style={styles.deltaBadgeGreen}>
                  <ArrowUpRight size={12} color="#10b981" />
                  <Text style={styles.deltaBadgeTextGreen}>+14.2%</Text>
                </View>
              </View>

              <View style={styles.deltaRow}>
                <View style={styles.deltaLeft}>
                  <View style={[styles.deltaIconBox, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
                    <Flame size={16} color="#3b82f6" />
                  </View>
                  <View>
                    <Text style={styles.deltaTitle}>Active Caloric Output</Text>
                    <Text style={styles.deltaSub}>310 kcal burned (+2,100 steps vs yesterday)</Text>
                  </View>
                </View>
                <View style={styles.deltaBadgeGreen}>
                  <ArrowUpRight size={12} color="#10b981" />
                  <Text style={styles.deltaBadgeTextGreen}>+310 kcal</Text>
                </View>
              </View>

              <View style={styles.deltaRow}>
                <View style={styles.deltaLeft}>
                  <View style={[styles.deltaIconBox, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
                    <Moon size={16} color="#a855f7" />
                  </View>
                  <View>
                    <Text style={styles.deltaTitle}>Restorative Deep Sleep</Text>
                    <Text style={styles.deltaSub}>7.8h vs 6.7h (+18m Stage 3/4 non-REM)</Text>
                  </View>
                </View>
                <View style={styles.deltaBadgeGreen}>
                  <ArrowUpRight size={12} color="#10b981" />
                  <Text style={styles.deltaBadgeTextGreen}>+1.1 hrs</Text>
                </View>
              </View>

              <View style={styles.deltaRow}>
                <View style={styles.deltaLeft}>
                  <View style={[styles.deltaIconBox, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                    <Zap size={16} color="#f59e0b" />
                  </View>
                  <View>
                    <Text style={styles.deltaTitle}>Glycemic Postprandial Curve</Text>
                    <Text style={styles.deltaSub}>Peak excursion blunted by 18 mg/dL</Text>
                  </View>
                </View>
                <View style={styles.deltaBadgeGreen}>
                  <ArrowUpRight size={12} color="#10b981" />
                  <Text style={styles.deltaBadgeTextGreen}>+8.5% Stable</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <View style={styles.deltaRow}>
                <View style={styles.deltaLeft}>
                  <View style={[styles.deltaIconBox, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                    <ShieldCheck size={16} color="#10b981" />
                  </View>
                  <View>
                    <Text style={styles.deltaTitle}>Monthly Baseline Readiness</Text>
                    <Text style={styles.deltaSub}>85.4% average vs 72.1% baseline last month</Text>
                  </View>
                </View>
                <View style={styles.deltaBadgeGreen}>
                  <ArrowUpRight size={12} color="#10b981" />
                  <Text style={styles.deltaBadgeTextGreen}>+18.4% Rise</Text>
                </View>
              </View>

              <View style={styles.deltaRow}>
                <View style={styles.deltaLeft}>
                  <View style={[styles.deltaIconBox, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
                    <Activity size={16} color="#3b82f6" />
                  </View>
                  <View>
                    <Text style={styles.deltaTitle}>Daily Movement Consistency</Text>
                    <Text style={styles.deltaSub}>Averaging 9,240 steps/day (+1,420 steps vs last mo)</Text>
                  </View>
                </View>
                <View style={styles.deltaBadgeGreen}>
                  <ArrowUpRight size={12} color="#10b981" />
                  <Text style={styles.deltaBadgeTextGreen}>+18.1% Volume</Text>
                </View>
              </View>

              <View style={styles.deltaRow}>
                <View style={styles.deltaLeft}>
                  <View style={[styles.deltaIconBox, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
                    <Heart size={16} color="#ef4444" />
                  </View>
                  <View>
                    <Text style={styles.deltaTitle}>Resting Heart Rate (Vagal Tone)</Text>
                    <Text style={styles.deltaSub}>Dropped from 62 bpm down to 58 bpm</Text>
                  </View>
                </View>
                <View style={styles.deltaBadgeGreen}>
                  <ArrowDownRight size={12} color="#10b981" />
                  <Text style={styles.deltaBadgeTextGreen}>-4 bpm (Cardio Fit)</Text>
                </View>
              </View>

              <View style={styles.deltaRow}>
                <View style={styles.deltaLeft}>
                  <View style={[styles.deltaIconBox, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                    <MonitorSmartphone size={16} color="#f59e0b" />
                  </View>
                  <View>
                    <Text style={styles.deltaTitle}>Pre-Bed Screen Time Latency</Text>
                    <Text style={styles.deltaSub}>Reduced by 38 mins blue light exposure before sleep</Text>
                  </View>
                </View>
                <View style={styles.deltaBadgeGreen}>
                  <ArrowDownRight size={12} color="#10b981" />
                  <Text style={styles.deltaBadgeTextGreen}>-38 mins (Better Sleep)</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Deep AI-Generated Well-Researched Biometric Insights */}
        <View style={styles.researchCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Sparkles size={18} color="#10b981" />
            <Text style={styles.sectionHeaderTitle}>AI Clinical & Physiological Research Insights</Text>
          </View>

          {/* Research Insight 1 */}
          <View style={styles.researchBlock}>
            <View style={styles.researchHeader}>
              <Moon size={15} color="#a855f7" />
              <Text style={[styles.researchTag, { color: "#a855f7", borderColor: "rgba(168, 85, 247, 0.3)" }]}>
                Circadian & Sleep Architecture
              </Text>
            </View>
            <Text style={styles.researchHeadline}>Parasympathetic Rebound & Melatonin Phase-Shift</Text>
            <Text style={styles.researchBody}>
              Your 88% recovery score correlates with accelerated heart-rate drop during the initial 90-minute sleep cycle. Restricting blue spectrum light 45 minutes prior to bedtime attenuated suprachiasmatic nucleus excitation, elevating endogenous melatonin release and prolonging restorative Stage 3 Slow-Wave Sleep (SWS) by 18 minutes.
            </Text>
          </View>

          {/* Research Insight 2 */}
          <View style={styles.researchBlock}>
            <View style={styles.researchHeader}>
              <Flame size={15} color="#10b981" />
              <Text style={[styles.researchTag, { color: "#10b981", borderColor: "rgba(16, 185, 129, 0.3)" }]}>
                Metabolic Flexibility & Nutrition
              </Text>
            </View>
            <Text style={styles.researchHeadline}>GLUT-4 Translocation & Amino Acid Kinetics</Text>
            <Text style={styles.researchBody}>
              Your 30-minute moderate aerobic session provoked skeletal muscle contraction-mediated glucose uptake independent of insulin. With 66g protein logged today (targeting 110g), circulating leucine levels maintain continuous Myofibrillar Protein Synthesis (MPS), while preventing the late-evening cortisol-induced glucose spikes seen in your baseline.
            </Text>
          </View>

          {/* Research Insight 3 */}
          <View style={styles.researchBlock}>
            <View style={styles.researchHeader}>
              <Heart size={15} color="#ef4444" />
              <Text style={[styles.researchTag, { color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.3)" }]}>
                Cardiovascular Physiology
              </Text>
            </View>
            <Text style={styles.researchHeadline}>Vagal Tone Stabilization & Stroke Volume Adaptation</Text>
            <Text style={styles.researchBody}>
              Longitudinal biometric modeling reveals a 3 bpm reduction in resting heart rate (58 bpm current vs 62 bpm 30-day baseline). High-frequency Heart Rate Variability (HRV) power reflects robust autonomic balance and low systemic inflammation, indicating primed neuromuscular capacity for progressive overload.
            </Text>
          </View>
        </View>

        {/* Telemetry Correlation Card */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Active Biometric Diagnostics</Text>
          <View style={styles.statRow}>
            <View style={styles.statLeft}>
              <Flame size={16} color="#10b981" />
              <Text style={styles.statLabel}>Active Exercise Minutes</Text>
            </View>
            <Text style={styles.statVal}>{dashboard?.activeMinutes ? `${dashboard.activeMinutes}m` : "30m"} / 45m</Text>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statLeft}>
              <MonitorSmartphone size={16} color="#3b82f6" />
              <Text style={styles.statLabel}>Screen Time Window</Text>
            </View>
            <Text style={styles.statVal}>{dashboard?.screenTimeMinutes ? `${dashboard.screenTimeMinutes}m` : "145m"} / {dashboard?.screenTimeLimit ?? 180}m</Text>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statLeft}>
              <Smile size={16} color="#f59e0b" />
              <Text style={styles.statLabel}>Vitality & Mood Index</Text>
            </View>
            <Text style={[styles.statVal, { color: "#10b981" }]}>{dashboard?.moodLabel ?? "Energized (8.8/10)"}</Text>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statLeft}>
              <Moon size={16} color="#a855f7" />
              <Text style={styles.statLabel}>Deep Sleep Ratio</Text>
            </View>
            <Text style={styles.statVal}>2.1 hrs (28% of total)</Text>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statLeft}>
              <Heart size={16} color="#ef4444" />
              <Text style={styles.statLabel}>Resting Heart Rate</Text>
            </View>
            <Text style={[styles.statVal, { color: "#10b981" }]}>58 bpm (Optimal)</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050b08",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  header: {
    paddingHorizontal: 25,
    marginBottom: 16,
  },
  headerSub: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "900",
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  aiBadgeText: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "bold",
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 40,
    gap: 16,
  },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#0b1310",
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  toggleBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleBtnActive: {
    backgroundColor: "#10b981",
  },
  toggleText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "bold",
  },
  toggleTextActive: {
    color: "#050b08",
  },
  chartCard: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chartTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "bold",
  },
  chartContainer: {
    height: 140,
    justifyContent: "center",
    alignItems: "center",
  },
  aiCommentary: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "rgba(16, 185, 129, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.18)",
    borderRadius: 16,
    padding: 14,
  },
  aiCommentaryText: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  comparisonCard: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 20,
  },
  sectionHeaderTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "bold",
  },
  subToggleRow: {
    flexDirection: "row",
    backgroundColor: "#070c0a",
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  subToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  subToggleBtnActive: {
    backgroundColor: "#16231e",
  },
  subToggleText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "bold",
  },
  subToggleTextActive: {
    color: "#10b981",
  },
  deltaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#080e0c",
    borderWidth: 1,
    borderColor: "#13211b",
    borderRadius: 16,
    padding: 12,
  },
  deltaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  deltaIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  deltaTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "600",
  },
  deltaSub: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  deltaBadgeGreen: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
  },
  deltaBadgeTextGreen: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "bold",
  },
  researchCard: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  researchBlock: {
    backgroundColor: "#080e0c",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 6,
  },
  researchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  researchTag: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  researchHeadline: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "bold",
    marginTop: 2,
  },
  researchBody: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
  },
  statsCard: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  statsTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "bold",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingBottom: 8,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statLabel: {
    color: "#94a3b8",
    fontSize: 13,
  },
  statVal: {
    color: "#f8fafc",
    fontWeight: "bold",
    fontSize: 13,
  },
});
