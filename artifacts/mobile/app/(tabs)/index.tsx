import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, RefreshControl } from "react-native";
import { useGetTodayDashboard, useGetMyProfile, useGetTimeline, getGetTimelineQueryKey, getGetTodayDashboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Activity, Flame, Trophy, Moon, Brain, ClipboardList, 
  Sparkles, CheckCircle2, ChevronRight, Zap, Volume2, VolumeX, ShieldCheck 
} from "lucide-react-native";
// Haptics: native only, lazy-loaded
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
import { MultiHealthRings } from "@/components/HealthRings";
import { GlassCard } from "@/components/GlassCard";
import { speakText, stopSpeaking } from "@/services/voice";
import { syncHealthData, getLastSyncStatus, HealthSyncStatus } from "@/services/health";

export default function DashboardScreen() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [isSpeakingBriefing, setIsSpeakingBriefing] = useState(false);
  
  // Health sync states
  const [syncStatus, setSyncStatus] = useState<HealthSyncStatus>({
    lastSyncedAt: null,
    status: "idle",
    syncedMetrics: []
  });

  const { data: profile } = useGetMyProfile();
  const { data: dashboard, refetch } = useGetTodayDashboard();
  const { data: timelineEvents, refetch: refetchTimeline } = useGetTimeline();

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
    await refetch();
    await refetchTimeline();
    setRefreshing(false);
  };

  const handleSyncHealth = async () => {
    try {
      triggerHaptic("success");
    } catch {}
    setSyncStatus(prev => ({ ...prev, status: "syncing" }));
    const success = await syncHealthData();
    if (success) {
      const status = await getLastSyncStatus();
      setSyncStatus(status);
      await refetch();
      await refetchTimeline();
    } else {
      setSyncStatus(prev => ({ ...prev, status: "error" }));
    }
  };

  const stepsCount = dashboard?.steps || 0;
  const stepsTarget = profile?.dailyStepsTarget || 9000;
  const stepsPercent = Math.min(100, Math.round((stepsCount / stepsTarget) * 100));

  const caloriesConsumed = dashboard?.caloriesConsumed || 0;
  const caloriesTarget = profile?.dailyCalorieTarget || 2100;
  const caloriesPercent = Math.min(100, Math.round((caloriesConsumed / caloriesTarget) * 100));

  const sleepHours = dashboard?.sleepHours || 0;
  const sleepTarget = profile?.dailySleepTargetHours || 8;
  const sleepPercent = Math.min(100, Math.round((sleepHours / sleepTarget) * 100));

  const activeMinutes = dashboard?.activeMinutes || 0;
  const activeTarget = 30;
  const activePercent = Math.min(100, Math.round((activeMinutes / activeTarget) * 100));

  const readinessScore = dashboard?.overallScore ?? 84;

  const briefingText = stepsCount > 5000 
    ? "Excellent movement early today! You've already completed over half of your steps goal. Maintain this momentum into the afternoon."
    : "Welcome to your day. Let's aim to hit a brisk walk before lunch to kickstart your metabolic rate and stay on track for your active steps targets.";

  const toggleBriefingVoice = () => {
    if (isSpeakingBriefing) {
      stopSpeaking();
      setIsSpeakingBriefing(false);
    } else {
      setIsSpeakingBriefing(true);
      speakText(briefingText, () => setIsSpeakingBriefing(false));
    }
  };

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Lumen Health OS</Text>
          <Text style={styles.title}>Dashboard</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile?.name ? profile.name[0] : "U"}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#10b981" />}
      >
        {/* Native Health Sync row */}
        <View style={styles.syncRow}>
          <View style={styles.syncInfo}>
            <ShieldCheck size={14} color="#10b981" />
            <Text style={styles.syncText}>
              {syncStatus.lastSyncedAt 
                ? `Wearables Synced • ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                : "Wearables Disconnected"
              }
            </Text>
          </View>
          <Pressable style={styles.syncBtn} onPress={handleSyncHealth} disabled={syncStatus.status === "syncing"}>
            <Text style={styles.syncBtnText}>
              {syncStatus.status === "syncing" ? "Syncing..." : "Sync Now"}
            </Text>
          </Pressable>
        </View>

        {/* Daily Bio-briefing */}
        <GlassCard style={styles.briefingCard}>
          <View style={styles.briefingHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Sparkles size={16} color="#10b981" />
              <Text style={styles.briefingTitle}>AI Morning Briefing</Text>
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

        {/* Apple Fitness rings & Readiness Score */}
        <View style={styles.visualSummary}>
          <View style={styles.ringsContainer}>
            <MultiHealthRings 
              stepsPercent={stepsPercent} 
              sleepPercent={sleepPercent} 
              activePercent={activePercent} 
            />
          </View>
          
          <View style={styles.readinessContainer}>
            <View style={styles.readinessHeader}>
              <Activity size={14} color="#10b981" />
              <Text style={styles.readinessTitle}>Recovery Index</Text>
            </View>
            <Text style={styles.readinessVal}>{readinessScore}</Text>
            <Text style={styles.readinessDesc}>
              HRV is optimal. Rest days suggested: 0. Exertion budget: High.
            </Text>
          </View>
        </View>

        {/* Targets Progress Bars */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Daily Bio-Targets</Text>
        </View>

        <View style={styles.targetGrid}>
          {/* Steps */}
          <View style={styles.targetCard}>
            <View style={styles.cardHeader}>
              <Trophy size={18} color="#10b981" />
              <Text style={styles.cardPercentage}>{stepsPercent}%</Text>
            </View>
            <Text style={styles.cardVal}>{stepsCount.toLocaleString()}</Text>
            <Text style={styles.cardSub}>Steps ({stepsTarget})</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${stepsPercent}%`, backgroundColor: "#10b981" }]} />
            </View>
          </View>

          {/* Calories */}
          <View style={styles.targetCard}>
            <View style={styles.cardHeader}>
              <Flame size={18} color="#f97316" />
              <Text style={styles.cardPercentage}>{caloriesPercent}%</Text>
            </View>
            <Text style={styles.cardVal}>{caloriesConsumed} kcal</Text>
            <Text style={styles.cardSub}>Nutrition ({caloriesTarget})</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${caloriesPercent}%`, backgroundColor: "#f97316" }]} />
            </View>
          </View>

          {/* Sleep */}
          <View style={styles.targetCard}>
            <View style={styles.cardHeader}>
              <Moon size={18} color="#818cf8" />
              <Text style={styles.cardPercentage}>{sleepPercent}%</Text>
            </View>
            <Text style={styles.cardVal}>{sleepHours} hrs</Text>
            <Text style={styles.cardSub}>Rest ({sleepTarget}h)</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${sleepPercent}%`, backgroundColor: "#818cf8" }]} />
            </View>
          </View>

          {/* Active Minutes */}
          <View style={styles.targetCard}>
            <View style={styles.cardHeader}>
              <Zap size={18} color="#f59e0b" />
              <Text style={styles.cardPercentage}>{activePercent}%</Text>
            </View>
            <Text style={styles.cardVal}>{activeMinutes} min</Text>
            <Text style={styles.cardSub}>Active Minutes</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${activePercent}%`, backgroundColor: "#f59e0b" }]} />
            </View>
          </View>
        </View>

        {/* Dynamic Health Timeline */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Timeline Event Log</Text>
        </View>

        <View style={styles.timelineContainer}>
          {timelineEvents && timelineEvents.length > 0 ? (
            timelineEvents.map((evt: any, idx: number) => (
              <View key={idx} style={styles.timelineRow}>
                <View style={styles.timelineMarker}>
                  <View style={styles.timelineDot} />
                  {idx < timelineEvents.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineCard}>
                  <Text style={styles.timelineTime}>{evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "12:00 PM"}</Text>
                  <Text style={styles.timelineEventText}>{evt.title} — {evt.description}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyTimeline}>
              <CheckCircle2 size={36} color="#475569" />
              <Text style={styles.emptyTimelineText}>Timeline is empty today. Start logging activities to update your timeline.</Text>
            </View>
          )}
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 25,
    marginBottom: 10,
  },
  greeting: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  title: {
    color: "#f8fafc",
    fontSize: 26,
    fontWeight: "900",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#050b08",
    fontSize: 16,
    fontWeight: "bold",
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingBottom: 40,
    gap: 20,
  },
  syncRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 44,
  },
  syncInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  syncText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "500",
  },
  syncBtn: {
    backgroundColor: "#10b981",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  syncBtnText: {
    color: "#050b08",
    fontSize: 11,
    fontWeight: "bold",
  },
  briefingCard: {
    gap: 8,
  },
  briefingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  briefingTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "bold",
  },
  briefingBody: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 19,
  },
  voiceBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  visualSummary: {
    flexDirection: "row",
    gap: 20,
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
  },
  ringsContainer: {
    width: 110,
    height: 110,
  },
  readinessContainer: {
    flex: 1,
    gap: 4,
  },
  readinessHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  readinessTitle: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  readinessVal: {
    color: "#f8fafc",
    fontSize: 32,
    fontWeight: "900",
  },
  readinessDesc: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 15,
  },
  sectionHeader: {
    marginTop: 5,
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "bold",
  },
  targetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 15,
  },
  targetCard: {
    width: "47%",
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 16,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardPercentage: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "bold",
  },
  cardVal: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
  },
  cardSub: {
    color: "#64748b",
    fontSize: 11,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#1e293b",
    borderRadius: 2,
    marginTop: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  timelineContainer: {
    gap: 15,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 15,
  },
  timelineMarker: {
    alignItems: "center",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10b981",
    marginTop: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#1e293b",
    marginTop: 4,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  timelineTime: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "bold",
  },
  timelineEventText: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 18,
  },
  emptyTimeline: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    gap: 10,
  },
  emptyTimelineText: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
