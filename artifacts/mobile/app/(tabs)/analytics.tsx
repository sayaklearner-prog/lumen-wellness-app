import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { useGetScoreTrend, useGetTodayDashboard } from "@workspace/api-client-react";
import { 
  TrendingUp, Award, Clock, Smile, Sparkles, 
  Activity, Flame, MonitorSmartphone 
} from "lucide-react-native";
import Svg, { Rect } from "react-native-svg";

export default function AnalyticsScreen() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  
  const { data: trend } = useGetScoreTrend({ range: period });
  const { data: dashboard } = useGetTodayDashboard();

  const periods = ["week", "month"] as const;

  // Render simple responsive bar chart using standard SVG elements
  const scoreData = (trend as any)?.scores || [80, 84, 76, 92, 88, 85, 90];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerSub}>Advanced Insights</Text>
        <Text style={styles.headerTitle}>Biometric Analytics</Text>
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
                {p === "week" ? "7 Days" : "30 Days"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Chart Card */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <TrendingUp size={16} color="#10b981" />
            <Text style={styles.chartTitle}>Overall Health Score Trend</Text>
          </View>

          {/* SVG bar chart */}
          <View style={styles.chartContainer}>
            <Svg height="140" width="100%">
              {scoreData.map((val: number, idx: number) => {
                const barWidth = 24;
                const spacing = 16;
                const maxVal = 100;
                const barHeight = (val / maxVal) * 120;
                const x = idx * (barWidth + spacing) + 10;
                const y = 120 - barHeight;
                
                return (
                  <Rect
                    key={idx}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={idx === scoreData.length - 1 ? "#10b981" : "#1e293b"}
                    rx={6}
                  />
                );
              })}
            </Svg>
          </View>

          {/* AI insights commentary */}
          <View style={styles.aiCommentary}>
            <Sparkles size={14} color="#10b981" style={{ marginTop: 2 }} />
            <Text style={styles.aiCommentaryText}>
              Your readiness average is {Math.round(scoreData.reduce((a:number,b:number)=>a+b, 0)/scoreData.length)}% this week. An increase in active hours and lower screen limit intervals before sleep contributed to a 12% rise in deep recovery cycles.
            </Text>
          </View>
        </View>

        {/* Metric breakdowns list */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Activity & Screen correlation</Text>
          <View style={styles.statRow}>
            <View style={styles.statLeft}>
              <Flame size={16} color="#10b981" />
              <Text style={styles.statLabel}>Active Minutes</Text>
            </View>
            <Text style={styles.statVal}>{dashboard?.activeMinutes ?? 0}m</Text>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statLeft}>
              <MonitorSmartphone size={16} color="#3b82f6" />
              <Text style={styles.statLabel}>Screen Time Limit</Text>
            </View>
            <Text style={styles.statVal}>{dashboard?.screenTimeMinutes ?? 0}/{dashboard?.screenTimeLimit ?? 120}m</Text>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statLeft}>
              <Smile size={16} color="#f59e0b" />
              <Text style={styles.statLabel}>Mood Index</Text>
            </View>
            <Text style={styles.statVal}>{dashboard?.moodLabel ?? "Optimal"}</Text>
          </View>
        </View>

        {/* Correlation commentary */}
        <View style={styles.correlationCard}>
          <Text style={styles.correlationHeader}>Weekly Highlights</Text>
          <View style={styles.highlightBullet}>
            <Award size={14} color="#10b981" />
            <Text style={styles.highlightText}>Target steps goal completed 5 out of 7 days.</Text>
          </View>
          <View style={styles.highlightBullet}>
            <Clock size={14} color="#3b82f6" />
            <Text style={styles.highlightText}>Consistency score is stable above 80% this period.</Text>
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
    marginBottom: 20,
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
  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 40,
    gap: 20,
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
    gap: 15,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
    backgroundColor: "rgba(16, 185, 129, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 16,
    padding: 14,
  },
  aiCommentaryText: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
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
  correlationCard: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  correlationHeader: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "bold",
  },
  highlightBullet: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  highlightText: {
    color: "#94a3b8",
    fontSize: 13,
  },
});
