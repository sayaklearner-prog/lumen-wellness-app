import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput } from "react-native";
import { useListWorkouts, useCreateWorkout, useDeleteWorkouts, useGetWorkoutReadiness, useGetWorkoutInsights, getListWorkoutsQueryKey, getGetWorkoutReadinessQueryKey, getGetWorkoutInsightsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Activity, Heart, Timer, Zap, Trash2, Plus, 
  Sparkles, CheckCircle2, Trophy 
} from "lucide-react-native";
import { queueOfflineLog } from "@/services/db";

export default function ActivityScreen() {
  const qc = useQueryClient();
  const [showLogForm, setShowLogForm] = useState(false);

  // Form state
  const [activityType, setActivityType] = useState("Running");
  const [duration, setDuration] = useState("30");
  const [calories, setCalories] = useState("250");
  const [distance, setDistance] = useState("5.0");
  const [avgHeartRate, setAvgHeartRate] = useState("140");

  const { data: workouts } = useListWorkouts();
  const { data: readiness } = useGetWorkoutReadiness();
  const { data: insights } = useGetWorkoutInsights();
  
  const createWorkoutMutation = useCreateWorkout();
  const deleteWorkoutMutation = useDeleteWorkouts();

  const handleLogWorkout = async () => {
    if (!activityType.trim() || !duration.trim()) return;

    try {
      await createWorkoutMutation.mutateAsync({
        data: {
          type: activityType,
          durationMinutes: parseInt(duration) || 30,
          caloriesBurned: parseInt(calories) || 250,
          distanceKm: parseFloat(distance) || 0.0,
          avgHeartRate: parseInt(avgHeartRate) || 120,
          intensity: "moderate",
          notes: "Logged via Lumen Mobile client"
        }
      });
      // Invalidate queries to refresh lists
      qc.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetWorkoutReadinessQueryKey() });
      qc.invalidateQueries({ queryKey: getGetWorkoutInsightsQueryKey() });
      setShowLogForm(false);
    } catch {
      await queueOfflineLog("workout", "/api/workouts", {
        type: activityType,
        durationMinutes: parseInt(duration) || 30,
        caloriesBurned: parseInt(calories) || 250,
        distanceKm: parseFloat(distance) || 0.0,
        avgHeartRate: parseInt(avgHeartRate) || 120,
        intensity: "moderate",
        notes: "Logged offline via Sync Queue"
      });
      alert("Device offline. Workout queued to local database.");
      setShowLogForm(false);
    }
  };

  const handleDeleteWorkout = async (id: string) => {
    try {
      await deleteWorkoutMutation.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetWorkoutReadinessQueryKey() });
      qc.invalidateQueries({ queryKey: getGetWorkoutInsightsQueryKey() });
    } catch {
      alert("Failed to delete workout");
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerSub}>Fitness Hub</Text>
        <Text style={styles.headerTitle}>Activity & Load</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Readiness Dial Card */}
        <View style={styles.readinessCard}>
          <View style={styles.readinessHeader}>
            <Sparkles size={16} color="#10b981" />
            <Text style={styles.readinessTitle}>Weekly Readiness Dials</Text>
          </View>
          <View style={styles.dialRow}>
            <View style={styles.dialContainer}>
              <Text style={styles.dialVal}>{readiness?.readinessScore ?? 84}</Text>
              <Text style={styles.dialSub}>Strain</Text>
            </View>
            <View style={styles.readinessRight}>
              <Text style={styles.readinessHeading}>Ready for Exertion</Text>
              <Text style={styles.readinessDesc}>
                Your heart rate variance of 68ms and deep sleep cycle of 2.1h are optimal.
              </Text>
            </View>
          </View>
        </View>

        {/* AI Fitness Insights */}
        {insights && insights.insights && (
          <View style={styles.insightsCard}>
            <Text style={styles.insightsHeader}>AI Biometric Insights</Text>
            {insights.insights.map((ins: any, idx: number) => (
              <View key={idx} style={styles.insightRow}>
                <View style={styles.insightDot} />
                <Text style={styles.insightText}>{ins}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick Log Form / Button */}
        {showLogForm ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Record Workout</Text>
            <View style={styles.formGrid}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Type</Text>
                <TextInput style={styles.input} value={activityType} onChangeText={setActivityType} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Duration (min)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={duration} onChangeText={setDuration} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Calories</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={calories} onChangeText={setCalories} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Distance (km)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={distance} onChangeText={setDistance} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Heart Rate (bpm)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={avgHeartRate} onChangeText={setAvgHeartRate} />
              </View>
            </View>
            <View style={styles.formActionRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowLogForm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleLogWorkout}>
                <Text style={styles.saveBtnText}>Save</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.logBtn} onPress={() => setShowLogForm(true)}>
            <Plus size={16} color="#050b08" style={{ marginRight: 6 }} />
            <Text style={styles.logBtnText}>Log Activity Manually</Text>
          </Pressable>
        )}

        {/* Workout History Timeline list */}
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Workout Log</Text>
        </View>

        <View style={styles.workoutsList}>
          {workouts && workouts.length > 0 ? (
            workouts.map((w: any, idx: number) => (
              <View key={idx} style={styles.workoutRow}>
                <View style={styles.workoutLeft}>
                  <View style={styles.activityIcon}>
                    <Activity size={16} color="#10b981" />
                  </View>
                  <View>
                    <Text style={styles.activityName}>{w.type}</Text>
                    <Text style={styles.activityTime}>{w.durationMinutes} min • {w.caloriesBurned} kcal</Text>
                  </View>
                </View>
                <View style={styles.workoutRight}>
                  {w.avgHeartRate && (
                    <View style={styles.badge}>
                      <Heart size={10} color="#ef4444" style={{ marginRight: 4 }} />
                      <Text style={styles.badgeText}>{w.avgHeartRate} bpm</Text>
                    </View>
                  )}
                  <Pressable onPress={() => handleDeleteWorkout(w.id)}>
                    <Trash2 size={16} color="#64748b" style={{ marginLeft: 10 }} />
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <CheckCircle2 size={36} color="#475569" style={{ marginBottom: 10 }} />
              <Text style={styles.emptyText}>No workouts recorded yet today. Hit the button above to log your exercise.</Text>
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
  },
  readinessCard: {
    backgroundColor: "#081611",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.15)",
    borderRadius: 24,
    padding: 20,
    gap: 15,
    marginBottom: 20,
  },
  readinessHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  readinessTitle: {
    color: "#10b981",
    fontSize: 14,
    fontWeight: "bold",
  },
  dialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  dialContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  dialVal: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "black",
  },
  dialSub: {
    color: "#64748b",
    fontSize: 7,
    textTransform: "uppercase",
  },
  readinessRight: {
    flex: 1,
    gap: 4,
  },
  readinessHeading: {
    color: "#f8fafc",
    fontWeight: "bold",
    fontSize: 15,
  },
  readinessDesc: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 16,
  },
  insightsCard: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 20,
    gap: 12,
    marginBottom: 20,
  },
  insightsHeader: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "bold",
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  insightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
    marginTop: 6,
  },
  insightText: {
    flex: 1,
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 20,
    gap: 15,
    marginBottom: 20,
  },
  formTitle: {
    color: "#f8fafc",
    fontWeight: "bold",
    fontSize: 16,
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  inputGroup: {
    width: "47%",
    gap: 6,
  },
  label: {
    color: "#64748b",
    fontSize: 11,
  },
  input: {
    backgroundColor: "#050b08",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 10,
    height: 40,
    color: "#f8fafc",
    paddingHorizontal: 12,
    fontSize: 13,
  },
  formActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 5,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "bold",
  },
  saveBtn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 20,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#050b08",
    fontSize: 13,
    fontWeight: "bold",
  },
  logBtn: {
    height: 48,
    backgroundColor: "#10b981",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 25,
  },
  logBtnText: {
    color: "#050b08",
    fontSize: 14,
    fontWeight: "bold",
  },
  historyHeader: {
    marginBottom: 15,
  },
  historyTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "bold",
  },
  workoutsList: {
    gap: 10,
  },
  workoutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 16,
  },
  workoutLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  activityName: {
    color: "#f8fafc",
    fontWeight: "bold",
    fontSize: 14,
  },
  activityTime: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  workoutRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: 12,
    paddingHorizontal: 8,
    height: 24,
  },
  badgeText: {
    color: "#f87171",
    fontSize: 10,
    fontWeight: "bold",
  },
  emptyCard: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
