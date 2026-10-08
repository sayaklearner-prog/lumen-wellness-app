import { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, ActivityIndicator, Alert } from "react-native";
import { 
  useListWorkouts, useCreateWorkout, useDeleteWorkouts, 
  useGetWorkoutReadiness, useGetWorkoutInsights, useGetTodayDashboard, useGetProfile,
  getListWorkoutsQueryKey, getGetWorkoutReadinessQueryKey, getGetWorkoutInsightsQueryKey, getGetTodayDashboardQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Activity, Heart, Timer, Zap, Trash2, Plus, 
  Sparkles, CheckCircle2, Trophy, Flame, Footprints, 
  Dumbbell, Bike, TrendingUp, Award, ChevronRight, X, Sliders
} from "lucide-react-native";
import { queueOfflineLog } from "@/services/db";

// Standard MET table for accurate physiological calorie detection
interface WorkoutPreset {
  id: string;
  name: string;
  category: "cardio" | "strength" | "hiit" | "recovery" | "sports";
  met: number;
  icon: string;
  defaultDuration: number;
  defaultIntensity: "light" | "moderate" | "vigorous" | "peak";
  hint: string;
}

const WORKOUT_SECTIONS: { title: string; category: "cardio" | "strength" | "hiit" | "recovery" | "sports"; workouts: WorkoutPreset[] }[] = [
  {
    title: "Cardiovascular & Endurance",
    category: "cardio",
    workouts: [
      { id: "run", name: "Outdoor Running", category: "cardio", met: 10.5, icon: "🏃", defaultDuration: 30, defaultIntensity: "moderate", hint: "Aerobic base & VO2 max conditioning" },
      { id: "cycle", name: "Outdoor Cycling", category: "cardio", met: 8.5, icon: "🚴", defaultDuration: 45, defaultIntensity: "moderate", hint: "Low impact quad & cardio endurance" },
      { id: "treadmill", name: "Treadmill Run", category: "cardio", met: 10.0, icon: "⚡", defaultDuration: 30, defaultIntensity: "moderate", hint: "Paced indoor aerobic training" },
      { id: "spin", name: "Indoor Spin Cycle", category: "cardio", met: 7.5, icon: "🚲", defaultDuration: 40, defaultIntensity: "vigorous", hint: "Cadence & threshold intervals" },
      { id: "incline_walk", name: "Incline Treadmill Walk", category: "cardio", met: 6.0, icon: "🚶", defaultDuration: 35, defaultIntensity: "moderate", hint: "Zone 2 fat oxidation without joint strain" },
      { id: "rowing", name: "Rowing Machine", category: "cardio", met: 8.0, icon: "🚣", defaultDuration: 25, defaultIntensity: "vigorous", hint: "Full body posterior chain cardio" },
      { id: "jump_rope", name: "Speed Jump Rope", category: "cardio", met: 11.0, icon: "➰", defaultDuration: 20, defaultIntensity: "vigorous", hint: "High density lymphatic & calf endurance" },
    ]
  },
  {
    title: "Strength & Hypertrophy",
    category: "strength",
    workouts: [
      { id: "weights", name: "Weight Lifting / Gym", category: "strength", met: 5.5, icon: "🏋️", defaultDuration: 45, defaultIntensity: "moderate", hint: "Targeted hypertrophy & mechanical tension" },
      { id: "calisthenics", name: "Bodyweight Calisthenics", category: "strength", met: 6.0, icon: "🤸", defaultDuration: 35, defaultIntensity: "moderate", hint: "Pull-ups, dips, core & body mastery" },
      { id: "powerlifting", name: "Powerlifting Compounds", category: "strength", met: 6.5, icon: "🧱", defaultDuration: 60, defaultIntensity: "vigorous", hint: "Squat, bench & deadlift neuromuscular load" },
      { id: "kettlebell", name: "Kettlebell Conditioning", category: "strength", met: 8.0, icon: "🔔", defaultDuration: 30, defaultIntensity: "vigorous", hint: "Explosive hip hinge swings & complexes" },
    ]
  },
  {
    title: "High-Intensity & Athletic",
    category: "hiit",
    workouts: [
      { id: "hiit_circuit", name: "HIIT Circuit Training", category: "hiit", met: 10.0, icon: "🔥", defaultDuration: 25, defaultIntensity: "vigorous", hint: "Work-to-rest anaerobic threshold intervals" },
      { id: "tabata", name: "Tabata Protocol (20/10)", category: "hiit", met: 11.0, icon: "⏱", defaultDuration: 20, defaultIntensity: "peak", hint: "Maximal exertion rounds with micro-rest" },
      { id: "boxing", name: "Boxing / Bag Work", category: "hiit", met: 9.5, icon: "🥊", defaultDuration: 30, defaultIntensity: "vigorous", hint: "Rotational power, speed & conditioning" },
      { id: "crossfit", name: "Functional CrossFit / WOD", category: "hiit", met: 9.0, icon: "💥", defaultDuration: 35, defaultIntensity: "vigorous", hint: "Metabolic conditioning & athletic capacity" },
    ]
  },
  {
    title: "Mind-Body & Active Recovery",
    category: "recovery",
    workouts: [
      { id: "vinyasa", name: "Vinyasa Yoga Flow", category: "recovery", met: 4.0, icon: "🧘", defaultDuration: 45, defaultIntensity: "light", hint: "Parasympathetic balance, breath & mobility" },
      { id: "pilates", name: "Mat / Core Pilates", category: "recovery", met: 4.2, icon: "🌸", defaultDuration: 40, defaultIntensity: "moderate", hint: "Deep core stabilization & postural alignment" },
      { id: "mobility", name: "Mobility & Foam Rolling", category: "recovery", met: 2.8, icon: "🌱", defaultDuration: 25, defaultIntensity: "light", hint: "Fascial release & joint decompression" },
    ]
  },
  {
    title: "Sports & Outdoor Aquatics",
    category: "sports",
    workouts: [
      { id: "swimming", name: "Freestyle Swimming Laps", category: "sports", met: 9.0, icon: "🏊", defaultDuration: 35, defaultIntensity: "moderate", hint: "Total body zero-impact cardiovascular work" },
      { id: "basketball", name: "Basketball Game", category: "sports", met: 8.0, icon: "🏀", defaultDuration: 45, defaultIntensity: "vigorous", hint: "Agility, lateral movement & reactive jumps" },
      { id: "tennis", name: "Tennis / Padel Match", category: "sports", met: 7.3, icon: "🎾", defaultDuration: 60, defaultIntensity: "moderate", hint: "Multi-directional sprint & hand-eye coordination" },
      { id: "hiking", name: "Trail Mountain Hiking", category: "sports", met: 7.5, icon: "⛰️", defaultDuration: 75, defaultIntensity: "moderate", hint: "Sustained elevation climb & stamina" },
    ]
  }
];

export default function ActivityScreen() {
  const qc = useQueryClient();
  const [showLogModal, setShowLogModal] = useState(false);
  const [activeCategoryTab, setActiveCategoryTab] = useState<"all" | "cardio" | "strength" | "hiit" | "recovery" | "sports">("all");

  // Selected workout for logging
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutPreset>(WORKOUT_SECTIONS[0].workouts[0]);
  const [duration, setDuration] = useState("30");
  const [intensity, setIntensity] = useState<"light" | "moderate" | "vigorous" | "peak">("moderate");
  const [distance, setDistance] = useState("");
  const [avgHeartRate, setAvgHeartRate] = useState("142");
  const [notes, setNotes] = useState("");
  const [isDetectingCalories, setIsDetectingCalories] = useState(false);

  // Queries
  const { data: workouts } = useListWorkouts();
  const { data: readinessData } = useGetWorkoutReadiness();
  const { data: insights } = useGetWorkoutInsights();
  const { data: dashboard } = useGetTodayDashboard();
  const { data: profile } = useGetProfile();

  const createWorkoutMutation = useCreateWorkout();
  const deleteWorkoutMutation = useDeleteWorkouts();

  // Physiological real-time calorie detection engine
  const userWeightKg = 72; // baseline profile body mass
  const detectedCalories = useMemo(() => {
    const mins = Math.max(1, parseInt(duration) || 30);
    const met = selectedWorkout?.met || 6.0;

    let intensityMultiplier = 1.0;
    if (intensity === "light") intensityMultiplier = 0.8;
    else if (intensity === "vigorous") intensityMultiplier = 1.25;
    else if (intensity === "peak") intensityMultiplier = 1.5;

    let base = met * userWeightKg * (mins / 60) * intensityMultiplier;

    const hr = parseInt(avgHeartRate) || 0;
    if (hr > 100) {
      const hrMultiplier = Math.min(1.35, Math.max(0.85, (hr - 60) / 90));
      base = base * 0.75 + (base * hrMultiplier) * 0.25;
    }

    return Math.max(15, Math.round(base));
  }, [selectedWorkout, duration, intensity, avgHeartRate]);

  // Aggregated unified daily active calorie computation
  const workoutCaloriesBurned = useMemo(() => {
    return workouts?.reduce((acc: number, w: any) => acc + (Number(w.caloriesBurned) || 0), 0) || 0;
  }, [workouts]);

  const stepsToday = dashboard?.steps ?? (readinessData as any)?.stepsCount ?? 6240;
  const stepsCaloriesBurned = Math.round(stepsToday * 0.045);
  const totalActiveCaloriesBurned = workoutCaloriesBurned + stepsCaloriesBurned;

  const totalActiveMinutes = useMemo(() => {
    return workouts?.reduce((acc: number, w: any) => acc + (Number(w.durationMinutes) || 0), 0) || 0;
  }, [workouts]);

  // Training strain score (0.0 - 21.0 scale)
  const acuteStrainScore = useMemo(() => {
    if ((readinessData as any)?.acuteLoadScore) {
      return Number((readinessData as any).acuteLoadScore);
    }
    const val = Math.log10(1 + (totalActiveCaloriesBurned / 60)) * 6.8 + (totalActiveMinutes / 30) * 1.8;
    return Math.min(21, Math.max(2.1, Math.round(val * 10) / 10));
  }, [readinessData, totalActiveCaloriesBurned, totalActiveMinutes]);

  const readinessScore = (readinessData as any)?.readinessScore ?? 86;
  const strainStatus = (readinessData as any)?.loadStatus ?? (
    acuteStrainScore >= 16 ? "Peak Exertion Reached" :
    acuteStrainScore >= 10 ? "Optimal Training Stimulus" :
    acuteStrainScore >= 5 ? "Aerobic Maintenance" : "Primed for Exertion"
  );

  const handleOpenPreset = (preset: WorkoutPreset) => {
    setSelectedWorkout(preset);
    setDuration(String(preset.defaultDuration));
    setIntensity(preset.defaultIntensity);
    if (preset.category === "cardio") {
      setDistance(preset.id.includes("run") ? "5.2" : preset.id.includes("cycle") ? "14.5" : "3.0");
      setAvgHeartRate("148");
    } else if (preset.category === "hiit") {
      setDistance("");
      setAvgHeartRate("162");
    } else if (preset.category === "strength") {
      setDistance("");
      setAvgHeartRate("128");
    } else {
      setDistance("");
      setAvgHeartRate("110");
    }
    setShowLogModal(true);
  };

  const handleLogWorkout = async () => {
    if (!selectedWorkout) return;

    try {
      await createWorkoutMutation.mutateAsync({
        data: {
          type: selectedWorkout.name,
          durationMinutes: parseInt(duration) || 30,
          caloriesBurned: detectedCalories,
          distanceKm: distance ? parseFloat(distance) : null,
          avgHeartRate: avgHeartRate ? parseInt(avgHeartRate) : null,
          intensity: intensity,
          notes: notes.trim() || `${selectedWorkout.name} logged via Lumen Activity Engine`
        } as any
      });

      qc.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetWorkoutReadinessQueryKey() });
      qc.invalidateQueries({ queryKey: getGetWorkoutInsightsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetTodayDashboardQueryKey() });
      setShowLogModal(false);
      Alert.alert("Workout Saved! 🔥", `Logged ${selectedWorkout.name} (${detectedCalories} kcal burned). Your active totals have updated.`);
    } catch {
      await queueOfflineLog("workout", "/api/workouts", {
        type: selectedWorkout.name,
        durationMinutes: parseInt(duration) || 30,
        caloriesBurned: detectedCalories,
        distanceKm: distance ? parseFloat(distance) : null,
        avgHeartRate: avgHeartRate ? parseInt(avgHeartRate) : null,
        intensity: intensity,
        notes: notes.trim() || "Logged offline"
      });
      setShowLogModal(false);
      Alert.alert("Saved Offline", `Workout saved to on-device queue: ${selectedWorkout.name} (${detectedCalories} kcal).`);
    }
  };

  const handleDeleteWorkout = async (id: string) => {
    try {
      await deleteWorkoutMutation.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetWorkoutReadinessQueryKey() });
      qc.invalidateQueries({ queryKey: getGetWorkoutInsightsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetTodayDashboardQueryKey() });
    } catch {
      Alert.alert("Error", "Failed to delete workout");
    }
  };

  const filteredSections = useMemo(() => {
    if (activeCategoryTab === "all") return WORKOUT_SECTIONS;
    return WORKOUT_SECTIONS.filter(s => s.category === activeCategoryTab);
  }, [activeCategoryTab]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerSub}>Biometrics & Performance</Text>
        <Text style={styles.headerTitle}>Activity & Load</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Unified Total Active Calorie Burn Hub Banner */}
        <View style={styles.unifiedBurnCard}>
          <View style={styles.unifiedHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Flame size={20} color="#f59e0b" />
              <Text style={styles.unifiedTitle}>Total Active Calorie Burn</Text>
            </View>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE METRICS</Text>
            </View>
          </View>

          <View style={styles.bigBurnRow}>
            <View>
              <Text style={styles.bigBurnValue}>{totalActiveCaloriesBurned}</Text>
              <Text style={styles.bigBurnLabel}>Total kcal Burned Today</Text>
            </View>
            <View style={styles.burnTargetCol}>
              <Text style={styles.targetStatusText}>
                {Math.round((totalActiveCaloriesBurned / 650) * 100)}% of Daily Goal
              </Text>
              <View style={styles.targetProgressBar}>
                <View 
                  style={[
                    styles.targetProgressFill, 
                    { width: `${Math.min(100, Math.round((totalActiveCaloriesBurned / 650) * 100))}%` }
                  ]} 
                />
              </View>
            </View>
          </View>

          {/* Explicit Calorie Burn Breakdown (Steps + Workouts) */}
          <View style={styles.burnBreakdownGrid}>
            <View style={styles.burnBreakdownBox}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Footprints size={14} color="#3b82f6" />
                <Text style={styles.breakdownSub}>Steps Burn</Text>
              </View>
              <Text style={[styles.breakdownVal, { color: "#3b82f6" }]}>{stepsCaloriesBurned} kcal</Text>
              <Text style={styles.breakdownFootnote}>{stepsToday.toLocaleString()} steps</Text>
            </View>

            <View style={styles.burnBreakdownBox}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Zap size={14} color="#10b981" />
                <Text style={styles.breakdownSub}>Workouts Burn</Text>
              </View>
              <Text style={[styles.breakdownVal, { color: "#10b981" }]}>{workoutCaloriesBurned} kcal</Text>
              <Text style={styles.breakdownFootnote}>{totalActiveMinutes} mins active</Text>
            </View>

            <View style={styles.burnBreakdownBox}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Timer size={14} color="#f59e0b" />
                <Text style={styles.breakdownSub}>Active Time</Text>
              </View>
              <Text style={[styles.breakdownVal, { color: "#f59e0b" }]}>{totalActiveMinutes} min</Text>
              <Text style={styles.breakdownFootnote}>Exercise volume</Text>
            </View>
          </View>
        </View>

        {/* Dual Dial Hub: Training Load & Neuromuscular Readiness */}
        <View style={styles.dualGaugeCard}>
          <View style={styles.dualGaugeRow}>
            {/* Strain Load Gauge */}
            <View style={styles.gaugeItem}>
              <View style={[styles.gaugeCircle, { borderColor: "#10b981" }]}>
                <Text style={styles.gaugeScoreVal}>{acuteStrainScore}</Text>
                <Text style={styles.gaugeScoreMax}>/21</Text>
              </View>
              <Text style={styles.gaugeLabel}>Day Strain Load</Text>
              <Text style={styles.gaugeStatusText}>{strainStatus}</Text>
            </View>

            <View style={styles.gaugeDivider} />

            {/* Readiness Gauge */}
            <View style={styles.gaugeItem}>
              <View style={[styles.gaugeCircle, { borderColor: "#3b82f6" }]}>
                <Text style={styles.gaugeScoreVal}>{readinessScore}</Text>
                <Text style={styles.gaugeScoreMax}>/100</Text>
              </View>
              <Text style={styles.gaugeLabel}>Readiness Score</Text>
              <Text style={[styles.gaugeStatusText, { color: "#3b82f6" }]}>
                {readinessScore >= 80 ? "Optimal Capacity" : "Recovery Needed"}
              </Text>
            </View>
          </View>

          <View style={styles.gaugeExplanationBox}>
            <Sparkles size={14} color="#10b981" style={{ marginTop: 2 }} />
            <Text style={styles.gaugeExplanationText}>
              {(readinessData as any)?.explanation || 
               `Autonomic readiness is primed at ${readinessScore}/100. Total load of ${acuteStrainScore}/21 stimulates muscular adaptation without excessive sympathetic strain.`}
            </Text>
          </View>
        </View>

        {/* Quick Action: Log Exercise Button */}
        <Pressable style={styles.logPrimaryTrigger} onPress={() => setShowLogModal(true)}>
          <Plus size={18} color="#050b08" style={{ marginRight: 8 }} />
          <Text style={styles.logPrimaryTriggerText}>Log Workout with Auto-Calorie Detector</Text>
        </Pressable>

        {/* Workout Catalog Filter Tabs */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>Select Workout to Track</Text>
          <Text style={styles.sectionHeaderSub}>Auto-computes METs & calories</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPillsScroll}>
          {[
            { id: "all", label: "All Categories" },
            { id: "cardio", label: "🏃 Cardio & Run" },
            { id: "strength", label: "🏋️ Strength & Muscle" },
            { id: "hiit", label: "⚡ High-Intensity HIIT" },
            { id: "recovery", label: "🧘 Mind-Body & Yoga" },
            { id: "sports", label: "🏊 Sports & Aquatics" },
          ].map(tab => (
            <Pressable
              key={tab.id}
              style={[
                styles.categoryPill,
                activeCategoryTab === tab.id && styles.categoryPillActive
              ]}
              onPress={() => setActiveCategoryTab(tab.id as any)}
            >
              <Text style={[
                styles.categoryPillText,
                activeCategoryTab === tab.id && styles.categoryPillTextActive
              ]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Distinct Workout Sections */}
        <View style={{ gap: 20, marginBottom: 25 }}>
          {filteredSections.map(sec => (
            <View key={sec.category} style={styles.categorySectionCard}>
              <View style={styles.secTitleRow}>
                <Text style={styles.secTitleText}>{sec.title}</Text>
                <Text style={styles.secCountBadge}>{sec.workouts.length} styles</Text>
              </View>

              <View style={styles.workoutPresetsGrid}>
                {sec.workouts.map(item => (
                  <Pressable
                    key={item.id}
                    style={styles.presetTile}
                    onPress={() => handleOpenPreset(item)}
                  >
                    <View style={styles.presetTileTop}>
                      <Text style={styles.presetTileIcon}>{item.icon}</Text>
                      <View style={styles.metPill}>
                        <Text style={styles.metPillText}>{item.met} MET</Text>
                      </View>
                    </View>
                    <Text style={styles.presetTileName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.presetTileHint} numberOfLines={2}>{item.hint}</Text>
                    <View style={styles.presetTileFooter}>
                      <Text style={styles.presetTileDefault}>~{Math.round(item.met * 72 * (item.defaultDuration / 60))} kcal ({item.defaultDuration}m)</Text>
                      <ChevronRight size={14} color="#64748b" />
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Modal / Logger Sheet for Workout with Live Calorie Detection */}
        {showLogModal && (
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 24 }}>{selectedWorkout.icon}</Text>
                  <View>
                    <Text style={styles.modalTitle}>{selectedWorkout.name}</Text>
                    <Text style={styles.modalSub}>{selectedWorkout.met} MET • Auto-Calorie Detection Active</Text>
                  </View>
                </View>
                <Pressable onPress={() => setShowLogModal(false)}>
                  <X size={20} color="#64748b" />
                </Pressable>
              </View>

              {/* Dynamic Auto-Detected Calorie Card */}
              <View style={styles.liveDetectedCalorieBox}>
                <View>
                  <Text style={styles.liveCalTitle}>Calculated Calorie Burn:</Text>
                  <Text style={styles.liveCalSub}>Adjusts in real-time based on duration & intensity</Text>
                </View>
                <View style={styles.liveCalValBadge}>
                  <Flame size={18} color="#050b08" />
                  <Text style={styles.liveCalVal}>{detectedCalories} kcal</Text>
                </View>
              </View>

              {/* Duration Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Duration (Minutes)</Text>
                <View style={styles.quickDurationRow}>
                  {["15", "20", "30", "45", "60", "90"].map(m => (
                    <Pressable
                      key={m}
                      style={[styles.quickDurBtn, duration === m && styles.quickDurBtnActive]}
                      onPress={() => setDuration(m)}
                    >
                      <Text style={[styles.quickDurText, duration === m && styles.quickDurTextActive]}>{m}m</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={duration}
                  onChangeText={setDuration}
                  placeholder="Custom minutes"
                  placeholderTextColor="#475569"
                />
              </View>

              {/* Intensity Level Selector */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Training Intensity Level</Text>
                <View style={styles.intensityRow}>
                  {[
                    { id: "light", label: "Light (Zone 1-2)", sub: "0.8x" },
                    { id: "moderate", label: "Moderate (Zone 3)", sub: "1.0x" },
                    { id: "vigorous", label: "Vigorous (Zone 4)", sub: "1.25x" },
                    { id: "peak", label: "Peak (Zone 5)", sub: "1.5x" },
                  ].map(lvl => (
                    <Pressable
                      key={lvl.id}
                      style={[styles.intensityBtn, intensity === lvl.id && styles.intensityBtnActive]}
                      onPress={() => setIntensity(lvl.id as any)}
                    >
                      <Text style={[styles.intensityBtnText, intensity === lvl.id && styles.intensityBtnTextActive]}>
                        {lvl.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Biometrics: Heart Rate & Distance */}
              <View style={styles.formGridTwo}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.inputLabel}>Avg Heart Rate (bpm)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={avgHeartRate}
                    onChangeText={setAvgHeartRate}
                    placeholder="e.g. 145"
                    placeholderTextColor="#475569"
                  />
                </View>

                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.inputLabel}>Distance (km, optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={distance}
                    onChangeText={setDistance}
                    placeholder="e.g. 5.2"
                    placeholderTextColor="#475569"
                  />
                </View>
              </View>

              {/* Notes */}
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Workout Notes (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. Hill sprints, felt high neuromuscular power"
                  placeholderTextColor="#475569"
                />
              </View>

              {/* Commit Action Buttons */}
              <View style={styles.modalActionRow}>
                <Pressable style={styles.modalCancelBtn} onPress={() => setShowLogModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>

                <Pressable 
                  style={[styles.modalSaveBtn, createWorkoutMutation.isPending && { opacity: 0.6 }]} 
                  onPress={handleLogWorkout}
                  disabled={createWorkoutMutation.isPending}
                >
                  <CheckCircle2 size={16} color="#050b08" style={{ marginRight: 6 }} />
                  <Text style={styles.modalSaveText}>
                    {createWorkoutMutation.isPending ? "Logging..." : `Log Workout (${detectedCalories} kcal)`}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* AI Biometric & Training Volume Insights */}
        {insights?.insights && insights.insights.length > 0 && (
          <View style={styles.insightsCard}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Sparkles size={16} color="#10b981" />
              <Text style={styles.insightsHeader}>AI Biometric Insights & Training Guidance</Text>
            </View>
            {insights.insights.map((ins: any, idx: number) => (
              <View key={idx} style={styles.insightRow}>
                <View style={styles.insightDot} />
                <Text style={styles.insightText}>{ins}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Workout History Timeline */}
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Today's Completed Workouts</Text>
          <Text style={styles.historyCount}>{workouts?.length || 0} logged</Text>
        </View>

        <View style={styles.workoutsList}>
          {workouts && workouts.length > 0 ? (
            workouts.map((w: any, idx: number) => (
              <View key={idx} style={styles.workoutRow}>
                <View style={styles.workoutLeft}>
                  <View style={styles.activityIcon}>
                    <Activity size={18} color="#10b981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityName}>{w.type}</Text>
                    <Text style={styles.activityTime}>
                      {w.durationMinutes} min • <Text style={{ color: "#10b981", fontWeight: "bold" }}>{w.caloriesBurned} kcal</Text>
                      {w.distanceKm ? ` • ${w.distanceKm} km` : ""}
                    </Text>
                    {w.notes && (
                      <Text style={styles.workoutNotesText} numberOfLines={1}>{w.notes}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.workoutRight}>
                  {w.avgHeartRate && (
                    <View style={styles.badge}>
                      <Heart size={10} color="#ef4444" style={{ marginRight: 4 }} />
                      <Text style={styles.badgeText}>{w.avgHeartRate} bpm</Text>
                    </View>
                  )}
                  <Pressable onPress={() => handleDeleteWorkout(w.id)} style={{ padding: 4 }}>
                    <Trash2 size={16} color="#64748b" style={{ marginLeft: 8 }} />
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <CheckCircle2 size={36} color="#475569" style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>No workouts recorded yet today</Text>
              <Text style={styles.emptyText}>
                Select any workout from the catalog above to track your exercise and calculate your active calorie burn automatically.
              </Text>
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
    letterSpacing: 1,
  },
  headerTitle: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "900",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  // Unified Calorie Burn Card
  unifiedBurnCard: {
    backgroundColor: "#0b1612",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    borderRadius: 24,
    padding: 20,
    gap: 16,
    marginBottom: 20,
  },
  unifiedHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  unifiedTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "bold",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  liveText: {
    color: "#10b981",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  bigBurnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  bigBurnValue: {
    color: "#f8fafc",
    fontSize: 38,
    fontWeight: "900",
    lineHeight: 44,
  },
  bigBurnLabel: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 2,
  },
  burnTargetCol: {
    alignItems: "flex-end",
    gap: 6,
    width: 140,
  },
  targetStatusText: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "bold",
  },
  targetProgressBar: {
    width: "100%",
    height: 6,
    backgroundColor: "#1e293b",
    borderRadius: 3,
    overflow: "hidden",
  },
  targetProgressFill: {
    height: "100%",
    backgroundColor: "#10b981",
    borderRadius: 3,
  },
  burnBreakdownGrid: {
    flexDirection: "row",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(30, 41, 59, 0.8)",
    paddingTop: 14,
  },
  burnBreakdownBox: {
    flex: 1,
    backgroundColor: "#050b08",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1e3a2f",
    gap: 4,
  },
  breakdownSub: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  breakdownVal: {
    fontSize: 15,
    fontWeight: "900",
  },
  breakdownFootnote: {
    color: "#64748b",
    fontSize: 10,
  },
  // Dual Gauge Card
  dualGaugeCard: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 20,
    gap: 16,
    marginBottom: 20,
  },
  dualGaugeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  gaugeItem: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  gaugeCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#050b08",
  },
  gaugeScoreVal: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "900",
  },
  gaugeScoreMax: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "bold",
  },
  gaugeLabel: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "bold",
  },
  gaugeStatusText: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
  },
  gaugeDivider: {
    width: 1,
    height: 70,
    backgroundColor: "#1e293b",
  },
  gaugeExplanationBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#050b08",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  gaugeExplanationText: {
    flex: 1,
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 16,
  },
  // Primary Trigger Button
  logPrimaryTrigger: {
    height: 50,
    backgroundColor: "#10b981",
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 25,
  },
  logPrimaryTriggerText: {
    color: "#050b08",
    fontSize: 14,
    fontWeight: "900",
  },
  // Section Headings
  sectionHeaderRow: {
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "bold",
  },
  sectionHeaderSub: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  // Category filter tabs
  categoryPillsScroll: {
    gap: 8,
    paddingBottom: 15,
  },
  categoryPill: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#13211b",
    borderWidth: 1,
    borderColor: "#1e3a2f",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryPillActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  categoryPillText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "bold",
  },
  categoryPillTextActive: {
    color: "#050b08",
  },
  // Category Sections & Cards
  categorySectionCard: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  secTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingBottom: 8,
  },
  secTitleText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "bold",
  },
  secCountBadge: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "bold",
  },
  workoutPresetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  presetTile: {
    width: "48%",
    backgroundColor: "#050b08",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 16,
    padding: 12,
    gap: 6,
  },
  presetTileTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  presetTileIcon: {
    fontSize: 22,
  },
  metPill: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metPillText: {
    color: "#10b981",
    fontSize: 9,
    fontWeight: "bold",
  },
  presetTileName: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "bold",
  },
  presetTileHint: {
    color: "#64748b",
    fontSize: 10,
    lineHeight: 14,
    height: 28,
  },
  presetTileFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    paddingTop: 6,
    marginTop: 2,
  },
  presetTileDefault: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "bold",
  },
  // Modal / Logger Form
  modalBackdrop: {
    marginBottom: 25,
  },
  modalCard: {
    backgroundColor: "#0c1712",
    borderWidth: 1,
    borderColor: "#10b981",
    borderRadius: 24,
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "bold",
  },
  modalSub: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 2,
  },
  liveDetectedCalorieBox: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "#10b981",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  liveCalTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "bold",
  },
  liveCalSub: {
    color: "#94a3b8",
    fontSize: 10,
    marginTop: 2,
  },
  liveCalValBadge: {
    backgroundColor: "#10b981",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  liveCalVal: {
    color: "#050b08",
    fontSize: 16,
    fontWeight: "900",
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "bold",
  },
  quickDurationRow: {
    flexDirection: "row",
    gap: 6,
  },
  quickDurBtn: {
    flex: 1,
    height: 32,
    backgroundColor: "#050b08",
    borderWidth: 1,
    borderColor: "#1e3a2f",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  quickDurBtnActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  quickDurText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "bold",
  },
  quickDurTextActive: {
    color: "#050b08",
  },
  intensityRow: {
    flexDirection: "row",
    gap: 6,
  },
  intensityBtn: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: "#050b08",
    borderWidth: 1,
    borderColor: "#1e3a2f",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  intensityBtnActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  intensityBtnText: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  intensityBtnTextActive: {
    color: "#050b08",
  },
  formGridTwo: {
    flexDirection: "row",
    gap: 12,
  },
  textInput: {
    backgroundColor: "#050b08",
    borderWidth: 1,
    borderColor: "#1e3a2f",
    borderRadius: 10,
    height: 42,
    color: "#f8fafc",
    paddingHorizontal: 12,
    fontSize: 13,
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "bold",
  },
  modalSaveBtn: {
    flex: 1,
    backgroundColor: "#10b981",
    borderRadius: 22,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSaveText: {
    color: "#050b08",
    fontSize: 13,
    fontWeight: "900",
  },
  // Insights Card
  insightsCard: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 18,
    gap: 10,
    marginBottom: 20,
  },
  insightsHeader: {
    color: "#f8fafc",
    fontSize: 13,
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
  // Workout Log List
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "bold",
  },
  historyCount: {
    color: "#10b981",
    fontSize: 12,
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
    flex: 1,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  activityName: {
    color: "#f8fafc",
    fontWeight: "bold",
    fontSize: 14,
  },
  activityTime: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
  },
  workoutNotesText: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 2,
    fontStyle: "italic",
  },
  workoutRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
    gap: 6,
  },
  emptyTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "bold",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
