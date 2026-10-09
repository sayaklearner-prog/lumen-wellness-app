import { useEffect, useState, useMemo, useRef } from "react";
import { 
  View, Text, StyleSheet, ScrollView, Pressable, 
  Platform, TextInput, ActivityIndicator, Alert, Modal 
} from "react-native";
import { 
  useListWorkouts, useCreateWorkout, useDeleteWorkouts, 
  useGetWorkoutReadiness, useGetWorkoutInsights, useGetTodayDashboard, useGetProfile,
  getListWorkoutsQueryKey, getGetWorkoutReadinessQueryKey, getGetWorkoutInsightsQueryKey, getGetTodayDashboardQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Activity, Heart, Timer, Zap, Trash2, Plus, 
  Sparkles, CheckCircle2, Trophy, Flame, Footprints, 
  Dumbbell, Bike, TrendingUp, Award, ChevronRight, X, Sliders,
  Play, Pause, Square, RotateCcw, Compass, Gauge, Shield, Watch
} from "lucide-react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { queueOfflineLog, getWorkouts, saveWorkout, deleteWorkout, WorkoutRecord } from "@/services/db";
import { useSlideMenu } from "@/context/SlideMenuContext";
import { useFitnessWatch } from "@/hooks/useFitnessWatch";
import { 
  WORKOUT_MODE_INFO, 
  WorkoutMode, 
  LiveWatchMetrics 
} from "@/services/fitnessWatchSensor";

// Standard MET table for manual logging catalog
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
    title: "Sports & Outdoor Games",
    category: "sports",
    workouts: [
      { id: "badminton", name: "Badminton / Rackets", category: "sports", met: 7.5, icon: "🏸", defaultDuration: 45, defaultIntensity: "vigorous", hint: "High-speed arm swings, reflex smashes & agility" },
      { id: "basketball", name: "Basketball Game", category: "sports", met: 8.0, icon: "🏀", defaultDuration: 45, defaultIntensity: "vigorous", hint: "Agility, lateral movement & reactive jumps" },
      { id: "tennis", name: "Tennis / Padel Match", category: "sports", met: 7.3, icon: "🎾", defaultDuration: 60, defaultIntensity: "moderate", hint: "Multi-directional sprint & hand-eye coordination" },
      { id: "swimming", name: "Freestyle Swimming Laps", category: "sports", met: 9.0, icon: "🏊", defaultDuration: 35, defaultIntensity: "moderate", hint: "Total body zero-impact cardiovascular work" },
      { id: "hiking", name: "Trail Mountain Hiking", category: "sports", met: 7.5, icon: "⛰️", defaultDuration: 75, defaultIntensity: "moderate", hint: "Sustained elevation climb & stamina" },
    ]
  }
];

export default function ActivityScreen() {
  const qc = useQueryClient();
  const { openLeftMenu, openMenu } = useSlideMenu();

  // Active Main Tab: "watch" (Fitness Watch HUD), "catalog" (Manual Entry & Presets), "strain" (Readiness & Analytics)
  const [activeMainTab, setActiveMainTab] = useState<"watch" | "catalog" | "strain">("watch");

  // Selected watch exercise mode
  const [selectedWatchMode, setSelectedWatchMode] = useState<WorkoutMode>("run");

  // Post-workout summary sheet state
  const [completedWorkoutSummary, setCompletedWorkoutSummary] = useState<LiveWatchMetrics | null>(null);

  // Manual Logger State
  const [showLogModal, setShowLogModal] = useState(false);
  const [activeCategoryTab, setActiveCategoryTab] = useState<"all" | "cardio" | "strength" | "hiit" | "recovery" | "sports">("all");
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutPreset>(WORKOUT_SECTIONS[0].workouts[0]);
  const [duration, setDuration] = useState("30");
  const [intensity, setIntensity] = useState<"light" | "moderate" | "vigorous" | "peak">("moderate");
  const [distance, setDistance] = useState("");
  const [avgHeartRate, setAvgHeartRate] = useState("142");
  const [notes, setNotes] = useState("");
  const [localWorkouts, setLocalWorkouts] = useState<WorkoutRecord[]>([]);

  // Fitness Watch Hook
  const {
    metrics: watchMetrics,
    modeInfo: watchModeInfo,
    startWorkout,
    pauseWorkout,
    resumeWorkout,
    stopAndFinishWorkout,
    toggleSimulation,
    getDailySteps,
  } = useFitnessWatch();

  // Load workouts from master SQLite database on mount
  useEffect(() => {
    async function loadDbWorkouts() {
      try {
        const stored = await getWorkouts();
        if (stored && stored.length > 0) {
          setLocalWorkouts(stored);
        }
      } catch (err) {
        console.warn("Could not load workouts from DB:", err);
      }
    }
    loadDbWorkouts();
  }, []);

  // Queries
  const { data: workouts } = useListWorkouts();
  const { data: readinessData } = useGetWorkoutReadiness();
  const { data: insights } = useGetWorkoutInsights();
  const { data: dashboard } = useGetTodayDashboard();
  const { data: profile } = useGetProfile();

  const createWorkoutMutation = useCreateWorkout();
  const deleteWorkoutMutation = useDeleteWorkouts();

  // Combine server workouts with persistent SQLite workouts
  const combinedWorkouts = useMemo(() => {
    const serverList = Array.isArray(workouts) ? workouts : [];
    const list: WorkoutRecord[] = [...localWorkouts];
    for (const sw of serverList) {
      if (!list.some((lw) => String(lw.id) === String(sw.id))) {
        list.push({
          id: String(sw.id),
          type: sw.type,
          durationMinutes: Number(sw.durationMinutes),
          caloriesBurned: Number(sw.caloriesBurned),
          steps: sw.steps ?? undefined,
          distanceKm: sw.distanceKm ?? undefined,
          avgHeartRate: sw.avgHeartRate ?? undefined,
          intensity: (sw.intensity as any) ?? undefined,
          notes: sw.notes ?? undefined,
          loggedAt: sw.loggedAt || new Date().toISOString(),
        });
      }
    }
    return list;
  }, [workouts, localWorkouts]);

  // Physiological real-time calorie detection for manual form
  const userWeightKg = 72;
  const detectedManualCalories = useMemo(() => {
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
    const recordedTotal = combinedWorkouts.reduce((acc: number, w: WorkoutRecord) => acc + (Number(w.caloriesBurned) || 0), 0);
    // Add real-time active calories from the live Fitness Watch session
    return recordedTotal + watchMetrics.activeCalories;
  }, [combinedWorkouts, watchMetrics.activeCalories]);

  // Hardware accelerometer steps (live + ambient) integrated with dashboard baseline
  const sensorTodaySteps = getDailySteps();
  const stepsToday = Math.max(sensorTodaySteps, dashboard?.steps ?? (readinessData as any)?.stepsCount ?? 7420);
  const stepsCaloriesBurned = Math.round(stepsToday * 0.045);
  const totalActiveCaloriesBurned = workoutCaloriesBurned + stepsCaloriesBurned;

  const totalActiveMinutes = useMemo(() => {
    const recordedMins = combinedWorkouts.reduce((acc: number, w: WorkoutRecord) => acc + (Number(w.durationMinutes) || 0), 0);
    return recordedMins + Math.floor(watchMetrics.elapsedSeconds / 60);
  }, [combinedWorkouts, watchMetrics.elapsedSeconds]);

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

  // FITNESS WATCH ACTION HANDLERS
  const handleStartWatch = () => {
    startWorkout(selectedWatchMode);
  };

  const handleFinishWatch = async () => {
    const finalData = stopAndFinishWorkout();
    setCompletedWorkoutSummary(finalData);

    const modeMeta = WORKOUT_MODE_INFO[finalData.mode];
    const mins = Math.max(1, Math.round(finalData.elapsedSeconds / 60));
    const extraNotes = 
      finalData.mode === "strength_reps" ? `${finalData.reps} reps completed` :
      finalData.mode === "jumprope" ? `${finalData.jumps} jumps completed` :
      finalData.mode === "sports_games" ? `${finalData.swings} swings, ${finalData.agilityBursts} agility bursts` :
      finalData.steps > 0 ? `${finalData.steps} steps (${finalData.cadenceSpm} SPM)` :
      `${finalData.cadenceSpm} RPM`;

    const newRecord: WorkoutRecord = {
      id: `wo-watch-${Date.now()}`,
      type: modeMeta.name,
      durationMinutes: mins,
      caloriesBurned: Math.max(12, finalData.activeCalories),
      steps: finalData.steps > 0 ? finalData.steps : undefined,
      distanceKm: finalData.distanceKm > 0 ? finalData.distanceKm : undefined,
      avgHeartRate: finalData.estimatedHeartRate,
      intensity: finalData.currentIntensity,
      notes: `Tracked with Phone Sensors (Accel + Gyro) • Peak G-Force: ${finalData.peakGForce}G • ${extraNotes}`,
      loggedAt: new Date().toISOString(),
    };

    // Save directly to SQLite Master DB
    await saveWorkout(newRecord);
    setLocalWorkouts((prev) => [newRecord, ...prev]);

    try {
      await createWorkoutMutation.mutateAsync({
        data: {
          type: modeMeta.name,
          durationMinutes: mins,
          caloriesBurned: Math.max(12, finalData.activeCalories),
          distanceKm: finalData.distanceKm > 0 ? finalData.distanceKm : null,
          avgHeartRate: finalData.estimatedHeartRate,
          intensity: finalData.currentIntensity,
          notes: newRecord.notes,
        } as any,
      });
      qc.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetWorkoutReadinessQueryKey() });
      qc.invalidateQueries({ queryKey: getGetWorkoutInsightsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetTodayDashboardQueryKey() });
    } catch {
      await queueOfflineLog("workout", "/api/workouts", newRecord);
    }
  };

  // MANUAL LOGGING HANDLERS (Preserved)
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

  const handleLogManualWorkout = async () => {
    if (!selectedWorkout) return;

    const newWorkoutRecord: WorkoutRecord = {
      id: `wo-${Date.now()}`,
      type: selectedWorkout.name,
      durationMinutes: parseInt(duration) || 30,
      caloriesBurned: detectedManualCalories,
      steps: distance ? Math.round(parseFloat(distance) * 1250) : undefined,
      distanceKm: distance ? parseFloat(distance) : undefined,
      avgHeartRate: avgHeartRate ? parseInt(avgHeartRate) : undefined,
      intensity: intensity,
      notes: notes.trim() || `${selectedWorkout.name} logged manually`,
      loggedAt: new Date().toISOString(),
    };

    await saveWorkout(newWorkoutRecord);
    setLocalWorkouts((prev) => [newWorkoutRecord, ...prev]);

    try {
      await createWorkoutMutation.mutateAsync({
        data: {
          type: selectedWorkout.name,
          durationMinutes: parseInt(duration) || 30,
          caloriesBurned: detectedManualCalories,
          distanceKm: distance ? parseFloat(distance) : null,
          avgHeartRate: avgHeartRate ? parseInt(avgHeartRate) : null,
          intensity: intensity,
          notes: notes.trim() || `${selectedWorkout.name} logged manually`,
        } as any,
      });

      qc.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetWorkoutReadinessQueryKey() });
      qc.invalidateQueries({ queryKey: getGetWorkoutInsightsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetTodayDashboardQueryKey() });
      setShowLogModal(false);
      Alert.alert("Workout Saved! 🔥", `Logged ${selectedWorkout.name} (${detectedManualCalories} kcal burned).`);
    } catch {
      await queueOfflineLog("workout", "/api/workouts", newWorkoutRecord);
      setShowLogModal(false);
      Alert.alert("Saved to Database", `Workout saved to on-device database: ${selectedWorkout.name} (${detectedManualCalories} kcal).`);
    }
  };

  const handleDeleteWorkout = async (id: string) => {
    await deleteWorkout(id);
    setLocalWorkouts((prev) => prev.filter((w) => String(w.id) !== String(id)));

    try {
      await deleteWorkoutMutation.mutateAsync({ id });
      qc.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetWorkoutReadinessQueryKey() });
      qc.invalidateQueries({ queryKey: getGetWorkoutInsightsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetTodayDashboardQueryKey() });
    } catch {
      // Local SQLite deletion is persistent
    }
  };

  const filteredSections = useMemo(() => {
    if (activeCategoryTab === "all") return WORKOUT_SECTIONS;
    return WORKOUT_SECTIONS.filter(s => s.category === activeCategoryTab);
  }, [activeCategoryTab]);

  // Formatter for elapsed seconds: MM:SS or HH:MM:SS
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Apple Watch 3-Ring SVG calculations
  const ringSize = 130;
  const strokeWidth = 9;
  const center = ringSize / 2;

  // Outer Ring: Calories (Red/Rose)
  const r1 = 52;
  const c1 = 2 * Math.PI * r1;
  const p1 = Math.min(1.0, totalActiveCaloriesBurned / 650);
  const strokeDashoffset1 = c1 - p1 * c1;

  // Middle Ring: Steps/Reps (Emerald)
  const r2 = 38;
  const c2 = 2 * Math.PI * r2;
  const p2 = Math.min(1.0, stepsToday / 9000);
  const strokeDashoffset2 = c2 - p2 * c2;

  // Inner Ring: Active Minutes (Cyan)
  const r3 = 24;
  const c3 = 2 * Math.PI * r3;
  const p3 = Math.min(1.0, totalActiveMinutes / 30);
  const strokeDashoffset3 = c3 - p3 * c3;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={[styles.sensorBlinkDot, watchMetrics.isActive && { backgroundColor: "#10b981" }]} />
              <Text style={styles.headerSub}>
                {watchMetrics.isActive ? "⚡ SENSORS ENGAGED • 50Hz ACTIVE" : "BIOMETRIC MOTION ENGINE"}
              </Text>
            </View>
            <Text style={styles.headerTitle}>Activity & Motion</Text>
          </View>
          <Pressable onPress={openMenu} accessibilityLabel="Open Navigation Menu">
            <View style={styles.avatarCircleSmall}>
              <Text style={styles.avatarInitialSmall}>
                {profile?.name ? profile.name[0].toUpperCase() : "A"}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Triple Segmented View Switcher */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tabItem, activeMainTab === "watch" && styles.tabItemActive]}
            onPress={() => setActiveMainTab("watch")}
          >
            <Watch size={15} color={activeMainTab === "watch" ? "#10b981" : "#64748b"} />
            <Text style={[styles.tabText, activeMainTab === "watch" && styles.tabTextActive]}>
              Fitness Watch
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabItem, activeMainTab === "catalog" && styles.tabItemActive]}
            onPress={() => setActiveMainTab("catalog")}
          >
            <Dumbbell size={15} color={activeMainTab === "catalog" ? "#10b981" : "#64748b"} />
            <Text style={[styles.tabText, activeMainTab === "catalog" && styles.tabTextActive]}>
              Manual & Catalog
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabItem, activeMainTab === "strain" && styles.tabItemActive]}
            onPress={() => setActiveMainTab("strain")}
          >
            <Gauge size={15} color={activeMainTab === "strain" ? "#10b981" : "#64748b"} />
            <Text style={[styles.tabText, activeMainTab === "strain" && styles.tabTextActive]}>
              Strain & Load
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ========================================================================= */}
        {/* TAB 1: FITNESS WATCH INTERFACE (ACCELEROMETER + GYROSCOPE REAL-TIME HUD) */}
        {/* ========================================================================= */}
        {activeMainTab === "watch" && (
          <View style={{ gap: 16 }}>
            {/* Live Watch Telemetry Banner & Triple Rings */}
            <View style={styles.watchHudCard}>
              <View style={styles.watchHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Watch size={20} color="#10b981" />
                  <Text style={styles.watchHudTitle}>Lumen Bio-Watch HUD</Text>
                </View>
                <View style={styles.sensorStatusBadge}>
                  <View style={[styles.livePulseDot, watchMetrics.isActive && { backgroundColor: "#10b981" }]} />
                  <Text style={styles.sensorStatusText}>
                    {watchMetrics.sensorState === "hardware_active" ? "ACCEL+GYRO HW" : 
                     watchMetrics.sensorState === "simulated" ? "SIMULATION ACTIVE" : "SENSORS READY"}
                  </Text>
                </View>
              </View>

              {/* Central Rings & Big Metric Dial */}
              <View style={styles.ringsRow}>
                {/* SVG 3-Concentric Fitness Rings */}
                <View style={{ width: ringSize, height: ringSize, position: "relative" }}>
                  <Svg width={ringSize} height={ringSize}>
                    <Defs>
                      <LinearGradient id="calGrad" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor="#f43f5e" />
                        <Stop offset="1" stopColor="#fb7185" />
                      </LinearGradient>
                      <LinearGradient id="stepGrad" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor="#10b981" />
                        <Stop offset="1" stopColor="#34d399" />
                      </LinearGradient>
                      <LinearGradient id="minGrad" x1="0" y1="0" x2="1" y2="1">
                        <Stop offset="0" stopColor="#06b6d4" />
                        <Stop offset="1" stopColor="#38bdf8" />
                      </LinearGradient>
                    </Defs>

                    {/* Background track rings */}
                    <Circle cx={center} cy={center} r={r1} stroke="#1e293b" strokeWidth={strokeWidth} fill="none" opacity={0.3} />
                    <Circle cx={center} cy={center} r={r2} stroke="#1e293b" strokeWidth={strokeWidth} fill="none" opacity={0.3} />
                    <Circle cx={center} cy={center} r={r3} stroke="#1e293b" strokeWidth={strokeWidth} fill="none" opacity={0.3} />

                    {/* Progress Rings */}
                    <Circle
                      cx={center}
                      cy={center}
                      r={r1}
                      stroke="url(#calGrad)"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${c1} ${c1}`}
                      strokeDashoffset={strokeDashoffset1}
                      strokeLinecap="round"
                      fill="none"
                      transform={`rotate(-90 ${center} ${center})`}
                    />
                    <Circle
                      cx={center}
                      cy={center}
                      r={r2}
                      stroke="url(#stepGrad)"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${c2} ${c2}`}
                      strokeDashoffset={strokeDashoffset2}
                      strokeLinecap="round"
                      fill="none"
                      transform={`rotate(-90 ${center} ${center})`}
                    />
                    <Circle
                      cx={center}
                      cy={center}
                      r={r3}
                      stroke="url(#minGrad)"
                      strokeWidth={strokeWidth}
                      strokeDasharray={`${c3} ${c3}`}
                      strokeDashoffset={strokeDashoffset3}
                      strokeLinecap="round"
                      fill="none"
                      transform={`rotate(-90 ${center} ${center})`}
                    />
                  </Svg>
                  <View style={styles.ringsCenterIcon}>
                    <Activity size={18} color="#10b981" />
                  </View>
                </View>

                {/* Big Chronometer & Live Primary Metric */}
                <View style={styles.watchMainMetricsCol}>
                  <Text style={styles.watchTimerText}>{formatTime(watchMetrics.elapsedSeconds)}</Text>
                  <Text style={styles.watchStatusPill}>
                    {watchMetrics.isPaused ? "SESSION PAUSED" : watchMetrics.isActive ? "● RECORDING LIVE" : "STANDBY • READY"}
                  </Text>

                  {/* Dynamic primary counter based on workout mode */}
                  <View style={styles.primaryMetricBox}>
                    <Text style={styles.primaryMetricVal}>
                      {watchMetrics.mode === "strength_reps" ? watchMetrics.reps :
                       watchMetrics.mode === "jumprope" ? watchMetrics.jumps :
                       watchMetrics.mode === "sports_games" ? watchMetrics.swings :
                       watchMetrics.mode === "cycling" ? watchMetrics.cadenceSpm :
                       watchMetrics.steps.toLocaleString()}
                    </Text>
                    <Text style={styles.primaryMetricUnit}>
                      {WORKOUT_MODE_INFO[watchMetrics.mode].primaryUnit}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 4-Tile Secondary Biometric Telemetry Matrix */}
              <View style={styles.telemetryGrid}>
                {/* 1. Heart Rate & Zone */}
                <View style={styles.telemetryCell}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Heart size={14} color="#f43f5e" />
                    <Text style={styles.telemetryLabel}>Heart Rate</Text>
                  </View>
                  <Text style={styles.telemetryValue}>{watchMetrics.estimatedHeartRate} <Text style={styles.telemetryUnit}>BPM</Text></Text>
                  <View style={[styles.zoneBadge, { backgroundColor: getZoneColor(watchMetrics.heartRateZone) + "20" }]}>
                    <Text style={[styles.zoneBadgeText, { color: getZoneColor(watchMetrics.heartRateZone) }]}>
                      Z{watchMetrics.heartRateZone} • {watchMetrics.currentIntensity.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* 2. Active Calories Burned */}
                <View style={styles.telemetryCell}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Flame size={14} color="#f59e0b" />
                    <Text style={styles.telemetryLabel}>Active Burn</Text>
                  </View>
                  <Text style={styles.telemetryValue}>{watchMetrics.activeCalories} <Text style={styles.telemetryUnit}>kcal</Text></Text>
                  <Text style={styles.telemetrySub}>{watchMetrics.currentMet} METs power</Text>
                </View>

                {/* 3. Cadence / Tempo */}
                <View style={styles.telemetryCell}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Footprints size={14} color="#10b981" />
                    <Text style={styles.telemetryLabel}>Cadence / Tempo</Text>
                  </View>
                  <Text style={styles.telemetryValue}>
                    {watchMetrics.mode === "strength_reps" ? `${watchMetrics.reps} reps` :
                     `${watchMetrics.cadenceSpm}`} <Text style={styles.telemetryUnit}>SPM</Text>
                  </Text>
                  <Text style={styles.telemetrySub}>Peak G: {watchMetrics.peakGForce}G</Text>
                </View>

                {/* 4. Distance & Pace */}
                <View style={styles.telemetryCell}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Compass size={14} color="#3b82f6" />
                    <Text style={styles.telemetryLabel}>Distance & Pace</Text>
                  </View>
                  <Text style={styles.telemetryValue}>{watchMetrics.distanceKm} <Text style={styles.telemetryUnit}>km</Text></Text>
                  <Text style={styles.telemetrySub}>{watchMetrics.paceMinKm} pace</Text>
                </View>
              </View>

              {/* Real-Time Hardware Oscilloscope & Micro-Stream */}
              <View style={styles.sensorStreamCard}>
                <View style={styles.sensorStreamHeader}>
                  <Text style={styles.streamTitle}>Hardware Sensor Micro-Stream (50Hz Sampling)</Text>
                  <Text style={styles.streamBadge}>ACCEL + GYRO ACTIVE</Text>
                </View>
                <View style={styles.streamReadoutRow}>
                  <View style={styles.streamAxisCol}>
                    <Text style={styles.streamAxisLabel}>Accel X</Text>
                    <Text style={styles.streamAxisVal}>{watchMetrics.accel.x > 0 ? `+${watchMetrics.accel.x}` : watchMetrics.accel.x}</Text>
                  </View>
                  <View style={styles.streamAxisCol}>
                    <Text style={styles.streamAxisLabel}>Accel Y</Text>
                    <Text style={styles.streamAxisVal}>{watchMetrics.accel.y > 0 ? `+${watchMetrics.accel.y}` : watchMetrics.accel.y}</Text>
                  </View>
                  <View style={styles.streamAxisCol}>
                    <Text style={styles.streamAxisLabel}>Accel Z</Text>
                    <Text style={styles.streamAxisVal}>{watchMetrics.accel.z > 0 ? `+${watchMetrics.accel.z}` : watchMetrics.accel.z}</Text>
                  </View>
                  <View style={styles.streamAxisCol}>
                    <Text style={styles.streamAxisLabel}>Gyro Rot</Text>
                    <Text style={[styles.streamAxisVal, { color: "#38bdf8" }]}>{watchMetrics.gyro.angularRate} rad/s</Text>
                  </View>
                </View>
              </View>

              {/* Watch Session Control Buttons */}
              <View style={styles.controlsRow}>
                {!watchMetrics.isActive ? (
                  <>
                    <Pressable style={styles.startWorkoutBtn} onPress={handleStartWatch}>
                      <Play size={18} color="#050b08" fill="#050b08" style={{ marginRight: 8 }} />
                      <Text style={styles.startWorkoutText}>START {WORKOUT_MODE_INFO[selectedWatchMode].name.toUpperCase()}</Text>
                    </Pressable>
                    <Pressable style={styles.simDemoBtn} onPress={toggleSimulation}>
                      <Sparkles size={14} color="#94a3b8" style={{ marginRight: 6 }} />
                      <Text style={styles.simDemoText}>
                        {watchMetrics.sensorState === "simulated" ? "Stop Sim" : "Test Motion Sim"}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    {watchMetrics.isPaused ? (
                      <Pressable style={styles.resumeWorkoutBtn} onPress={resumeWorkout}>
                        <Play size={18} color="#050b08" fill="#050b08" style={{ marginRight: 6 }} />
                        <Text style={styles.controlBtnTextDark}>RESUME</Text>
                      </Pressable>
                    ) : (
                      <Pressable style={styles.pauseWorkoutBtn} onPress={pauseWorkout}>
                        <Pause size={18} color="#f8fafc" style={{ marginRight: 6 }} />
                        <Text style={styles.controlBtnTextLight}>PAUSE</Text>
                      </Pressable>
                    )}
                    <Pressable style={styles.finishWorkoutBtn} onPress={handleFinishWatch}>
                      <Square size={16} color="#050b08" fill="#050b08" style={{ marginRight: 6 }} />
                      <Text style={styles.controlBtnTextDark}>FINISH & SAVE</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>

            {/* Workout Mode Selector (Select exercise or game to track) */}
            <View style={styles.modeSelectorCard}>
              <View style={styles.modeSelectorHeader}>
                <Text style={styles.modeSelectorTitle}>Select Exercise or Game</Text>
                <Text style={styles.modeSelectorSub}>Sensors adapt physics algorithms automatically</Text>
              </View>

              <View style={styles.modeGrid}>
                {(Object.keys(WORKOUT_MODE_INFO) as WorkoutMode[]).map((modeKey) => {
                  const info = WORKOUT_MODE_INFO[modeKey];
                  const isSelected = selectedWatchMode === modeKey;
                  return (
                    <Pressable
                      key={modeKey}
                      style={[styles.modeTile, isSelected && styles.modeTileActive]}
                      onPress={() => {
                        if (!watchMetrics.isActive) {
                          setSelectedWatchMode(modeKey);
                        } else {
                          Alert.alert("Session Active", "Finish or pause current session before switching modes.");
                        }
                      }}
                    >
                      <View style={styles.modeTileTop}>
                        <Text style={{ fontSize: 26 }}>{info.icon}</Text>
                        <View style={[styles.metBadgeSmall, isSelected && { backgroundColor: "rgba(16, 185, 129, 0.25)" }]}>
                          <Text style={[styles.metBadgeTextSmall, isSelected && { color: "#10b981" }]}>
                            {info.baseMet} MET
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.modeTileTitle, isSelected && styles.modeTileTitleActive]}>
                        {info.name}
                      </Text>
                      <Text style={styles.modeTileHint} numberOfLines={2}>{info.hint}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* All-Day Accelerometer Pedometer Live Card */}
            <View style={styles.allDayStepCard}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={styles.pedometerIconBox}>
                    <Footprints size={22} color="#10b981" />
                  </View>
                  <View>
                    <Text style={styles.allDayStepsLabel}>Phone Pedometer (Daily Total)</Text>
                    <Text style={styles.allDayStepsSub}>Continuously counted via phone accelerometer</Text>
                  </View>
                </View>
                <Text style={styles.allDayStepsVal}>{stepsToday.toLocaleString()}</Text>
              </View>
              <View style={styles.pedometerProgressBar}>
                <View style={[styles.pedometerProgressFill, { width: `${Math.min(100, Math.round((stepsToday / 9000) * 100))}%` }]} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={styles.pedometerFootnote}>{Math.round((stepsToday / 9000) * 100)}% of 9,000 goal</Text>
                <Text style={styles.pedometerFootnote}>{stepsCaloriesBurned} kcal burned</Text>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MANUAL LOGGING & WORKOUT CATALOG (100% PRESERVED AS REQUESTED)    */}
        {/* ========================================================================= */}
        {activeMainTab === "catalog" && (
          <View style={{ gap: 16 }}>
            {/* Quick Action: Log Exercise Button */}
            <Pressable style={styles.logPrimaryTrigger} onPress={() => setShowLogModal(true)}>
              <Plus size={18} color="#050b08" style={{ marginRight: 8 }} />
              <Text style={styles.logPrimaryTriggerText}>Log Custom Workout Manually</Text>
            </Pressable>

            {/* Workout Catalog Filter Tabs */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>Select Workout from Library</Text>
              <Text style={styles.sectionHeaderSub}>Computes METs & calories automatically</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPillsScroll}>
              {[
                { id: "all", label: "All Categories" },
                { id: "cardio", label: "🏃 Cardio & Run" },
                { id: "strength", label: "🏋️ Strength & Muscle" },
                { id: "hiit", label: "⚡ High-Intensity HIIT" },
                { id: "recovery", label: "🧘 Mind-Body & Yoga" },
                { id: "sports", label: "🏊 Sports & Games" },
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

            {/* Distinct Workout Preset Sections */}
            <View style={{ gap: 20 }}>
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
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: STRAIN, LOAD & RECOVERY ANALYTICS                                  */}
        {/* ========================================================================= */}
        {activeMainTab === "strain" && (
          <View style={{ gap: 16 }}>
            {/* Unified Total Active Calorie Burn Hub Banner */}
            <View style={styles.unifiedBurnCard}>
              <View style={styles.unifiedHeaderRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Flame size={20} color="#f59e0b" />
                  <Text style={styles.unifiedTitle}>Total Active Calorie Burn</Text>
                </View>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>COMBINED TELEMETRY</Text>
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
          </View>
        )}

        {/* ========================================================================= */}
        {/* WORKOUT HISTORY TIMELINE (ALWAYS VISIBLE AT BOTTOM)                      */}
        {/* ========================================================================= */}
        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>Today's Completed Workouts</Text>
          <Text style={styles.historyCount}>{combinedWorkouts.length} logged</Text>
        </View>

        <View style={styles.workoutsList}>
          {combinedWorkouts.length > 0 ? (
            combinedWorkouts.map((w: any, idx: number) => (
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
                      {w.steps ? ` • ${w.steps.toLocaleString()} steps` : ""}
                    </Text>
                    {w.notes && (
                      <Text style={styles.workoutNotesText} numberOfLines={2}>{w.notes}</Text>
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
                  <Pressable onPress={() => handleDeleteWorkout(w.id)} style={{ padding: 6 }}>
                    <Trash2 size={16} color="#64748b" />
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <CheckCircle2 size={36} color="#475569" style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>No workouts recorded yet today</Text>
              <Text style={styles.emptyText}>
                Start a session with the Fitness Watch tracker or select any workout from the catalog to record your movement.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ========================================================================= */}
      {/* POST-WORKOUT CELEBRATION & SUMMARY SHEET                                  */}
      {/* ========================================================================= */}
      {completedWorkoutSummary && (
        <Modal transparent animationType="fade" visible={true}>
          <View style={styles.modalBackdrop}>
            <View style={styles.summaryModalCard}>
              <View style={styles.celebrateHeader}>
                <Trophy size={40} color="#10b981" />
                <Text style={styles.celebrateTitle}>Workout Complete! 🔥</Text>
                <Text style={styles.celebrateSub}>
                  {WORKOUT_MODE_INFO[completedWorkoutSummary.mode].name} recorded and saved to database.
                </Text>
              </View>

              <View style={styles.summaryGrid}>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryCellLabel}>Duration</Text>
                  <Text style={styles.summaryCellVal}>{formatTime(completedWorkoutSummary.elapsedSeconds)}</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryCellLabel}>Active Burn</Text>
                  <Text style={[styles.summaryCellVal, { color: "#f59e0b" }]}>{completedWorkoutSummary.activeCalories} kcal</Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryCellLabel}>
                    {WORKOUT_MODE_INFO[completedWorkoutSummary.mode].primaryUnit}
                  </Text>
                  <Text style={[styles.summaryCellVal, { color: "#10b981" }]}>
                    {completedWorkoutSummary.mode === "strength_reps" ? completedWorkoutSummary.reps :
                     completedWorkoutSummary.mode === "jumprope" ? completedWorkoutSummary.jumps :
                     completedWorkoutSummary.mode === "sports_games" ? completedWorkoutSummary.swings :
                     completedWorkoutSummary.steps.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.summaryCell}>
                  <Text style={styles.summaryCellLabel}>Avg Heart Rate</Text>
                  <Text style={[styles.summaryCellVal, { color: "#f43f5e" }]}>{completedWorkoutSummary.estimatedHeartRate} BPM</Text>
                </View>
              </View>

              <View style={styles.summarySensorFootnote}>
                <Shield size={14} color="#10b981" />
                <Text style={styles.summarySensorText}>
                  Peak G-Force: {completedWorkoutSummary.peakGForce}G • Data stored in SQLite Master DB
                </Text>
              </View>

              <Pressable 
                style={styles.summaryCloseBtn} 
                onPress={() => setCompletedWorkoutSummary(null)}
              >
                <Text style={styles.summaryCloseText}>Done & Back to Dashboard</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MANUAL WORKOUT LOGGING MODAL                                              */}
      {/* ========================================================================= */}
      {showLogModal && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 24 }}>{selectedWorkout.icon}</Text>
                <View>
                  <Text style={styles.modalTitle}>{selectedWorkout.name}</Text>
                  <Text style={styles.modalSub}>{selectedWorkout.met} MET • Auto-Calorie Detector</Text>
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
                <Text style={styles.liveCalVal}>{detectedManualCalories} kcal</Text>
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
                  { id: "light", label: "Light (Zone 1-2)" },
                  { id: "moderate", label: "Moderate (Zone 3)" },
                  { id: "vigorous", label: "Vigorous (Zone 4)" },
                  { id: "peak", label: "Peak (Zone 5)" },
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
                placeholder="e.g. Completed strong sets, good pacing"
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
                onPress={handleLogManualWorkout}
                disabled={createWorkoutMutation.isPending}
              >
                <CheckCircle2 size={16} color="#050b08" style={{ marginRight: 6 }} />
                <Text style={styles.modalSaveText}>
                  {createWorkoutMutation.isPending ? "Logging..." : `Log Workout (${detectedManualCalories} kcal)`}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// Heart rate zone color helper
function getZoneColor(zone: number): string {
  switch (zone) {
    case 1: return "#38bdf8"; // Blue
    case 2: return "#10b981"; // Emerald
    case 3: return "#f59e0b"; // Amber
    case 4: return "#f97316"; // Orange
    case 5: return "#ef4444"; // Red
    default: return "#10b981";
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050b08",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sensorBlinkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#64748b",
  },
  headerSub: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: "#f8fafc",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 2,
  },
  avatarCircleSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#13231c",
    borderWidth: 1.5,
    borderColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialSmall: {
    color: "#10b981",
    fontSize: 13,
    fontWeight: "bold",
  },
  // Tab Bar Switcher
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#0b1612",
    borderRadius: 14,
    padding: 4,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.15)",
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  tabText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#f8fafc",
    fontWeight: "bold",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  // ==========================================
  // FITNESS WATCH HUD STYLES
  // ==========================================
  watchHudCard: {
    backgroundColor: "#0b1612",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    padding: 18,
    gap: 16,
  },
  watchHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  watchHudTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "900",
  },
  sensorStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#64748b",
  },
  sensorStatusText: {
    color: "#10b981",
    fontSize: 9,
    fontWeight: "900",
  },
  ringsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  ringsCenterIcon: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  watchMainMetricsCol: {
    flex: 1,
    gap: 4,
  },
  watchTimerText: {
    color: "#f8fafc",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
  },
  watchStatusPill: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  primaryMetricBox: {
    marginTop: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  primaryMetricVal: {
    color: "#10b981",
    fontSize: 22,
    fontWeight: "900",
  },
  primaryMetricUnit: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  // Telemetry 4-cell Grid
  telemetryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  telemetryCell: {
    flex: 1,
    minWidth: "46%",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  telemetryLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  telemetryValue: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
  },
  telemetryUnit: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  telemetrySub: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "500",
  },
  zoneBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  zoneBadgeText: {
    fontSize: 9,
    fontWeight: "bold",
  },
  // Sensor Oscilloscope
  sensorStreamCard: {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 14,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  sensorStreamHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  streamTitle: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  streamBadge: {
    color: "#10b981",
    fontSize: 8,
    fontWeight: "900",
  },
  streamReadoutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  streamAxisCol: {
    alignItems: "center",
    gap: 2,
  },
  streamAxisLabel: {
    color: "#475569",
    fontSize: 9,
    fontWeight: "600",
  },
  streamAxisVal: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "bold",
    fontVariant: ["tabular-nums"],
  },
  // Controls
  controlsRow: {
    flexDirection: "row",
    gap: 10,
  },
  startWorkoutBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981",
    borderRadius: 14,
    paddingVertical: 14,
  },
  startWorkoutText: {
    color: "#050b08",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  simDemoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e293b",
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  simDemoText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "bold",
  },
  pauseWorkoutBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#334155",
    borderRadius: 14,
    paddingVertical: 14,
  },
  resumeWorkoutBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981",
    borderRadius: 14,
    paddingVertical: 14,
  },
  finishWorkoutBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f59e0b",
    borderRadius: 14,
    paddingVertical: 14,
  },
  controlBtnTextDark: {
    color: "#050b08",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  controlBtnTextLight: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  // Mode Selector Card
  modeSelectorCard: {
    backgroundColor: "#0b1612",
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.15)",
  },
  modeSelectorHeader: {
    gap: 2,
  },
  modeSelectorTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "bold",
  },
  modeSelectorSub: {
    color: "#64748b",
    fontSize: 11,
  },
  modeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  modeTile: {
    width: "48%",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 14,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  modeTileActive: {
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderColor: "#10b981",
  },
  modeTileTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metBadgeSmall: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metBadgeTextSmall: {
    color: "#94a3b8",
    fontSize: 9,
    fontWeight: "bold",
  },
  modeTileTitle: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "bold",
  },
  modeTileTitleActive: {
    color: "#10b981",
  },
  modeTileHint: {
    color: "#64748b",
    fontSize: 10,
    lineHeight: 14,
  },
  // All-Day Pedometer Card
  allDayStepCard: {
    backgroundColor: "#0b1612",
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.15)",
  },
  pedometerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  allDayStepsLabel: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "bold",
  },
  allDayStepsSub: {
    color: "#64748b",
    fontSize: 10,
  },
  allDayStepsVal: {
    color: "#10b981",
    fontSize: 20,
    fontWeight: "900",
  },
  pedometerProgressBar: {
    height: 6,
    backgroundColor: "#1e293b",
    borderRadius: 3,
    overflow: "hidden",
  },
  pedometerProgressFill: {
    height: "100%",
    backgroundColor: "#10b981",
    borderRadius: 3,
  },
  pedometerFootnote: {
    color: "#64748b",
    fontSize: 10,
  },
  // ==========================================
  // MANUAL LOGGING & CATALOG STYLES (Preserved)
  // ==========================================
  logPrimaryTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981",
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: "#10b981",
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  logPrimaryTriggerText: {
    color: "#050b08",
    fontSize: 14,
    fontWeight: "900",
  },
  sectionHeaderRow: {
    gap: 2,
    marginTop: 4,
  },
  sectionHeaderTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "bold",
  },
  sectionHeaderSub: {
    color: "#64748b",
    fontSize: 11,
  },
  categoryPillsScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  categoryPill: {
    backgroundColor: "#0b1612",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  categoryPillActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10b981",
  },
  categoryPillText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  categoryPillTextActive: {
    color: "#10b981",
    fontWeight: "bold",
  },
  categorySectionCard: {
    backgroundColor: "#0b1612",
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.12)",
  },
  secTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  secTitleText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "bold",
  },
  secCountBadge: {
    color: "#64748b",
    fontSize: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  workoutPresetsGrid: {
    gap: 8,
  },
  presetTile: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  presetTileTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  presetTileIcon: {
    fontSize: 20,
  },
  metPill: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metPillText: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "bold",
  },
  presetTileName: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "bold",
  },
  presetTileHint: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 15,
  },
  presetTileFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  presetTileDefault: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "500",
  },
  // ==========================================
  // STRAIN & READINESS STYLES
  // ==========================================
  unifiedBurnCard: {
    backgroundColor: "#0b1612",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    borderRadius: 24,
    padding: 20,
    gap: 16,
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
  },
  bigBurnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bigBurnValue: {
    color: "#f8fafc",
    fontSize: 36,
    fontWeight: "900",
  },
  bigBurnLabel: {
    color: "#64748b",
    fontSize: 11,
  },
  burnTargetCol: {
    width: 140,
    gap: 6,
  },
  targetStatusText: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "right",
  },
  targetProgressBar: {
    height: 8,
    backgroundColor: "#1e293b",
    borderRadius: 4,
    overflow: "hidden",
  },
  targetProgressFill: {
    height: "100%",
    backgroundColor: "#10b981",
    borderRadius: 4,
  },
  burnBreakdownGrid: {
    flexDirection: "row",
    gap: 10,
  },
  burnBreakdownBox: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 10,
    borderRadius: 12,
    gap: 2,
  },
  breakdownSub: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "bold",
  },
  breakdownVal: {
    fontSize: 14,
    fontWeight: "900",
  },
  breakdownFootnote: {
    color: "#64748b",
    fontSize: 9,
  },
  dualGaugeCard: {
    backgroundColor: "#0b1612",
    borderRadius: 24,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.15)",
  },
  dualGaugeRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  gaugeItem: {
    alignItems: "center",
    gap: 6,
  },
  gaugeCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeScoreVal: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "900",
  },
  gaugeScoreMax: {
    color: "#64748b",
    fontSize: 9,
  },
  gaugeLabel: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "bold",
  },
  gaugeStatusText: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "600",
  },
  gaugeDivider: {
    width: 1,
    height: 60,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  gaugeExplanationBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.05)",
    padding: 10,
    borderRadius: 12,
  },
  gaugeExplanationText: {
    flex: 1,
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 16,
  },
  insightsCard: {
    backgroundColor: "#0b1612",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  insightsHeader: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "bold",
  },
  insightRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginVertical: 4,
  },
  insightDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#10b981",
  },
  insightText: {
    color: "#94a3b8",
    fontSize: 11,
  },
  // ==========================================
  // WORKOUT HISTORY STYLES
  // ==========================================
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  historyTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "bold",
  },
  historyCount: {
    color: "#64748b",
    fontSize: 11,
  },
  workoutsList: {
    gap: 10,
  },
  workoutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0b1612",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  workoutLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  activityName: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "bold",
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
  },
  workoutRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    color: "#f87171",
    fontSize: 9,
    fontWeight: "bold",
  },
  emptyCard: {
    backgroundColor: "#0b1310",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 6,
  },
  emptyTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "bold",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
  // ==========================================
  // MODALS & SUMMARY SHEETS
  // ==========================================
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 999,
  },
  summaryModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#0b1612",
    borderRadius: 24,
    padding: 20,
    gap: 16,
    borderWidth: 1.5,
    borderColor: "#10b981",
  },
  celebrateHeader: {
    alignItems: "center",
    gap: 6,
  },
  celebrateTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  celebrateSub: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 12,
    borderRadius: 16,
  },
  summaryCell: {
    width: "48%",
    gap: 2,
  },
  summaryCellLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  summaryCellVal: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "900",
  },
  summarySensorFootnote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  summarySensorText: {
    color: "#10b981",
    fontSize: 10,
    fontWeight: "600",
  },
  summaryCloseBtn: {
    backgroundColor: "#10b981",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  summaryCloseText: {
    color: "#050b08",
    fontSize: 13,
    fontWeight: "900",
  },
  // Manual Modal Styles
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0b1612",
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalSub: {
    color: "#10b981",
    fontSize: 11,
    fontWeight: "600",
  },
  liveDetectedCalorieBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  liveCalTitle: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "bold",
  },
  liveCalSub: {
    color: "#94a3b8",
    fontSize: 10,
  },
  liveCalValBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10b981",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  liveCalVal: {
    color: "#050b08",
    fontSize: 13,
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
    backgroundColor: "#13231c",
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
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
    flexWrap: "wrap",
    gap: 6,
  },
  intensityBtn: {
    flex: 1,
    minWidth: "46%",
    backgroundColor: "#13231c",
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  intensityBtnActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  intensityBtnText: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "bold",
  },
  intensityBtnTextActive: {
    color: "#050b08",
  },
  formGridTwo: {
    flexDirection: "row",
    gap: 10,
  },
  textInput: {
    backgroundColor: "#13231c",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#f8fafc",
    fontSize: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "bold",
  },
  modalSaveBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981",
    borderRadius: 12,
    paddingVertical: 12,
  },
  modalSaveText: {
    color: "#050b08",
    fontSize: 12,
    fontWeight: "900",
  },
});
