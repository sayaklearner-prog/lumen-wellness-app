import { useEffect, useState, useMemo, useRef } from "react";
import { 
  View, Text, StyleSheet, ScrollView, Pressable, 
  Platform, TextInput, ActivityIndicator, Alert, Modal, Switch 
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { 
  useListWorkouts, useCreateWorkout, useDeleteWorkouts, 
  useGetWorkoutReadiness, useGetWorkoutInsights, useGetTodayDashboard, useGetProfile,
  getListWorkoutsQueryKey, getGetWorkoutReadinessQueryKey, getGetWorkoutInsightsQueryKey, getGetTodayDashboardQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Activity, Timer, Zap, Trash2, Plus, 
  Sparkles, CheckCircle2, Trophy, Flame, Footprints, 
  Dumbbell, Bike, TrendingUp, Award, ChevronRight, X, Sliders,
  Play, Pause, Square, RotateCcw, Compass, Gauge, Shield, Watch, Smartphone,
  Bluetooth, RefreshCw, Moon, Heart, Radio, BatteryCharging, Check, Disc, ArrowUpRight
} from "lucide-react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { queueOfflineLog, getWorkouts, saveWorkout, deleteWorkout, WorkoutRecord } from "@/services/db";
import { useSlideMenu } from "@/context/SlideMenuContext";
import { useFitnessWatch } from "@/hooks/useFitnessWatch";
import { useWearableSync } from "@/hooks/useWearableSync";
import { WearableDevice } from "@/services/wearableSyncService";
import { 
  WORKOUT_MODE_INFO, 
  WorkoutMode, 
  LiveWatchMetrics 
} from "@/services/fitnessWatchSensor";
import { nativeStepCounter } from "@/services/nativeStepCounter";
import THEME from "@/constants/theme";

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

  const params = useLocalSearchParams();

  // Active Main Tab: "watch" (Fitness Watch HUD), "wearable" (Wearable Sync), "catalog" (Manual Entry), "strain" (Readiness)
  const [activeMainTab, setActiveMainTab] = useState<"watch" | "wearable" | "catalog" | "strain">("watch");

  // Wearable Bluetooth Sync Hook (OpenStrap Edge Architecture)
  const {
    connectedDevice,
    telemetry: wearableTel,
    discoveredDevices,
    isScanning: isBleScanning,
    isSyncing: isBleSyncing,
    permissionGranted: blePermissionGranted,
    extractFromWearable,
    toggleExtractFromWearable,
    isWearableActive,
    requestPermissions: requestBlePermissions,
    scanDevices: scanBleDevices,
    connectDevice: connectBleDevice,
    syncNow: syncBleNow,
    disconnectDevice: disconnectBleDevice,
  } = useWearableSync();

  const [wearableFilter, setWearableFilter] = useState<"all" | "ring" | "watch" | "band" | "chest_strap">("all");


  useEffect(() => {
    if (params?.tab === "wearable") {
      setActiveMainTab("wearable");
    }
  }, [params?.tab]);

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

  // 24/7 Background Step Tracking state
  const [bgTrackingInfo, setBgTrackingInfo] = useState<{
    isNative: boolean;
    hasPermission: boolean;
    isBatteryIgnored: boolean;
    hasHardwareSensor: boolean;
    isRequesting: boolean;
  }>({
    isNative: false,
    hasPermission: true,
    isBatteryIgnored: true,
    hasHardwareSensor: true,
    isRequesting: false,
  });

  const checkBgStatus = async () => {
    const isNative = nativeStepCounter.isAvailable();
    if (!isNative) {
      setBgTrackingInfo(prev => ({ ...prev, isNative: false }));
      return;
    }
    const perm = await nativeStepCounter.checkPermissions();
    const batt = await nativeStepCounter.isBatteryOptimizationIgnored();
    setBgTrackingInfo({
      isNative: true,
      hasPermission: perm.granted,
      isBatteryIgnored: batt,
      hasHardwareSensor: perm.hasHardwareSensor ?? true,
      isRequesting: false,
    });
  };

  useEffect(() => {
    checkBgStatus();
  }, []);

  const handleEnableBackgroundTracking = async () => {
    setBgTrackingInfo(prev => ({ ...prev, isRequesting: true }));
    try {
      const res = await nativeStepCounter.requestPermissions();
      const batt = await nativeStepCounter.isBatteryOptimizationIgnored();
      setBgTrackingInfo(prev => ({
        ...prev,
        hasPermission: res.granted,
        isBatteryIgnored: batt,
        isRequesting: false,
      }));
      if (res.granted) {
        Alert.alert("24/7 Tracking Active", "Background Step Tracking is now enabled. Your steps will continue counting when Lumen is closed or the screen is turned off.");
      } else {
        Alert.alert("Permission Required", "Activity Recognition permission was not granted. Please enable Physical Activity in Android Settings > Apps > Lumen > Permissions.");
      }
    } catch (e: any) {
      setBgTrackingInfo(prev => ({ ...prev, isRequesting: false }));
      Alert.alert("Error", e?.message || "Failed to request permission.");
    }
  };

  const handleRequestBatteryOptimization = async () => {
    try {
      await nativeStepCounter.requestIgnoreBatteryOptimizations();
      const batt = await nativeStepCounter.isBatteryOptimizationIgnored();
      setBgTrackingInfo(prev => ({ ...prev, isBatteryIgnored: batt }));
    } catch (e: any) {
      console.warn("Battery opt request error:", e);
    }
  };

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
          intensity: (sw.intensity as any) ?? undefined,
          notes: sw.notes ?? undefined,
          loggedAt: sw.loggedAt || new Date().toISOString(),
        });
      }
    }
    // Filter out mock data (w-001) and phantom test records
    return list.filter(
      (w) => w.id !== "w-001" && !(w.durationMinutes <= 1 && w.caloriesBurned <= 12)
    );
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

    const base = met * userWeightKg * (mins / 60) * intensityMultiplier;
    return Math.max(15, Math.round(base));
  }, [selectedWorkout, duration, intensity]);

  // Aggregated unified daily active calorie computation
  const workoutCaloriesBurned = useMemo(() => {
    const recordedTotal = combinedWorkouts.reduce((acc: number, w: WorkoutRecord) => acc + (Number(w.caloriesBurned) || 0), 0);
    // Add real-time active calories from the live Fitness Watch session
    return recordedTotal + (watchMetrics.isActive ? watchMetrics.activeCalories : 0);
  }, [combinedWorkouts, watchMetrics.isActive, watchMetrics.activeCalories]);

  // Unified steps today: If wearable extraction is active, priority is given to wearable steps.
  // Otherwise, phone internal accelerometer step counter is ALWAYS ON and primary.
  const sensorTodaySteps = getDailySteps();
  const stepsToday = isWearableActive && wearableTel?.steps > 0
    ? wearableTel.steps
    : Math.max(sensorTodaySteps, watchMetrics.dailySteps, dashboard?.steps ?? (readinessData as any)?.stepsCount ?? 0);

  const stepsCaloriesBurned = isWearableActive && wearableTel?.activeCalories > 0
    ? wearableTel.activeCalories
    : Math.round(stepsToday * 0.045);

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
    return Math.min(21, Math.max(0, Math.round(val * 10) / 10));
  }, [readinessData, totalActiveCaloriesBurned, totalActiveMinutes]);

  const readinessScore = (readinessData as any)?.readinessScore ?? (acuteStrainScore > 0 ? 80 : 0);
  const strainStatus = (readinessData as any)?.loadStatus ?? (
    acuteStrainScore >= 16 ? "Peak Exertion Reached" :
    acuteStrainScore >= 10 ? "Optimal Training Stimulus" :
    acuteStrainScore >= 5 ? "Aerobic Maintenance" : "Primed for Exertion"
  );

  // FITNESS WATCH ACTION HANDLERS
  const handleStartTreadmill = () => {
    setSelectedWatchMode("treadmill");
    startWorkout("treadmill");
  };

  const handleStartWatch = () => {
    handleStartTreadmill();
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
      caloriesBurned: Math.round(finalData.activeCalories),
      steps: finalData.steps > 0 ? finalData.steps : undefined,
      distanceKm: finalData.distanceKm > 0 ? finalData.distanceKm : undefined,
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
          caloriesBurned: Math.round(finalData.activeCalories),
          distanceKm: finalData.distanceKm > 0 ? finalData.distanceKm : null,
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
    setDistance("");
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

        {/* Quad Segmented View Switcher */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tabItem, activeMainTab === "watch" && styles.tabItemActive]}
            onPress={() => setActiveMainTab("watch")}
          >
            <Watch size={14} color={activeMainTab === "watch" ? "#10b981" : "#64748b"} />
            <Text style={[styles.tabText, activeMainTab === "watch" && styles.tabTextActive]}>
              Watch
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabItem, activeMainTab === "wearable" && styles.tabItemActive]}
            onPress={() => setActiveMainTab("wearable")}
          >
            <Bluetooth size={14} color={activeMainTab === "wearable" ? "#10b981" : "#64748b"} />
            <Text style={[styles.tabText, activeMainTab === "wearable" && styles.tabTextActive]}>
              Wearables
            </Text>
            {connectedDevice && (
              <View style={styles.tabConnectedDot} />
            )}
          </Pressable>

          <Pressable
            style={[styles.tabItem, activeMainTab === "catalog" && styles.tabItemActive]}
            onPress={() => setActiveMainTab("catalog")}
          >
            <Dumbbell size={14} color={activeMainTab === "catalog" ? "#10b981" : "#64748b"} />
            <Text style={[styles.tabText, activeMainTab === "catalog" && styles.tabTextActive]}>
              Catalog
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tabItem, activeMainTab === "strain" && styles.tabItemActive]}
            onPress={() => setActiveMainTab("strain")}
          >
            <Gauge size={14} color={activeMainTab === "strain" ? "#10b981" : "#64748b"} />
            <Text style={[styles.tabText, activeMainTab === "strain" && styles.tabTextActive]}>
              Strain
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
            {/* Background Step Tracking Permission Alert Card */}
            {bgTrackingInfo.isNative && !bgTrackingInfo.hasPermission && (
              <View style={styles.bgPermissionAlertCard}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                  <View style={styles.bgAlertIconBox}>
                    <Shield size={22} color="#f59e0b" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bgAlertTitle}>Enable 24/7 Background Step Tracking</Text>
                    <Text style={styles.bgAlertDesc}>
                      Lumen requires Physical Activity recognition to track steps and calories non-stop while your phone is locked or Lumen is closed.
                    </Text>
                    <Pressable
                      style={styles.bgAlertBtn}
                      onPress={handleEnableBackgroundTracking}
                      disabled={bgTrackingInfo.isRequesting}
                    >
                      {bgTrackingInfo.isRequesting ? (
                        <ActivityIndicator size="small" color="#050b08" />
                      ) : (
                        <>
                          <Footprints size={16} color="#050b08" />
                          <Text style={styles.bgAlertBtnText}>Grant Permission & Start 24/7 Tracking</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </View>
              </View>
            )}

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
                  <Text style={styles.watchTimerText}>
                    {watchMetrics.isActive ? formatTime(watchMetrics.elapsedSeconds) : "LIVE"}
                  </Text>
                  <Text style={[
                    styles.watchStatusPill, 
                    isWearableActive && { backgroundColor: "rgba(56, 189, 248, 0.2)", borderColor: "rgba(56, 189, 248, 0.4)", color: "#38bdf8" },
                    !bgTrackingInfo.hasPermission && { backgroundColor: "rgba(245, 158, 11, 0.2)", borderColor: "rgba(245, 158, 11, 0.4)", color: "#fbbf24" }
                  ]}>
                    {isWearableActive
                      ? `⌚ WEARABLE EXTRACT (${connectedDevice?.name || "DEVICE"})`
                      : !bgTrackingInfo.hasPermission
                        ? "⚠️ BACKGROUND PERMISSION REQUIRED"
                        : watchMetrics.detectedActivity === "running"
                          ? "🏃 OUTDOOR RUNNING (AUTO-DETECTED)"
                          : watchMetrics.detectedActivity === "walking"
                            ? "🚶 OUTDOOR WALKING (AUTO-DETECTED)"
                            : "● 24/7 BACKGROUND TRACKING ACTIVE"}
                  </Text>

                  {/* Dynamic primary counter based on workout mode */}
                  <View style={styles.primaryMetricBox}>
                    <Text style={styles.primaryMetricVal}>
                      {stepsToday.toLocaleString()}
                    </Text>
                    <Text style={styles.primaryMetricUnit}>
                      Daily Steps (Auto-Tracked 24/7)
                    </Text>
                  </View>
                </View>
              </View>

              {/* 4-Tile Secondary Biometric Telemetry Matrix */}
              <View style={styles.telemetryGrid}>
                {/* 1. Exertion Load & Intensity */}
                <View style={styles.telemetryCell}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Zap size={14} color="#10b981" />
                    <Text style={styles.telemetryLabel}>Exertion Load</Text>
                  </View>
                  <Text style={styles.telemetryValue}>
                    {watchMetrics.cadenceSpm > 0 ? (
                      watchMetrics.currentIntensity.toUpperCase()
                    ) : (
                      "REST"
                    )}
                  </Text>
                  <View style={[styles.zoneBadge, { backgroundColor: getZoneColor(watchMetrics.heartRateZone) + "20" }]}>
                    <Text style={[styles.zoneBadgeText, { color: getZoneColor(watchMetrics.heartRateZone) }]}>
                      {watchMetrics.cadenceSpm > 0
                        ? `ZONE ${watchMetrics.heartRateZone} INTENSITY`
                        : "STATIONARY • AT REST"}
                    </Text>
                  </View>
                </View>

                {/* 2. Active Calories Burned */}
                <View style={styles.telemetryCell}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Flame size={14} color="#f59e0b" />
                    <Text style={styles.telemetryLabel}>Active Burn</Text>
                  </View>
                  <Text style={styles.telemetryValue}>
                    {watchMetrics.isActive ? watchMetrics.activeCalories : stepsCaloriesBurned} <Text style={styles.telemetryUnit}>kcal</Text>
                  </Text>
                  <Text style={styles.telemetrySub}>
                    {watchMetrics.isActive ? `${watchMetrics.currentMet} METs power` : `${totalActiveCaloriesBurned} total day kcal`}
                  </Text>
                </View>

                {/* 3. Cadence / Tempo */}
                <View style={styles.telemetryCell}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Footprints size={14} color="#10b981" />
                    <Text style={styles.telemetryLabel}>Cadence / Tempo</Text>
                  </View>
                  <Text style={styles.telemetryValue}>
                    {watchMetrics.isActive && watchMetrics.mode === "strength_reps"
                      ? `${watchMetrics.reps} reps`
                      : `${watchMetrics.cadenceSpm}`} <Text style={styles.telemetryUnit}>SPM</Text>
                  </Text>
                  <Text style={styles.telemetrySub}>Peak G: {watchMetrics.peakGForce}G</Text>
                </View>

                {/* 4. Distance & Pace */}
                <View style={styles.telemetryCell}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <Compass size={14} color="#3b82f6" />
                    <Text style={styles.telemetryLabel}>Distance & Pace</Text>
                  </View>
                  <Text style={styles.telemetryValue}>
                    {watchMetrics.isActive ? watchMetrics.distanceKm : (stepsToday * 0.00075).toFixed(2)} <Text style={styles.telemetryUnit}>km</Text>
                  </Text>
                  <Text style={styles.telemetrySub}>
                    {watchMetrics.isActive ? `${watchMetrics.paceMinKm} pace` : `${stepsToday > 0 ? "Continuous daily walk" : "Stationary"}`}
                  </Text>
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

              {/* Autonomous Motion Auto-Detection Info Footer */}
              <View style={styles.autoMotionHintRow}>
                <Sparkles size={14} color="#10b981" />
                <Text style={styles.autoMotionHintText}>
                  Outdoor strides are tracked 24/7 in the background — even when the app is closed or screen is off.
                </Text>
              </View>
            </View>

            {/* Battery Optimization Exemption Banner (Android 24/7 background durability) */}
            {bgTrackingInfo.isNative && bgTrackingInfo.hasPermission && !bgTrackingInfo.isBatteryIgnored && (
              <Pressable style={styles.batteryOptBanner} onPress={handleRequestBatteryOptimization}>
                <View style={styles.batteryOptIconBox}>
                  <BatteryCharging size={18} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.batteryOptTitle}>Allow Unrestricted Background Battery</Text>
                  <Text style={styles.batteryOptSub}>
                    Tap to prevent Android from suspending the hardware step counter when your screen is locked.
                  </Text>
                </View>
                <ChevronRight size={18} color="#94a3b8" />
              </Pressable>
            )}

            {/* Step & Calorie Motion Source Priority Control Card */}
            <View style={styles.sourceControlCard}>
              <View style={styles.sourceControlHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={[styles.sourceIconBox, isWearableActive && styles.sourceIconBoxWearable]}>
                    {isWearableActive ? (
                      <Watch size={20} color="#38bdf8" />
                    ) : (
                      <Smartphone size={20} color="#10b981" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sourceControlTitle}>Step & Calorie Source Priority</Text>
                    <Text style={[styles.sourceControlStatus, isWearableActive && { color: "#38bdf8" }]}>
                      {isWearableActive
                        ? `⌚ Active: Wearable (${connectedDevice?.name || "Connected Device"})`
                        : "📱 Active: Phone Accelerometer (Always ON)"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Toggle Row */}
              <View style={styles.sourceSwitchRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.sourceSwitchLabel}>Extract Steps & Calories from Wearables</Text>
                  <Text style={styles.sourceSwitchDesc}>
                    {extractFromWearable
                      ? "When a wearable is connected, phone pedometer auto-pauses to prevent double-counting."
                      : "Always track steps using phone hardware accelerometer regardless of wearable status."}
                  </Text>
                </View>
                <Switch
                  value={extractFromWearable}
                  onValueChange={toggleExtractFromWearable}
                  trackColor={{ false: "#1e293b", true: "#059669" }}
                  thumbColor={extractFromWearable ? "#10b981" : "#94a3b8"}
                />
              </View>

              {/* Status Indicator Pills */}
              <View style={styles.sourceStatusPillsRow}>
                <View style={[styles.sourceMiniPill, !isWearableActive && styles.sourceMiniPillActive]}>
                  <View style={[styles.sourceMiniDot, !isWearableActive && { backgroundColor: "#10b981" }]} />
                  <Text style={[styles.sourceMiniText, !isWearableActive && { color: "#10b981" }]}>
                    Phone Pedometer: {!isWearableActive ? "24/7 Background Active" : "Paused"}
                  </Text>
                </View>
                <View style={[styles.sourceMiniPill, isWearableActive && styles.sourceMiniPillActiveWearable]}>
                  <View style={[styles.sourceMiniDot, isWearableActive && { backgroundColor: "#38bdf8" }]} />
                  <Text style={[styles.sourceMiniText, isWearableActive && { color: "#38bdf8" }]}>
                    Wearable: {connectedDevice ? (isWearableActive ? "Primary Source" : "Connected (Standby)") : "Not Paired"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Dedicated Treadmill Machine Workout Session Card */}
            <View style={styles.treadmillCard}>
              <View style={styles.treadmillHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={styles.treadmillIconBox}>
                    <Text style={{ fontSize: 24 }}>🏃‍♂️</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.treadmillTitle}>Treadmill Workout Session</Text>
                    <Text style={styles.treadmillSub}>
                      {watchMetrics.isActive && watchMetrics.mode === "treadmill"
                        ? (watchMetrics.isPaused ? "Session Paused • Press Resume" : "Session Active • Recording Indoor Belt Run")
                        : "Indoor gym machine workout • Dedicated session tracker"}
                    </Text>
                  </View>
                </View>
                <View style={styles.indoorBadge}>
                  <Text style={styles.indoorBadgeText}>GYM MACHINE</Text>
                </View>
              </View>

              {/* Treadmill Live Session View (When Active) */}
              {watchMetrics.isActive && watchMetrics.mode === "treadmill" && (
                <View style={styles.treadmillActiveBox}>
                  <View style={styles.treadmillTimerRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Timer size={18} color="#10b981" />
                      <Text style={styles.treadmillTimerVal}>{formatTime(watchMetrics.elapsedSeconds)}</Text>
                    </View>
                    <View style={styles.treadmillLivePill}>
                      <View style={styles.treadmillLiveDot} />
                      <Text style={styles.treadmillLiveText}>
                        {watchMetrics.isPaused ? "PAUSED" : "RECORDING"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.treadmillMetricsGrid}>
                    <View style={styles.treadmillMetricCell}>
                      <Text style={styles.treadmillMetricVal}>{watchMetrics.steps.toLocaleString()}</Text>
                      <Text style={styles.treadmillMetricLabel}>Session Steps</Text>
                    </View>
                    <View style={styles.treadmillMetricCell}>
                      <Text style={styles.treadmillMetricVal}>{watchMetrics.distanceKm} <Text style={{ fontSize: 11 }}>km</Text></Text>
                      <Text style={styles.treadmillMetricLabel}>Distance</Text>
                    </View>
                    <View style={styles.treadmillMetricCell}>
                      <Text style={styles.treadmillMetricVal}>{watchMetrics.activeCalories} <Text style={{ fontSize: 11 }}>kcal</Text></Text>
                      <Text style={styles.treadmillMetricLabel}>Active Burn</Text>
                    </View>
                    <View style={styles.treadmillMetricCell}>
                      <Text style={styles.treadmillMetricVal}>{watchMetrics.cadenceSpm} <Text style={{ fontSize: 11 }}>SPM</Text></Text>
                      <Text style={styles.treadmillMetricLabel}>Pace: {watchMetrics.paceMinKm}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Treadmill Session Control Buttons */}
              <View style={styles.treadmillControlsRow}>
                {!(watchMetrics.isActive && watchMetrics.mode === "treadmill") ? (
                  <Pressable style={styles.startTreadmillBtn} onPress={handleStartTreadmill}>
                    <Play size={18} color="#050b08" fill="#050b08" style={{ marginRight: 8 }} />
                    <Text style={styles.startTreadmillText}>START TREADMILL WORKOUT</Text>
                  </Pressable>
                ) : (
                  <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
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
                  </View>
                )}
              </View>
            </View>

            {/* All-Day Accelerometer Pedometer Live Card */}
            <View style={styles.allDayStepCard}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={[styles.pedometerIconBox, isWearableActive && { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
                    {isWearableActive ? (
                      <Watch size={22} color="#38bdf8" />
                    ) : (
                      <Footprints size={22} color="#10b981" />
                    )}
                  </View>
                  <View>
                    <Text style={styles.allDayStepsLabel}>
                      {isWearableActive ? `Wearable Steps (${connectedDevice?.name || "Sync"})` : "Phone Pedometer (Daily Total)"}
                    </Text>
                    <Text style={styles.allDayStepsSub}>
                      {isWearableActive
                        ? "Extracted directly from connected BLE wearable"
                        : "Continuously counted 24/7 via phone accelerometer"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.allDayStepsVal}>{stepsToday.toLocaleString()}</Text>
              </View>
              <View style={styles.pedometerProgressBar}>
                <View style={[styles.pedometerProgressFill, isWearableActive && { backgroundColor: "#38bdf8" }, { width: `${Math.min(100, Math.round((stepsToday / 9000) * 100))}%` }]} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={styles.pedometerFootnote}>{Math.round((stepsToday / 9000) * 100)}% of 9,000 goal</Text>
                <Text style={styles.pedometerFootnote}>{stepsCaloriesBurned} kcal burned</Text>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: WEARABLE BLUETOOTH SYNC (OPENSTRAP EDGE ARCHITECTURE)              */}
        {/* ========================================================================= */}
        {activeMainTab === "wearable" && (
          <View style={{ gap: 16 }}>
            {/* Native Android Bluetooth Permission Status Banner */}
            {blePermissionGranted === false && (
              <View style={styles.blePermissionBanner}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={styles.bleAlertIconBox}>
                    <Bluetooth size={18} color="#f59e0b" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.blePermTitle}>Bluetooth Permission Required</Text>
                    <Text style={styles.blePermDesc}>
                      Android requires Nearby Devices permission to scan and sync smart rings, watches, and bands.
                    </Text>
                  </View>
                </View>
                <Pressable style={styles.bleGrantBtn} onPress={requestBlePermissions}>
                  <Text style={styles.bleGrantBtnText}>Grant Access</Text>
                </Pressable>
              </View>
            )}

            {blePermissionGranted === true && (
              <View style={styles.bleReadyPillRow}>
                <View style={styles.bleReadyDot} />
                <Text style={styles.bleReadyText}>Android Bluetooth Hardware Access Granted • Ready to Pair</Text>
              </View>
            )}

            {/* Active Device Overview Card */}
            <View style={styles.wearableHeroCard}>

              <View style={styles.wearableHeroHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={styles.wearableIconBadge}>
                    <Text style={{ fontSize: 24 }}>
                      {connectedDevice ? connectedDevice.icon : "📡"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.wearableDeviceName} numberOfLines={1}>
                        {connectedDevice ? connectedDevice.name : "No Wearable Connected"}
                      </Text>
                      {connectedDevice && (
                        <View style={styles.connectedPill}>
                          <View style={styles.connectedPillDot} />
                          <Text style={styles.connectedPillText}>CONNECTED</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.wearableBrandSub} numberOfLines={1}>
                      {connectedDevice
                        ? `${connectedDevice.brandName} • Battery: ${connectedDevice.batteryLevel}% • RSSI: ${connectedDevice.rssi} dBm`
                        : "Connect your smartwatch, ring, or fitness strap"}
                    </Text>
                  </View>
                </View>

                {connectedDevice && (
                  <Pressable
                    style={styles.disconnectMiniBtn}
                    onPress={disconnectBleDevice}
                  >
                    <X size={14} color="#94a3b8" />
                  </Pressable>
                )}
              </View>

              {/* Sync Actions Row */}
              <View style={styles.wearableActionRow}>
                <Pressable
                  style={[styles.syncNowBtn, isBleSyncing && { opacity: 0.7 }]}
                  onPress={syncBleNow}
                  disabled={!connectedDevice || isBleSyncing}
                >
                  {isBleSyncing ? (
                    <ActivityIndicator size="small" color="#050b08" />
                  ) : (
                    <>
                      <RefreshCw size={14} color="#050b08" />
                      <Text style={styles.syncNowBtnText}>Sync Telemetry Now</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={styles.scanBleTriggerBtn}
                  onPress={scanBleDevices}
                  disabled={isBleScanning}
                >
                  {isBleScanning ? (
                    <ActivityIndicator size="small" color="#10b981" />
                  ) : (
                    <>
                      <Bluetooth size={14} color="#10b981" />
                      <Text style={styles.scanBleTriggerText}>Scan Devices</Text>
                    </>
                  )}
                </Pressable>
              </View>

              {/* Wearable Step & Calorie Extraction Switch */}
              <View style={[styles.sourceSwitchRow, { marginTop: 12 }]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.sourceSwitchLabel}>Extract Steps & Calories to Daily Total</Text>
                  <Text style={styles.sourceSwitchDesc}>
                    {extractFromWearable
                      ? (connectedDevice ? "Active: Phone pedometer is paused while wearable is connected." : "Enabled: Will pause phone pedometer when connected.")
                      : "Disabled: Phone accelerometer tracks steps 24/7 regardless of wearable."}
                  </Text>
                </View>
                <Switch
                  value={extractFromWearable}
                  onValueChange={toggleExtractFromWearable}
                  trackColor={{ false: "#1e293b", true: "#059669" }}
                  thumbColor={extractFromWearable ? "#10b981" : "#94a3b8"}
                />
              </View>

              {connectedDevice?.lastSyncedAt && (
                <Text style={styles.lastSyncCaption}>
                  Last synchronized: {new Date(connectedDevice.lastSyncedAt).toLocaleTimeString()} • SQLite Cache Updated
                </Text>
              )}
            </View>

            {/* Live Synchronized Telemetry Section */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.wearableSectionTitle}>SYNCHRONIZED WEARABLE METRICS</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: connectedDevice ? "#10b981" : "#64748b" }} />
                <Text style={{ fontSize: 11, color: connectedDevice ? "#10b981" : "#64748b", fontWeight: "700" }}>
                  {connectedDevice ? "Live BLE Stream" : "Standby"}
                </Text>
              </View>
            </View>
            
            <View style={styles.wearableTelemetryGrid}>
              {/* Card 1: Steps */}
              <View style={styles.telemetryCard}>
                <View style={styles.telemetryCardHeader}>
                  <Footprints size={15} color="#10b981" />
                  <Text style={styles.telemetryCardLabel}>DAILY STEPS</Text>
                </View>
                <Text style={styles.telemetryCardVal}>
                  {wearableTel.steps.toLocaleString()}
                </Text>
                <Text style={styles.telemetryCardSub}>
                  {wearableTel.cadenceSpm} SPM • {wearableTel.distanceKm} km
                </Text>
              </View>

              {/* Card 2: Active Calories */}
              <View style={styles.telemetryCard}>
                <View style={styles.telemetryCardHeader}>
                  <Flame size={15} color="#f97316" />
                  <Text style={styles.telemetryCardLabel}>CALORIE BURN</Text>
                </View>
                <Text style={styles.telemetryCardVal}>
                  {wearableTel.activeCalories} <Text style={styles.telemetryUnit}>kcal</Text>
                </Text>
                <Text style={styles.telemetryCardSub}>
                  Total daily: {wearableTel.totalCalories} kcal
                </Text>
              </View>

              {/* Card 3: Sleep Architecture */}
              <View style={styles.telemetryCard}>
                <View style={styles.telemetryCardHeader}>
                  <Moon size={15} color="#a855f7" />
                  <Text style={styles.telemetryCardLabel}>SLEEP RECOVERY</Text>
                </View>
                <Text style={styles.telemetryCardVal}>
                  {wearableTel.sleepDurationHours} <Text style={styles.telemetryUnit}>hrs</Text>
                </Text>
                <Text style={styles.telemetryCardSub}>
                  Score: {wearableTel.sleepScore}% • Deep: {wearableTel.deepSleepPercent}%
                </Text>
              </View>

              {/* Card 4: Heart Rate & Vitals */}
              <View style={styles.telemetryCard}>
                <View style={styles.telemetryCardHeader}>
                  <Heart size={15} color="#ef4444" />
                  <Text style={styles.telemetryCardLabel}>HEART RATE & HRV</Text>
                </View>
                <Text style={styles.telemetryCardVal}>
                  {wearableTel.heartRate} <Text style={styles.telemetryUnit}>BPM</Text>
                </Text>
                <Text style={styles.telemetryCardSub}>
                  RHR: {wearableTel.restingHeartRate} BPM • HRV: {wearableTel.hrvMs} ms
                </Text>
              </View>
            </View>

            {/* Extra Vitals Row: SpO2, Skin Temp, Recovery Score */}
            <View style={styles.vitalsPillRow}>
              <View style={styles.vitalPill}>
                <Text style={styles.vitalPillLabel}>Blood Oxygen</Text>
                <Text style={styles.vitalPillValue}>{wearableTel.spo2Percent}%</Text>
              </View>
              <View style={styles.vitalPill}>
                <Text style={styles.vitalPillLabel}>Skin Temp</Text>
                <Text style={styles.vitalPillValue}>{wearableTel.skinTemperatureC}°C</Text>
              </View>
              <View style={styles.vitalPill}>
                <Text style={styles.vitalPillLabel}>Recovery</Text>
                <Text style={[styles.vitalPillValue, { color: "#10b981" }]}>
                  {wearableTel.recoveryScorePercent}%
                </Text>
              </View>
            </View>

            {/* Wearable Device Pairing & Catalog */}
            <View style={styles.deviceCatalogSection}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionHeaderTitle}>Bluetooth Wearables</Text>
                  <Text style={styles.sectionHeaderSub}>Pair to stream steps, calories & sleep</Text>
                </View>
                <View style={styles.edgeProtocolBadge}>
                  <Text style={styles.edgeProtocolBadgeText}>EDGE BLE ENGINE</Text>
                </View>
              </View>

              {/* Filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {(["all", "ring", "watch", "band", "chest_strap"] as const).map((cat) => (
                    <Pressable
                      key={cat}
                      style={[
                        styles.filterChip,
                        wearableFilter === cat && styles.filterChipActive,
                      ]}
                      onPress={() => setWearableFilter(cat)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          wearableFilter === cat && styles.filterChipTextActive,
                        ]}
                      >
                        {cat === "all" ? "All Devices" : cat === "ring" ? "Smart Rings" : cat === "watch" ? "Smartwatches" : cat === "band" ? "Fitness Bands" : "Heart Straps"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {/* Discovered & Preset devices list */}
              <View style={{ gap: 10, marginTop: 6 }}>
                {discoveredDevices
                  .filter((d) => wearableFilter === "all" || d.deviceType === wearableFilter)
                  .map((device) => {
                    const isCurrent = connectedDevice?.id === device.id;
                    return (
                      <View key={device.id} style={[styles.devicePairCard, isCurrent && styles.devicePairCardActive]}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                          <View style={styles.deviceAvatar}>
                            <Text style={{ fontSize: 20 }}>{device.icon}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={styles.devicePairName}>{device.name}</Text>
                              {isCurrent && (
                                <View style={styles.activeTag}>
                                  <Text style={styles.activeTagText}>SYNCED</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.devicePairBrand}>
                              {device.brandName} • RSSI {device.rssi} dBm • Batt {device.batteryLevel}%
                            </Text>
                            <Text style={styles.deviceFeatureList} numberOfLines={1}>
                              {device.features.join(" • ")}
                            </Text>
                          </View>
                        </View>

                        <Pressable
                          style={[
                            styles.pairActionBtn,
                            isCurrent && styles.pairActionBtnConnected,
                          ]}
                          onPress={() => {
                            if (isCurrent) {
                              disconnectBleDevice();
                            } else {
                              connectBleDevice(device);
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.pairActionBtnText,
                              isCurrent && styles.pairActionBtnTextConnected,
                            ]}
                          >
                            {isCurrent ? "Disconnect" : "Pair & Sync"}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MANUAL LOGGING & WORKOUT CATALOG                                   */}
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
                {insights.insights
                  .filter((ins: any) => !String(ins).toLowerCase().includes("heart"))
                  .map((ins: any, idx: number) => (
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
                  <Text style={styles.summaryCellLabel}>Intensity</Text>
                  <Text style={[styles.summaryCellVal, { color: "#10b981" }]}>{completedWorkoutSummary.currentIntensity.toUpperCase()}</Text>
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

            {/* Distance */}
            <View style={styles.formGroup}>
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

// Intensity zone color helper
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
    backgroundColor: THEME.colors.bgSolid,
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
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: THEME.colors.textOnDarkPrimary,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 2,
  },
  avatarCircleSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1.5,
    borderColor: THEME.colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialSmall: {
    color: THEME.colors.accentTeal,
    fontSize: 13,
    fontWeight: "bold",
  },
  // Tab Bar Switcher
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(11, 22, 19, 0.6)",
    borderRadius: 20,
    padding: 4,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
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
    backgroundColor: "#ffffff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#0e1c18",
    fontWeight: "900",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  // ==========================================
  // FITNESS WATCH HUD STYLES
  // ==========================================
  watchHudCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    padding: 18,
    gap: 16,
  },
  watchHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  watchHudTitle: {
    color: THEME.colors.cardTextPrimary,
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
    color: THEME.colors.cardTextSecondary,
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
    color: THEME.colors.cardTextPrimary,
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
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.55)",
  },
  primaryMetricVal: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 22,
    fontWeight: "900",
  },
  primaryMetricUnit: {
    color: THEME.colors.cardTextSecondary,
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
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.55)",
  },
  telemetryLabel: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  telemetryValue: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 18,
    fontWeight: "900",
  },
  telemetryUnit: {
    color: THEME.colors.cardTextSecondary,
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
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  sensorStreamHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  streamTitle: {
    color: THEME.colors.cardTextPrimary,
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
    color: THEME.colors.cardTextPrimary,
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
    color: THEME.colors.cardTextPrimary,
    fontSize: 14,
    fontWeight: "bold",
  },
  modeSelectorSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
  },
  modeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  modeTile: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.55)",
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
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "bold",
  },
  modeTileTitleActive: {
    color: "#10b981",
  },
  modeTileHint: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    lineHeight: 14,
  },
  // All-Day Pedometer Card
  allDayStepCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
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
    color: THEME.colors.cardTextSecondary,
    fontSize: 13,
    fontWeight: "bold",
  },
  allDayStepsSub: {
    color: "#64748b",
    fontSize: 10,
  },
  allDayStepsVal: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 20,
    fontWeight: "900",
  },
  pedometerProgressBar: {
    height: 8,
    backgroundColor: "rgba(180, 205, 195, 0.35)",
    borderRadius: 4,
    overflow: "hidden",
  },
  pedometerProgressFill: {
    height: "100%",
    backgroundColor: THEME.colors.accentOrange,
    borderRadius: 4,
  },
  pedometerFootnote: {
    color: THEME.colors.cardTextSecondary,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(232, 241, 237, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.25)",
  },
  categoryPillActive: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  categoryPillText: {
    color: THEME.colors.textOnDarkSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  categoryPillTextActive: {
    color: "#0e1c18",
    fontWeight: "900",
  },
  categorySectionCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  secTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  secTitleText: {
    color: THEME.colors.cardTextPrimary,
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
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.55)",
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
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "bold",
  },
  presetTileHint: {
    color: THEME.colors.cardTextSecondary,
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
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
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
    color: THEME.colors.cardTextPrimary,
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
    color: THEME.colors.cardTextPrimary,
    fontSize: 36,
    fontWeight: "900",
  },
  bigBurnLabel: {
    color: THEME.colors.cardTextSecondary,
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
    backgroundColor: "rgba(180, 205, 195, 0.35)",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 6,
  },
  targetProgressFill: {
    height: "100%",
    backgroundColor: THEME.colors.accentOrange,
    borderRadius: 4,
  },
  burnBreakdownGrid: {
    flexDirection: "row",
    gap: 10,
  },
  burnBreakdownBox: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 10,
    borderRadius: 12,
    gap: 2,
  },
  breakdownSub: {
    color: THEME.colors.cardTextSecondary,
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
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
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
    color: THEME.colors.cardTextPrimary,
    fontSize: 22,
    fontWeight: "900",
  },
  gaugeScoreMax: {
    color: "#64748b",
    fontSize: 9,
  },
  gaugeLabel: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 11,
    fontWeight: "bold",
  },
  gaugeStatusText: {
    color: THEME.colors.cardTextSecondary,
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
    backgroundColor: "#ffffff",
    padding: 10,
    borderRadius: 12,
  },
  gaugeExplanationText: {
    flex: 1,
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  insightsCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
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
    color: THEME.colors.cardTextPrimary,
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
    backgroundColor: "#ffffff",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.55)",
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
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "bold",
  },
  activityTime: {
    color: THEME.colors.cardTextSecondary,
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
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    gap: 6,
  },
  emptyTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "bold",
  },
  emptyText: {
    color: THEME.colors.cardTextSecondary,
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
    backgroundColor: THEME.colors.cardBgSolid,
    borderRadius: 24,
    padding: 20,
    gap: 16,
    borderWidth: 1.5,
    borderColor: THEME.colors.cardBorder,
  },
  celebrateHeader: {
    alignItems: "center",
    gap: 6,
  },
  celebrateTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  celebrateSub: {
    color: THEME.colors.cardTextSecondary,
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
    color: THEME.colors.cardTextSecondary,
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  summaryCellVal: {
    color: THEME.colors.cardTextPrimary,
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
    backgroundColor: THEME.colors.cardBgSolid,
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 16,
    fontWeight: "bold",
  },
  modalSub: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  liveDetectedCalorieBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.55)",
  },
  liveCalTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 12,
    fontWeight: "bold",
  },
  liveCalSub: {
    color: THEME.colors.cardTextSecondary,
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
    color: THEME.colors.cardTextPrimary,
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
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: THEME.colors.cardTextPrimary,
    fontSize: 15,
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

  // Wearable BLE Sync Styles
  tabConnectedDot: {
    position: "absolute",
    top: 6,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  wearableHeroCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    gap: 14,
  },
  wearableHeroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wearableIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  wearableDeviceName: {
    fontSize: 16,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
  },
  connectedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.18)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  connectedPillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#10b981",
  },
  connectedPillText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#10b981",
    letterSpacing: 0.5,
  },
  wearableBrandSub: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    marginTop: 2,
  },
  disconnectMiniBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  wearableActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  syncNowBtn: {
    flex: 2,
    height: 44,
    backgroundColor: "#10b981",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  syncNowBtnText: {
    color: "#050b08",
    fontSize: 13,
    fontWeight: "800",
  },
  scanBleTriggerBtn: {
    flex: 1.2,
    height: 44,
    backgroundColor: "#13231c",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  scanBleTriggerText: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "700",
  },
  lastSyncCaption: {
    fontSize: 10,
    color: "#64748b",
    textAlign: "center",
  },
  wearableSectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
    letterSpacing: 0.8,
  },
  wearableTelemetryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  telemetryCard: {
    flex: 1,
    minWidth: "47%",
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    gap: 4,
  },
  telemetryCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  telemetryCardLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
    letterSpacing: 0.6,
  },
  telemetryCardVal: {
    fontSize: 22,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  telemetryCardSub: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  vitalsPillRow: {
    flexDirection: "row",
    gap: 8,
  },
  vitalPill: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.55)",
    alignItems: "center",
  },
  vitalPillLabel: {
    fontSize: 10,
    color: THEME.colors.cardTextSecondary,
    fontWeight: "700",
  },
  vitalPillValue: {
    fontSize: 14,
    color: THEME.colors.cardTextPrimary,
    fontWeight: "800",
    marginTop: 2,
  },
  deviceCatalogSection: {
    backgroundColor: "#070c0a",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 10,
  },
  edgeProtocolBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  edgeProtocolBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#10b981",
    letterSpacing: 0.6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#0d1612",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  filterChipActive: {
    backgroundColor: "#16251e",
    borderColor: "#10b981",
  },
  filterChipText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#10b981",
  },
  devicePairCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    gap: 10,
  },
  devicePairCardActive: {
    borderColor: "rgba(16, 185, 129, 0.4)",
    backgroundColor: "#111f18",
  },
  deviceAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  devicePairName: {
    fontSize: 14,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
  },
  activeTag: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeTagText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#10b981",
  },
  devicePairBrand: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    marginTop: 1,
  },
  deviceFeatureList: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 2,
  },
  pairActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  pairActionBtnConnected: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  pairActionBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#050b08",
  },
  pairActionBtnTextConnected: {
    color: "#94a3b8",
  },
  blePermissionBanner: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  bleAlertIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  blePermTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#f59e0b",
  },
  blePermDesc: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 2,
    lineHeight: 14,
  },
  bleGrantBtn: {
    backgroundColor: "#f59e0b",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  bleGrantBtnText: {
    color: "#050b08",
    fontSize: 11,
    fontWeight: "800",
  },
  bleReadyPillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  bleReadyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  bleReadyText: {
    fontSize: 10,
    color: "#10b981",
    fontWeight: "700",
  },
  sourceControlCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    gap: 12,
  },
  sourceControlHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sourceIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  sourceIconBoxWearable: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
  },
  sourceControlTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
  },
  sourceControlStatus: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10b981",
    marginTop: 2,
  },
  sourceSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  sourceSwitchLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.cardTextPrimary,
  },
  sourceSwitchDesc: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    marginTop: 3,
    lineHeight: 15,
  },
  sourceStatusPillsRow: {
    flexDirection: "row",
    gap: 8,
  },
  sourceMiniPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  sourceMiniPillActive: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  sourceMiniPillActiveWearable: {
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  sourceMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#64748b",
  },
  sourceMiniText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
  },
  autoMotionHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 6,
  },
  autoMotionHintText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "600",
    flex: 1,
  },
  treadmillCard: {
    backgroundColor: THEME.colors.cardBg,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    gap: 12,
  },
  treadmillHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  treadmillIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  treadmillTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
  },
  treadmillSub: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    marginTop: 2,
  },
  indoorBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  indoorBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#10b981",
    letterSpacing: 0.5,
  },
  treadmillActiveBox: {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 14,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  treadmillTimerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  treadmillTimerVal: {
    fontSize: 22,
    fontWeight: "900",
    color: "#f8fafc",
    fontVariant: ["tabular-nums"],
  },
  treadmillLivePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  treadmillLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  treadmillLiveText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10b981",
    letterSpacing: 0.5,
  },
  treadmillMetricsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  treadmillMetricCell: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
  },
  treadmillMetricVal: {
    fontSize: 14,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
  },
  treadmillMetricLabel: {
    fontSize: 9,
    color: THEME.colors.cardTextSecondary,
    marginTop: 2,
    fontWeight: "600",
  },
  treadmillControlsRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  startTreadmillBtn: {
    flex: 1,
    backgroundColor: "#10b981",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  startTreadmillText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#050b08",
    letterSpacing: 0.5,
  },
  bgPermissionAlertCard: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(245, 158, 11, 0.35)",
    borderRadius: 16,
    padding: 16,
  },
  bgAlertIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  bgAlertTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fbbf24",
    marginBottom: 4,
  },
  bgAlertDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: "#cbd5e1",
    marginBottom: 12,
  },
  bgAlertBtn: {
    backgroundColor: "#10b981",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  bgAlertBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#050b08",
    letterSpacing: 0.3,
  },
  batteryOptBanner: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  batteryOptIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  batteryOptTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 2,
  },
  batteryOptSub: {
    fontSize: 11,
    color: "#94a3b8",
    lineHeight: 15,
  },
});

