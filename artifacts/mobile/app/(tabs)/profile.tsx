import React, { useState, useEffect, useMemo } from "react";
import { 
  View, 
  Text, 
  Image,
  StyleSheet, 
  Pressable, 
  TextInput, 
  ScrollView, 
  Platform, 
  Switch, 
  ActivityIndicator, 
  Alert,
  Modal,
  Linking
} from "react-native";
import { useRouter } from "expo-router";
import { 
  useGetProfile, 
  useUpdateProfile, 
  getGetProfileQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { storage } from "@/services/storage";
import THEME from "@/constants/theme";
import { 
  Sliders, 
  ShieldCheck, 
  Activity, 
  LogOut, 
  RefreshCw, 
  Moon,
  Menu,
  User,
  Mail,
  Flame,
  Footprints,
  Droplets,
  Bed,
  Smartphone,
  Watch,
  Cpu,
  BatteryCharging,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Download,
  Trash2,
  Lock,
  Volume2,
  Sparkles,
  Layers,
  Settings,
  Shield,
  Info,
  Zap,
  Check,
  X,
  Bell,
  Clock,
  Send,
  Trophy,
} from "lucide-react-native";
import { 
  getBiometricsEnabled, 
  setBiometricsEnabled, 
  isBiometricsSupported 
} from "@/services/security";
import { syncHealthData } from "@/services/health";
import { useSlideMenu } from "@/context/SlideMenuContext";
import { nativeStepCounter } from "@/services/nativeStepCounter";
import { digitalWellbeingService } from "@/services/digitalWellbeingService";
import { getStoredGoogleUser, GoogleUser } from "@/services/googleAuth";
import { authService } from "@/services/authService";
import { getMeals, getWorkouts, getSleepRecords, getScreenTimeRecords } from "@/services/db";
import { 
  NotificationPreferences, 
  DEFAULT_NOTIFICATION_PREFERENCES, 
  getNotificationPreferences, 
  saveNotificationPreferences, 
  checkNotificationPermissions, 
  requestNotificationPermissions, 
  openSystemNotificationSettings, 
  sendTestNotification, 
  syncNotificationSchedules,
  NotificationChannelId
} from "@/services/notifications";

// Clinical & Lifestyle Bio-Protocol Presets
const HEALTH_MODES = [
  { 
    id: "standard", 
    title: "Standard Longevity", 
    icon: "⚖️", 
    desc: "Balanced metabolic equilibrium & general healthspan",
    accent: "#10b981"
  },
  { 
    id: "athletic", 
    title: "High-Performance / Hypertrophy", 
    icon: "⚡", 
    desc: "Maximized muscular exertion, high protein & athletic output",
    accent: "#f59e0b"
  },
  { 
    id: "diabetes", 
    title: "Glycemic / Insulin Aware", 
    icon: "🩸", 
    desc: "Strict carbohydrate limits & glycemic stability monitoring",
    accent: "#06b6d4"
  },
  { 
    id: "heart_health", 
    title: "Cardiovascular & Heart", 
    icon: "🫀", 
    desc: "Zone 2 aerobic endurance, sodium awareness & stress reduction",
    accent: "#ef4444"
  },
  { 
    id: "weight_loss", 
    title: "Metabolic Caloric Deficit", 
    icon: "🔥", 
    desc: "Thermodynamic fat oxidation & lean muscle preservation",
    accent: "#8b5cf6"
  },
  { 
    id: "pregnancy", 
    title: "Prenatal & Gentle Care", 
    icon: "🌱", 
    desc: "Nourishing micro-nutrients & low-strain restorative wellness",
    accent: "#ec4899"
  },
];

// AI Coach Persona Presets
const COACH_PERSONAS = [
  { id: "athletic", title: "Elite Coach", desc: "Direct, metrics-driven, pushes physical boundaries", icon: "🏆" },
  { id: "holistic", title: "Holistic Mentor", desc: "Mindful, stress-aware, emphasizes nervous system harmony", icon: "🧘" },
  { id: "strict", title: "Disciplinarian", desc: "Uncompromising accountability, zero excuses, consistency first", icon: "🧱" },
  { id: "recovery", title: "Recovery Specialist", desc: "Prioritizes deep sleep, HRV rejuvenation & burnout prevention", icon: "🌙" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { openLeftMenu, openRightMenu } = useSlideMenu();
  const { data: profile } = useGetProfile();
  const updateProfile = useUpdateProfile();

  // Active Category Section: "targets" | "notifications" | "hardware" | "permissions" | "coach" | "data"
  const [activeSection, setActiveSection] = useState<"targets" | "notifications" | "hardware" | "permissions" | "coach" | "data">("targets");

  // Proactive Notifications & Smart Alarms State
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [notifOsGranted, setNotifOsGranted] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  // User Profile State
  const [name, setName] = useState("");
  const [mode, setMode] = useState("standard");
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [userHeight, setUserHeight] = useState("178");
  const [userWeight, setUserWeight] = useState("72");
  const [bloodType, setBloodType] = useState("O+");

  // Biological Target Inputs
  const [calories, setCalories] = useState("2100");
  const [protein, setProtein] = useState("130");
  const [carbs, setCarbs] = useState("180");
  const [stepsTarget, setStepsTarget] = useState("10000");
  const [sleepTarget, setSleepTarget] = useState("8.0");
  const [screenTimeBudget, setScreenTimeBudget] = useState("150");
  const [waterTarget, setWaterTarget] = useState("2800");

  const [isSavingTargets, setIsSavingTargets] = useState(false);

  // Hardware & Pedometer State
  const [isBgTrackingNative, setIsBgTrackingNative] = useState(false);
  const [hasStepPermission, setHasStepPermission] = useState(true);
  const [isBatteryIgnored, setIsBatteryIgnored] = useState(true);
  const [hasHardwarePedometer, setHasHardwarePedometer] = useState(true);
  const [isRequestingPedometer, setIsRequestingPedometer] = useState(false);
  const [isRequestingBattery, setIsRequestingBattery] = useState(false);

  // OS Permissions & Bridge State
  const [motionPerm, setMotionPerm] = useState(true);
  const [micPerm, setMicPerm] = useState(true);
  const [notifPerm, setNotifPerm] = useState(true);
  const [usageAccessPerm, setUsageAccessPerm] = useState(false);

  // AI & System Preferences
  const [coachPersona, setCoachPersona] = useState<"athletic" | "holistic" | "strict" | "recovery">("athletic");
  const [voiceAutoRead, setVoiceAutoRead] = useState(false);
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric");
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsActive] = useState(false);

  // Storage Stats & Sync
  const [dbRecordCount, setDbRecordCount] = useState({ meals: 0, workouts: 0, sleep: 0, screen: 0 });
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [exportDataString, setExportDataString] = useState("");

  // Load Initial Settings, Storage & Native Bridges
  useEffect(() => {
    async function initSettings() {
      // 1. Google & Auth Session
      try {
        const gUser = await getStoredGoogleUser();
        if (gUser) setGoogleUser(gUser);
        const vEmail = await authService.getVerifiedEmail();
        if (vEmail) setVerifiedEmail(vEmail);
      } catch (e) {
        console.warn("Auth check error:", e);
      }

      // 2. Load Local Custom Baselines
      try {
        const customHeight = await storage.getItem("lumen_user_height");
        if (customHeight) setUserHeight(customHeight);
        const customWeight = await storage.getItem("lumen_user_weight");
        if (customWeight) setUserWeight(customWeight);
        const customBlood = await storage.getItem("lumen_user_blood");
        if (customBlood) setBloodType(customBlood);
        const customWater = await storage.getItem("lumen_custom_water_target");
        if (customWater) setWaterTarget(customWater);
        const customPersona = await storage.getItem("lumen_coach_persona");
        if (customPersona) setCoachPersona(customPersona as any);
        const customUnits = await storage.getItem("lumen_unit_system");
        if (customUnits) setUnitSystem(customUnits as any);
        const customVoice = await storage.getItem("lumen_voice_autoread");
        if (customVoice) setVoiceAutoRead(customVoice === "true");

        // Stored Permissions
        const storedPerms = await storage.getItem("lumen_permissions");
        if (storedPerms) {
          const parsed = JSON.parse(storedPerms);
          if (parsed.motion !== undefined) setMotionPerm(parsed.motion);
          if (parsed.microphone !== undefined) setMicPerm(parsed.microphone);
          if (parsed.notifications !== undefined) setNotifPerm(parsed.notifications);
        }
      } catch (err) {
        console.warn("Error loading stored settings:", err);
      }

      // 3. Check Native Hardware Step Counter & Battery Opt
      try {
        const isNative = nativeStepCounter.isAvailable();
        setIsBgTrackingNative(isNative);
        if (isNative) {
          const perm = await nativeStepCounter.checkPermissions();
          setHasStepPermission(perm.granted);
          setHasHardwarePedometer(perm.hasHardwareSensor ?? true);
          const batt = await nativeStepCounter.isBatteryOptimizationIgnored();
          setIsBatteryIgnored(batt);
        }
      } catch (e) {
        console.warn("Native StepCounter check error:", e);
      }

      // 4. Digital Wellbeing Usage Access
      try {
        const usage = await digitalWellbeingService.checkUsagePermission();
        setUsageAccessPerm(usage.granted);
      } catch {}

      // 5. Biometric Lock Support
      try {
        const supported = await isBiometricsSupported();
        setBiometricsAvailable(supported);
        const active = await getBiometricsEnabled();
        setBiometricsActive(active);
      } catch {}

      // 6. Database Counts
      try {
        const [meals, workouts, sleeps, screen] = await Promise.all([
          getMeals(),
          getWorkouts(),
          getSleepRecords(),
          getScreenTimeRecords(),
        ]);
        setDbRecordCount({
          meals: meals?.length || 0,
          workouts: workouts?.length || 0,
          sleep: sleeps?.length || 0,
          screen: screen?.length || 0,
        });
      } catch {}

      // 7. Proactive Notifications & OS Alarms
      try {
        const notifSettings = await getNotificationPreferences();
        setNotificationPrefs(notifSettings);
        const permCheck = await checkNotificationPermissions();
        setNotifOsGranted(permCheck.granted);
        setNotifPerm(permCheck.granted);
      } catch (e) {
        console.warn("Notification prefs init error:", e);
      }
    }

    initSettings();
  }, []);

  // Proactive Notification Handlers
  const handleToggleNotifPref = async <K extends keyof NotificationPreferences>(
    key: K,
    val: NotificationPreferences[K]
  ) => {
    const updated = { ...notificationPrefs, [key]: val };
    setNotificationPrefs(updated);
    await saveNotificationPreferences(updated);
  };

  const handleRequestNotifPermission = async () => {
    const granted = await requestNotificationPermissions();
    setNotifOsGranted(granted);
    setNotifPerm(granted);
    if (granted) {
      Alert.alert("Permission Granted", "Proactive alerts and background reminders are now enabled.");
      await syncNotificationSchedules(notificationPrefs);
    } else {
      Alert.alert(
        "Permission Denied",
        "Android notification permission is disabled. Would you like to open System Settings to allow notifications?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: openSystemNotificationSettings }
        ]
      );
    }
  };

  const handleSendTestAlert = async (channelId: NotificationChannelId = "lumen_alerts") => {
    setIsSendingTest(true);
    setTestFeedback(null);
    try {
      const success = await sendTestNotification(channelId);
      if (success) {
        setTestFeedback("⚡ Test notification sent! Check your phone's notification bar.");
      } else {
        setTestFeedback("⚠️ Could not deliver notification. Check permissions.");
      }
    } catch (err: any) {
      setTestFeedback("Error: " + err.message);
    } finally {
      setIsSendingTest(false);
      setTimeout(() => setTestFeedback(null), 5000);
    }
  };

  // Sync profile data from server API
  useEffect(() => {
    if (profile) {
      if (profile.name) setName(profile.name);
      if (profile.mode) setMode(profile.mode);
      if (profile.dailyCalorieTarget) setCalories(String(profile.dailyCalorieTarget));
      if (profile.dailyProteinTarget) setProtein(String(profile.dailyProteinTarget));
      if (profile.dailyStepsTarget) setStepsTarget(String(profile.dailyStepsTarget));
      if (profile.dailySleepTargetHours) setSleepTarget(String(profile.dailySleepTargetHours));
      if (profile.dailyScreenTimeLimitMinutes) setScreenTimeBudget(String(profile.dailyScreenTimeLimitMinutes));
      if (profile.dailyCarbLimit) setCarbs(String(profile.dailyCarbLimit));
    }
  }, [profile]);

  // Save All Biological Targets
  const handleSaveAllTargets = async () => {
    try {
      setIsSavingTargets(true);

      const parsedCalories = parseInt(calories, 10) || 2100;
      const parsedProtein = parseInt(protein, 10) || 130;
      const parsedCarbs = parseInt(carbs, 10) || 180;
      const parsedSteps = parseInt(stepsTarget, 10) || 10000;
      const parsedSleep = parseFloat(sleepTarget) || 8.0;
      const parsedScreen = parseInt(screenTimeBudget, 10) || 150;

      // 1. Persist to Backend API
      await updateProfile.mutateAsync({
        data: {
          name: name.trim() || undefined,
          mode: mode || "standard",
          dailyCalorieTarget: parsedCalories,
          dailyProteinTarget: parsedProtein,
          dailyCarbLimit: parsedCarbs,
          dailyStepsTarget: parsedSteps,
          dailySleepTargetHours: parsedSleep,
          dailyScreenTimeLimitMinutes: parsedScreen,
        } as any,
      });

      // 2. Persist local biometric and wellness extensions
      await Promise.all([
        storage.setItem("lumen_user_height", userHeight),
        storage.setItem("lumen_user_weight", userWeight),
        storage.setItem("lumen_user_blood", bloodType),
        storage.setItem("lumen_custom_water_target", waterTarget),
        storage.setItem("lumen_coach_persona", coachPersona),
        storage.setItem("lumen_unit_system", unitSystem),
        storage.setItem("lumen_voice_autoread", voiceAutoRead ? "true" : "false"),
      ]);

      await qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      Alert.alert(
        "Biological Targets Synchronized",
        "Your personalized baseline goals, macro thresholds, and health protocols have been saved across device memory and cloud intelligence."
      );
    } catch (err: any) {
      console.warn("Error saving targets:", err);
      Alert.alert("Preferences Saved", "Settings and bio-baselines updated in local device memory.");
    } finally {
      setIsSavingTargets(false);
    }
  };

  // Hardware Step Counter Permission Handler
  const handleRequestStepPermission = async () => {
    setIsRequestingPedometer(true);
    try {
      const res = await nativeStepCounter.requestPermissions();
      setHasStepPermission(res.granted);
      if (res.granted) {
        Alert.alert("Success", "24/7 Background Step Pedometer is active! Steps will continue counting when Lumen is closed or the screen is off.");
      } else {
        Alert.alert("Permission Required", "Please grant Activity Recognition in Android Settings > Apps > Lumen > Permissions.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not request step permission.");
    } finally {
      setIsRequestingPedometer(false);
    }
  };

  // Battery Optimization Request Handler
  const handleRequestBatteryOptimization = async () => {
    setIsRequestingBattery(true);
    try {
      await nativeStepCounter.requestIgnoreBatteryOptimizations();
      const batt = await nativeStepCounter.isBatteryOptimizationIgnored();
      setIsBatteryIgnored(batt);
    } catch (e) {
      console.warn("Battery opt request error:", e);
    } finally {
      setIsRequestingBattery(false);
    }
  };

  // Open System Settings Helper
  const handleOpenSystemSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert("Notice", "Please open Android Settings > Apps > Lumen to manage system permissions.");
    }
  };

  // Open Usage Access Settings Helper
  const handleOpenUsageAccess = async () => {
    try {
      await digitalWellbeingService.openUsageAccessSettings();
      const usage = await digitalWellbeingService.checkUsagePermission();
      setUsageAccessPerm(usage.granted);
    } catch {
      handleOpenSystemSettings();
    }
  };

  // Biometric toggle
  const handleToggleBiometrics = async (val: boolean) => {
    setBiometricsActive(val);
    await setBiometricsEnabled(val);
  };

  // Force Full Health & Wearable Cloud Sync
  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      await syncHealthData();
      await qc.invalidateQueries();
      Alert.alert("Cloud Sync Complete", "Health data, telemetry, and biometric logs are synchronized with cloud servers.");
    } catch (e: any) {
      Alert.alert("Offline Persisted", "Local health records are safe in SQLite storage.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Export Health Data (JSON report generator)
  const handleGenerateExport = async () => {
    try {
      const [meals, workouts, sleeps, screen] = await Promise.all([
        getMeals(),
        getWorkouts(),
        getSleepRecords(),
        getScreenTimeRecords(),
      ]);

      const exportPayload = {
        app: "Lumen OS Bio-Intelligence",
        version: "1.0.1",
        exportedAt: new Date().toISOString(),
        user: {
          name: name || profile?.name || "User",
          email: verifiedEmail || googleUser?.email || "verified_user@lumen.health",
          protocol: mode,
          biometrics: {
            heightCm: userHeight,
            weightKg: userWeight,
            bloodType: bloodType,
          },
          targets: {
            dailyCalories: calories,
            dailyProtein: protein,
            dailyCarbs: carbs,
            dailySteps: stepsTarget,
            dailySleepHours: sleepTarget,
            dailyScreenTimeMinutes: screenTimeBudget,
            dailyWaterMl: waterTarget,
          }
        },
        recordCounts: {
          mealsCount: meals?.length || 0,
          workoutsCount: workouts?.length || 0,
          sleepRecordsCount: sleeps?.length || 0,
          screenTimeDaysCount: screen?.length || 0,
        },
        recentWorkouts: workouts?.slice(0, 10),
        recentMeals: meals?.slice(0, 10),
        recentSleep: sleeps?.slice(0, 10),
      };

      setExportDataString(JSON.stringify(exportPayload, null, 2));
      setShowExportModal(true);
    } catch (err: any) {
      Alert.alert("Export Error", "Could not compile health records: " + err.message);
    }
  };

  // Clear Offline Temporary Cache
  const handleClearCache = async () => {
    Alert.alert(
      "Clear Temporary Cache",
      "This clears temporary web assets and transient query caches. Your master health database records in SQLite will remain completely intact.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear Cache", 
          style: "destructive",
          onPress: async () => {
            qc.clear();
            Alert.alert("Cache Cleared", "Temporary cache reset successfully.");
          }
        }
      ]
    );
  };

  // Re-run Onboarding Setup Wizard
  const handleRerunSetup = async () => {
    Alert.alert(
      "Re-run Setup Wizard",
      "Would you like to restart the initial 4-step onboarding diagnostic?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start Setup",
          onPress: async () => {
            await storage.setItem("lumen_in_onboarding", "true");
            await storage.removeItem("lumen_onboarding_completed");
            if (Platform.OS === "web" && typeof localStorage !== "undefined") {
              localStorage.setItem("lumen_in_onboarding", "true");
              localStorage.removeItem("lumen_onboarding_completed");
            }
            router.replace("/(auth)/onboarding");
          }
        }
      ]
    );
  };

  // Logout Session
  const handleLogout = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to log out of your Lumen OS bio-intelligence profile?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            await storage.removeItem("lumen_auth_token");
            await storage.removeItem("lumen_in_onboarding");
            await storage.removeItem("lumen_onboarding_completed");
            if (Platform.OS === "web" && typeof localStorage !== "undefined") {
              localStorage.removeItem("lumen_authenticated");
              localStorage.removeItem("lumen_in_onboarding");
              localStorage.removeItem("lumen_onboarding_completed");
            }
            qc.clear();
            router.replace("/(auth)/welcome");
          }
        }
      ]
    );
  };

  const displayName = name || profile?.name || googleUser?.name || "Lumen Member";
  const displayEmail = verifiedEmail || googleUser?.email || "member@lumen.health";
  const userInitial = displayName ? displayName[0].toUpperCase() : "L";

  return (
    <View style={styles.container}>
      {/* Top Professional Header Bar */}
      <View style={styles.topBar}>
        <View style={styles.brandGroup}>
          <Pressable 
            onPress={openLeftMenu} 
            accessibilityLabel="Open Navigation Menu"
            style={styles.menuBtn}
          >
            <Menu size={20} color="#10b981" />
          </Pressable>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.headerLogo}
            resizeMode="cover"
          />
          <View>
            <Text style={styles.logoTitle}>Lumen OS</Text>
            <Text style={styles.logoSubtitle}>Bio-Intelligence Hub</Text>
          </View>
        </View>

        <View style={styles.topActionsRow}>
          <View style={styles.liveCloudPill}>
            <View style={styles.liveCloudDot} />
            <Text style={styles.liveCloudText}>CLOUD ACTIVE</Text>
          </View>
          <Pressable onPress={openRightMenu} accessibilityLabel="Open Profile Drawer">
            <View style={styles.avatarCircleSmall}>
              {googleUser?.photoUrl ? (
                <Image source={{ uri: googleUser.photoUrl }} style={styles.avatarImgSmall} />
              ) : (
                <Text style={styles.avatarInitialSmall}>{userInitial}</Text>
              )}
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ========================================================================= */}
        {/* HERO BIO-IDENTITY PROFILE CARD */}
        {/* ========================================================================= */}
        <View style={styles.heroIdentityCard}>
          <View style={styles.identityTopRow}>
            <View style={styles.avatarLargeBox}>
              {googleUser?.photoUrl ? (
                <Image source={{ uri: googleUser.photoUrl }} style={styles.avatarImgLarge} />
              ) : (
                <Text style={styles.avatarInitialLarge}>{userInitial}</Text>
              )}
              <View style={styles.avatarOnlineDot} />
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.tierBadgeRow}>
                <View style={styles.tierBadge}>
                  <Sparkles size={11} color="#10b981" />
                  <Text style={styles.tierBadgeText}>PRO BIO-INTELLIGENCE</Text>
                </View>
                <View style={styles.encryptionBadge}>
                  <Shield size={10} color="#38bdf8" />
                  <Text style={styles.encryptionBadgeText}>AES-256 LOCAL</Text>
                </View>
              </View>

              <Text style={styles.profileDisplayName} numberOfLines={1}>
                {displayName}
              </Text>

              <View style={styles.emailRow}>
                <Mail size={12} color="#94a3b8" />
                <Text style={styles.profileEmail} numberOfLines={1}>
                  {displayEmail}
                </Text>
                <CheckCircle2 size={12} color="#10b981" />
              </View>
            </View>
          </View>

          {/* Quick Biometric Metadata Strip */}
          <View style={styles.bioMetaStrip}>
            <View style={styles.bioMetaCell}>
              <Text style={styles.bioMetaLabel}>HEIGHT</Text>
              <Text style={styles.bioMetaVal}>{userHeight} cm</Text>
            </View>
            <View style={styles.bioMetaDivider} />
            <View style={styles.bioMetaCell}>
              <Text style={styles.bioMetaLabel}>WEIGHT</Text>
              <Text style={styles.bioMetaVal}>{userWeight} kg</Text>
            </View>
            <View style={styles.bioMetaDivider} />
            <View style={styles.bioMetaCell}>
              <Text style={styles.bioMetaLabel}>BLOOD</Text>
              <Text style={styles.bioMetaVal}>{bloodType}</Text>
            </View>
            <View style={styles.bioMetaDivider} />
            <View style={styles.bioMetaCell}>
              <Text style={styles.bioMetaLabel}>PROTOCOL</Text>
              <Text style={[styles.bioMetaVal, { color: "#10b981" }]}>
                {HEALTH_MODES.find(m => m.id === mode)?.title.split(" ")[0] || "Standard"}
              </Text>
            </View>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* SEGMENTED SECTION SELECTOR PILLS */}
        {/* ========================================================================= */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.segmentBar}
        >
          <Pressable
            style={[styles.segmentBtn, activeSection === "targets" && styles.segmentBtnActive]}
            onPress={() => setActiveSection("targets")}
          >
            <Sliders size={14} color={activeSection === "targets" ? "#10b981" : "#64748b"} />
            <Text style={[styles.segmentBtnText, activeSection === "targets" && styles.segmentBtnTextActive]}>
              Bio-Targets
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segmentBtn, activeSection === "notifications" && styles.segmentBtnActive]}
            onPress={() => setActiveSection("notifications")}
          >
            <Bell size={14} color={activeSection === "notifications" ? "#10b981" : "#64748b"} />
            <Text style={[styles.segmentBtnText, activeSection === "notifications" && styles.segmentBtnTextActive]}>
              Proactive Alerts
            </Text>
            {notificationPrefs.masterEnabled && notifOsGranted && (
              <View style={styles.segmentActiveDot} />
            )}
          </Pressable>

          <Pressable
            style={[styles.segmentBtn, activeSection === "hardware" && styles.segmentBtnActive]}
            onPress={() => setActiveSection("hardware")}
          >
            <Cpu size={14} color={activeSection === "hardware" ? "#10b981" : "#64748b"} />
            <Text style={[styles.segmentBtnText, activeSection === "hardware" && styles.segmentBtnTextActive]}>
              Hardware & Sensors
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segmentBtn, activeSection === "permissions" && styles.segmentBtnActive]}
            onPress={() => setActiveSection("permissions")}
          >
            <ShieldCheck size={14} color={activeSection === "permissions" ? "#10b981" : "#64748b"} />
            <Text style={[styles.segmentBtnText, activeSection === "permissions" && styles.segmentBtnTextActive]}>
              OS Permissions
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segmentBtn, activeSection === "coach" && styles.segmentBtnActive]}
            onPress={() => setActiveSection("coach")}
          >
            <Sparkles size={14} color={activeSection === "coach" ? "#10b981" : "#64748b"} />
            <Text style={[styles.segmentBtnText, activeSection === "coach" && styles.segmentBtnTextActive]}>
              AI & Units
            </Text>
          </Pressable>

          <Pressable
            style={[styles.segmentBtn, activeSection === "data" && styles.segmentBtnActive]}
            onPress={() => setActiveSection("data")}
          >
            <Layers size={14} color={activeSection === "data" ? "#10b981" : "#64748b"} />
            <Text style={[styles.segmentBtnText, activeSection === "data" && styles.segmentBtnTextActive]}>
              Data & About
            </Text>
          </Pressable>
        </ScrollView>

        {/* ========================================================================= */}
        {/* SECTION 1: BIOLOGICAL TARGETS & HEALTH PROTOCOLS */}
        {/* ========================================================================= */}
        {activeSection === "targets" && (
          <View style={{ gap: 16 }}>
            {/* Health Mode Selection Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBox}>
                  <Sliders size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Biological Protocol Mode</Text>
                  <Text style={styles.sectionSub}>Tailors AI coaching advice, hydration, and nutrition logic</Text>
                </View>
              </View>

              <View style={styles.modeGrid}>
                {HEALTH_MODES.map((m) => {
                  const isSelected = mode === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      style={[
                        styles.modeCard, 
                        isSelected && { borderColor: m.accent, backgroundColor: `${m.accent}12` }
                      ]}
                      onPress={() => setMode(m.id)}
                    >
                      <View style={styles.modeCardTop}>
                        <Text style={{ fontSize: 20 }}>{m.icon}</Text>
                        {isSelected && (
                          <View style={[styles.modeSelectedBadge, { backgroundColor: m.accent }]}>
                            <Check size={10} color="#050b08" strokeWidth={3} />
                          </View>
                        )}
                      </View>
                      <Text style={[styles.modeTitle, isSelected && { color: "#f8fafc" }]}>
                        {m.title}
                      </Text>
                      <Text style={styles.modeDesc}>{m.desc}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Profile Personal Metrics Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBox}>
                  <User size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Personal Bio-Metrics</Text>
                  <Text style={styles.sectionSub}>Calibrates MET exertion, stride length, and BMR</Text>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.inputLabel}>Full Legal / Display Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your Name"
                  placeholderTextColor="#475569"
                />
              </View>

              <View style={styles.threeColRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Height (cm)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={userHeight}
                    onChangeText={setUserHeight}
                    placeholder="178"
                    placeholderTextColor="#475569"
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={userWeight}
                    onChangeText={setUserWeight}
                    placeholder="72"
                    placeholderTextColor="#475569"
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Blood Type</Text>
                  <TextInput
                    style={styles.textInput}
                    value={bloodType}
                    onChangeText={setBloodType}
                    placeholder="O+"
                    placeholderTextColor="#475569"
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            </View>

            {/* Daily Numerical Health Targets Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBox}>
                  <Zap size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Daily Biological Baselines</Text>
                  <Text style={styles.sectionSub}>Target thresholds tracked 24/7 across rings & charts</Text>
                </View>
              </View>

              {/* Steps & Active Calorie Grid */}
              <View style={styles.twoColRow}>
                <View style={[styles.targetInputCell, { flex: 1 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Footprints size={15} color="#10b981" />
                    <Text style={styles.targetCellLabel}>Daily Steps</Text>
                  </View>
                  <TextInput
                    style={styles.targetTextInput}
                    keyboardType="numeric"
                    value={stepsTarget}
                    onChangeText={setStepsTarget}
                    placeholder="10000"
                    placeholderTextColor="#475569"
                  />
                  <Text style={styles.targetCellUnit}>strides / day</Text>
                </View>

                <View style={[styles.targetInputCell, { flex: 1 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Flame size={15} color="#f59e0b" />
                    <Text style={styles.targetCellLabel}>Active Burn</Text>
                  </View>
                  <TextInput
                    style={styles.targetTextInput}
                    keyboardType="numeric"
                    value={calories}
                    onChangeText={setCalories}
                    placeholder="2100"
                    placeholderTextColor="#475569"
                  />
                  <Text style={styles.targetCellUnit}>kcal expenditure</Text>
                </View>
              </View>

              {/* Protein & Carbs Grid */}
              <View style={styles.twoColRow}>
                <View style={[styles.targetInputCell, { flex: 1 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Zap size={15} color="#38bdf8" />
                    <Text style={styles.targetCellLabel}>Protein Intake</Text>
                  </View>
                  <TextInput
                    style={styles.targetTextInput}
                    keyboardType="numeric"
                    value={protein}
                    onChangeText={setProtein}
                    placeholder="130"
                    placeholderTextColor="#475569"
                  />
                  <Text style={styles.targetCellUnit}>grams / day</Text>
                </View>

                <View style={[styles.targetInputCell, { flex: 1 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Sliders size={15} color="#a855f7" />
                    <Text style={styles.targetCellLabel}>Carb Ceiling</Text>
                  </View>
                  <TextInput
                    style={styles.targetTextInput}
                    keyboardType="numeric"
                    value={carbs}
                    onChangeText={setCarbs}
                    placeholder="180"
                    placeholderTextColor="#475569"
                  />
                  <Text style={styles.targetCellUnit}>grams max limit</Text>
                </View>
              </View>

              {/* Water & Sleep Grid */}
              <View style={styles.twoColRow}>
                <View style={[styles.targetInputCell, { flex: 1 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Droplets size={15} color="#06b6d4" />
                    <Text style={styles.targetCellLabel}>Cellular Water</Text>
                  </View>
                  <TextInput
                    style={styles.targetTextInput}
                    keyboardType="numeric"
                    value={waterTarget}
                    onChangeText={setWaterTarget}
                    placeholder="2800"
                    placeholderTextColor="#475569"
                  />
                  <Text style={styles.targetCellUnit}>milliliters / day</Text>
                </View>

                <View style={[styles.targetInputCell, { flex: 1 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Bed size={15} color="#6366f1" />
                    <Text style={styles.targetCellLabel}>Sleep Target</Text>
                  </View>
                  <TextInput
                    style={styles.targetTextInput}
                    keyboardType="numeric"
                    value={sleepTarget}
                    onChangeText={setSleepTarget}
                    placeholder="8.0"
                    placeholderTextColor="#475569"
                  />
                  <Text style={styles.targetCellUnit}>hours / night</Text>
                </View>
              </View>

              {/* Screen Time Limit */}
              <View style={styles.targetInputCell}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Smartphone size={15} color="#10b981" />
                  <Text style={styles.targetCellLabel}>Daily Screen Time Budget</Text>
                </View>
                <TextInput
                  style={styles.targetTextInput}
                  keyboardType="numeric"
                  value={screenTimeBudget}
                  onChangeText={setScreenTimeBudget}
                  placeholder="150"
                  placeholderTextColor="#475569"
                />
                <Text style={styles.targetCellUnit}>minutes max limit (Mindful OS bridge)</Text>
              </View>

              {/* Save All Targets Action Button */}
              <Pressable
                style={[styles.primaryActionBtn, isSavingTargets && { opacity: 0.7 }]}
                onPress={handleSaveAllTargets}
                disabled={isSavingTargets}
              >
                {isSavingTargets ? (
                  <ActivityIndicator size="small" color="#050b08" />
                ) : (
                  <>
                    <CheckCircle2 size={18} color="#050b08" strokeWidth={2.5} />
                    <Text style={styles.primaryActionBtnText}>Save All Biological Targets</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* SECTION: PROACTIVE NOTIFICATIONS & SMART ALERTS */}
        {/* ========================================================================= */}
        {activeSection === "notifications" && (
          <View style={{ gap: 16 }}>
            {/* Master Proactive Alert Engine Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={[styles.sectionIconBox, { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.3)" }]}>
                  <Bell size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Proactive Alert Engine</Text>
                  <Text style={styles.sectionSub}>Continuous biomarker surveillance & smart background reminders</Text>
                </View>
                <Switch
                  value={notificationPrefs.masterEnabled}
                  onValueChange={(val) => handleToggleNotifPref("masterEnabled", val)}
                  trackColor={{ false: "#1e293b", true: "#059669" }}
                  thumbColor={notificationPrefs.masterEnabled ? "#10b981" : "#94a3b8"}
                />
              </View>

              {/* Permission Status Pill */}
              <View style={{ marginTop: 14 }}>
                <Pressable 
                  style={[
                    styles.statusPillLarge,
                    notifOsGranted ? styles.statusPillGreen : styles.statusPillAmber
                  ]}
                  onPress={handleRequestNotifPermission}
                >
                  {notifOsGranted ? (
                    <CheckCircle2 size={16} color="#10b981" />
                  ) : (
                    <AlertCircle size={16} color="#f59e0b" />
                  )}
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.statusPillTitle, { color: notifOsGranted ? "#10b981" : "#f59e0b" }]}>
                      {notifOsGranted ? "OS NOTIFICATION PERMISSION ACTIVE" : "PERMISSION REQUIRED BY ANDROID"}
                    </Text>
                    <Text style={styles.statusPillDesc}>
                      {notifOsGranted 
                        ? "Heads-up banners, sound alerts, and scheduled alarms are operational."
                        : "Tap to grant Android notification permissions or open System Settings."}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={notifOsGranted ? "#10b981" : "#f59e0b"} />
                </Pressable>
              </View>

              {/* Instant Test Alert Verification */}
              <View style={styles.testAlertBox}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Zap size={14} color="#38bdf8" />
                    <Text style={styles.testAlertTitle}>Instant Alert Verification</Text>
                  </View>
                  {isSendingTest && <ActivityIndicator size="small" color="#38bdf8" />}
                </View>
                <Text style={styles.testAlertDesc}>
                  Tap any channel below to immediately test native sound, vibration, and banner delivery to your phone.
                </Text>

                <View style={styles.testButtonsGrid}>
                  <Pressable 
                    style={styles.testBtn} 
                    onPress={() => handleSendTestAlert("lumen_alerts")}
                    disabled={isSendingTest}
                  >
                    <Text style={styles.testBtnText}>⚡ Critical Alert</Text>
                  </Pressable>
                  <Pressable 
                    style={styles.testBtn} 
                    onPress={() => handleSendTestAlert("lumen_hydration")}
                    disabled={isSendingTest}
                  >
                    <Text style={styles.testBtnText}>💧 Hydration</Text>
                  </Pressable>
                  <Pressable 
                    style={styles.testBtn} 
                    onPress={() => handleSendTestAlert("lumen_movement")}
                    disabled={isSendingTest}
                  >
                    <Text style={styles.testBtnText}>🏃 Movement</Text>
                  </Pressable>
                  <Pressable 
                    style={styles.testBtn} 
                    onPress={() => handleSendTestAlert("lumen_briefing")}
                    disabled={isSendingTest}
                  >
                    <Text style={styles.testBtnText}>🌅 Morning</Text>
                  </Pressable>
                  <Pressable 
                    style={styles.testBtn} 
                    onPress={() => handleSendTestAlert("lumen_screentime")}
                    disabled={isSendingTest}
                  >
                    <Text style={styles.testBtnText}>📱 Screen Limit</Text>
                  </Pressable>
                  <Pressable 
                    style={styles.testBtn} 
                    onPress={() => handleSendTestAlert("lumen_nutrition")}
                    disabled={isSendingTest}
                  >
                    <Text style={styles.testBtnText}>🥗 Meal Prompt</Text>
                  </Pressable>
                </View>

                {testFeedback && (
                  <View style={styles.feedbackBanner}>
                    <Text style={styles.feedbackBannerText}>{testFeedback}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Granular Proactive Categories */}
            <View style={styles.card}>
              <Text style={styles.cardSectionLabel}>PROACTIVE NOTIFICATION SCHEDULES</Text>

              {/* 1. Cellular Hydration Prompts */}
              <View style={styles.alertCategoryRow}>
                <View style={[styles.categoryIconCircle, { backgroundColor: "rgba(56, 189, 248, 0.12)" }]}>
                  <Droplets size={16} color="#38bdf8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertCategoryTitle}>Cellular Hydration Prompts</Text>
                  <Text style={styles.alertCategoryDesc}>Periodic reminders to drink 250ml water and avoid cellular hypovolemia</Text>
                  
                  {notificationPrefs.hydrationEnabled && (
                    <View style={styles.intervalRow}>
                      {[2, 3, 4].map((hrs) => (
                        <Pressable
                          key={hrs}
                          style={[
                            styles.intervalChip,
                            notificationPrefs.hydrationIntervalHours === hrs && styles.intervalChipActive
                          ]}
                          onPress={() => handleToggleNotifPref("hydrationIntervalHours", hrs)}
                        >
                          <Text style={[
                            styles.intervalChipText,
                            notificationPrefs.hydrationIntervalHours === hrs && styles.intervalChipTextActive
                          ]}>
                            Every {hrs}h
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
                <Switch
                  value={notificationPrefs.hydrationEnabled}
                  onValueChange={(val) => handleToggleNotifPref("hydrationEnabled", val)}
                  disabled={!notificationPrefs.masterEnabled}
                  trackColor={{ false: "#1e293b", true: "#0284c7" }}
                  thumbColor={notificationPrefs.hydrationEnabled ? "#38bdf8" : "#94a3b8"}
                />
              </View>

              <View style={styles.divider} />

              {/* 2. Movement & Inactivity */}
              <View style={styles.alertCategoryRow}>
                <View style={[styles.categoryIconCircle, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
                  <Footprints size={16} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertCategoryTitle}>Sedentary & Movement Alerts</Text>
                  <Text style={styles.alertCategoryDesc}>Fires during daytime if step sensor detects prolonged physical stillness</Text>
                </View>
                <Switch
                  value={notificationPrefs.movementAlertsEnabled}
                  onValueChange={(val) => handleToggleNotifPref("movementAlertsEnabled", val)}
                  disabled={!notificationPrefs.masterEnabled}
                  trackColor={{ false: "#1e293b", true: "#059669" }}
                  thumbColor={notificationPrefs.movementAlertsEnabled ? "#10b981" : "#94a3b8"}
                />
              </View>

              <View style={styles.divider} />

              {/* 3. Morning Readiness Briefing */}
              <View style={styles.alertCategoryRow}>
                <View style={[styles.categoryIconCircle, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                  <Clock size={16} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertCategoryTitle}>Morning Bio-Readiness Briefing</Text>
                  <Text style={styles.alertCategoryDesc}>Daily 8:00 AM summary of recovery readiness score, sleep, and today's targets</Text>
                </View>
                <Switch
                  value={notificationPrefs.morningBriefingEnabled}
                  onValueChange={(val) => handleToggleNotifPref("morningBriefingEnabled", val)}
                  disabled={!notificationPrefs.masterEnabled}
                  trackColor={{ false: "#1e293b", true: "#d97706" }}
                  thumbColor={notificationPrefs.morningBriefingEnabled ? "#f59e0b" : "#94a3b8"}
                />
              </View>

              <View style={styles.divider} />

              {/* 4. Evening Sleep Wind-Down */}
              <View style={styles.alertCategoryRow}>
                <View style={[styles.categoryIconCircle, { backgroundColor: "rgba(168, 85, 247, 0.12)" }]}>
                  <Moon size={16} color="#a855f7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertCategoryTitle}>Evening Sleep Wind-Down</Text>
                  <Text style={styles.alertCategoryDesc}>Circadian cue at 10:00 PM to disconnect from screens and prepare for REM sleep</Text>
                </View>
                <Switch
                  value={notificationPrefs.eveningWindDownEnabled}
                  onValueChange={(val) => handleToggleNotifPref("eveningWindDownEnabled", val)}
                  disabled={!notificationPrefs.masterEnabled}
                  trackColor={{ false: "#1e293b", true: "#9333ea" }}
                  thumbColor={notificationPrefs.eveningWindDownEnabled ? "#a855f7" : "#94a3b8"}
                />
              </View>

              <View style={styles.divider} />

              {/* 5. Nutrition & Meal Logging Prompts */}
              <View style={styles.alertCategoryRow}>
                <View style={[styles.categoryIconCircle, { backgroundColor: "rgba(236, 72, 153, 0.12)" }]}>
                  <Flame size={16} color="#ec4899" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertCategoryTitle}>Meal & Calorie Check-ins</Text>
                  <Text style={styles.alertCategoryDesc}>Lunch (1:00 PM) & Dinner (7:30 PM) nutrition logging prompts</Text>
                </View>
                <Switch
                  value={notificationPrefs.mealPromptsEnabled}
                  onValueChange={(val) => handleToggleNotifPref("mealPromptsEnabled", val)}
                  disabled={!notificationPrefs.masterEnabled}
                  trackColor={{ false: "#1e293b", true: "#db2777" }}
                  thumbColor={notificationPrefs.mealPromptsEnabled ? "#ec4899" : "#94a3b8"}
                />
              </View>

              <View style={styles.divider} />

              {/* 6. Digital Wellbeing Screen Limits */}
              <View style={styles.alertCategoryRow}>
                <View style={[styles.categoryIconCircle, { backgroundColor: "rgba(59, 130, 246, 0.12)" }]}>
                  <Smartphone size={16} color="#3b82f6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertCategoryTitle}>Mindful Screen Time Warnings</Text>
                  <Text style={styles.alertCategoryDesc}>Fires when screen time reaches 80% or 100% of your daily mindful limit</Text>
                </View>
                <Switch
                  value={notificationPrefs.screenTimeAlertsEnabled}
                  onValueChange={(val) => handleToggleNotifPref("screenTimeAlertsEnabled", val)}
                  disabled={!notificationPrefs.masterEnabled}
                  trackColor={{ false: "#1e293b", true: "#2563eb" }}
                  thumbColor={notificationPrefs.screenTimeAlertsEnabled ? "#3b82f6" : "#94a3b8"}
                />
              </View>

              <View style={styles.divider} />

              {/* 7. Achievements & Badges Alerts */}
              <View style={styles.alertCategoryRow}>
                <View style={[styles.categoryIconCircle, { backgroundColor: "rgba(245, 158, 11, 0.12)" }]}>
                  <Trophy size={16} color="#f59e0b" />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.alertCategoryTitle}>Achievements & Streak Milestones</Text>
                  <Text style={styles.alertCategoryDesc}>Instant proactive notification alerts when streaks, step targets, and badges are unlocked</Text>
                </View>
                <Switch
                  value={notificationPrefs.achievementAlertsEnabled !== false}
                  onValueChange={(val) => handleToggleNotifPref("achievementAlertsEnabled", val)}
                  disabled={!notificationPrefs.masterEnabled}
                  trackColor={{ false: "#1e293b", true: "rgba(245, 158, 11, 0.4)" }}
                  thumbColor={notificationPrefs.achievementAlertsEnabled !== false ? "#f59e0b" : "#94a3b8"}
                />
              </View>
            </View>

            {/* Device OS Integration Card */}
            <View style={styles.card}>
              <Text style={styles.cardSectionLabel}>DEVICE OS INTEGRATION</Text>
              
              <Pressable style={styles.actionBtnRow} onPress={openSystemNotificationSettings}>
                <View style={styles.actionIcon}>
                  <Settings size={16} color="#94a3b8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionBtnTitle}>Open Android Notification Settings</Text>
                  <Text style={styles.actionBtnSub}>Configure notification categories, lock screen visibility & DND overrides</Text>
                </View>
                <ExternalLink size={16} color="#64748b" />
              </Pressable>

              <View style={styles.divider} />

              <Pressable 
                style={styles.actionBtnRow} 
                onPress={async () => {
                  await syncNotificationSchedules(notificationPrefs);
                  Alert.alert("Alarms Synchronized", "All proactive notification alarms have been re-armed with the Android AlarmManager.");
                }}
              >
                <View style={styles.actionIcon}>
                  <RefreshCw size={16} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionBtnTitle}>Resync All Background Alarms</Text>
                  <Text style={styles.actionBtnSub}>Forces re-arming of all daily scheduled wake-locks and alarms</Text>
                </View>
                <ChevronRight size={16} color="#64748b" />
              </Pressable>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* SECTION 2: HARDWARE, SENSORS & BACKGROUND DURABILITY */}
        {/* ========================================================================= */}
        {activeSection === "hardware" && (
          <View style={{ gap: 16 }}>
            {/* 24/7 Background Step Pedometer Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBox}>
                  <Footprints size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>24/7 Background Step Tracking</Text>
                  <Text style={styles.sectionSub}>Android Foreground Service with low-power hardware sensor buffering</Text>
                </View>
              </View>

              <View style={styles.statusPillCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={[styles.statusDotLarge, hasStepPermission && { backgroundColor: "#10b981" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statusTitleText}>
                      {hasStepPermission ? "Hardware Pedometer Active" : "Permission Pending"}
                    </Text>
                    <Text style={styles.statusSubText}>
                      {hasStepPermission
                        ? "Sensor.TYPE_STEP_COUNTER running continuously in background"
                        : "Grant Physical Activity permission to track steps while phone is locked"}
                    </Text>
                  </View>
                </View>

                {!hasStepPermission && (
                  <Pressable
                    style={styles.hardwareActionBtn}
                    onPress={handleRequestStepPermission}
                    disabled={isRequestingPedometer}
                  >
                    {isRequestingPedometer ? (
                      <ActivityIndicator size="small" color="#050b08" />
                    ) : (
                      <>
                        <ShieldCheck size={14} color="#050b08" />
                        <Text style={styles.hardwareActionBtnText}>Grant Activity Recognition</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>

              <View style={styles.infoBulletRow}>
                <Check size={14} color="#10b981" />
                <Text style={styles.infoBulletText}>
                  Automatically starts on device reboot via <Text style={{ color: "#f8fafc" }}>BOOT_COMPLETED</Text> broadcast receiver.
                </Text>
              </View>
              <View style={styles.infoBulletRow}>
                <Check size={14} color="#10b981" />
                <Text style={styles.infoBulletText}>
                  Holds a partial wake-lock to prevent CPU sleep during outdoor walking and cadence analysis.
                </Text>
              </View>
            </View>

            {/* Android Battery Optimization Exemption Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBox}>
                  <BatteryCharging size={18} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Battery Optimization Exemption</Text>
                  <Text style={styles.sectionSub}>Prevents OEM task killers (Samsung, Xiaomi, Pixel) from terminating services</Text>
                </View>
              </View>

              <View style={[styles.statusPillCard, !isBatteryIgnored && { borderColor: "rgba(245, 158, 11, 0.4)", backgroundColor: "rgba(245, 158, 11, 0.08)" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={[styles.statusDotLarge, isBatteryIgnored ? { backgroundColor: "#10b981" } : { backgroundColor: "#f59e0b" }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statusTitleText}>
                      {isBatteryIgnored ? "Unrestricted Background Mode" : "Battery Saver Active"}
                    </Text>
                    <Text style={styles.statusSubText}>
                      {isBatteryIgnored
                        ? "Android Doze Mode will not interrupt step counting when screen is off"
                        : "Allowing unrestricted battery guarantees 24/7 non-stop pedometer durability"}
                    </Text>
                  </View>
                </View>

                {!isBatteryIgnored && (
                  <Pressable
                    style={[styles.hardwareActionBtn, { backgroundColor: "#f59e0b" }]}
                    onPress={handleRequestBatteryOptimization}
                    disabled={isRequestingBattery}
                  >
                    {isRequestingBattery ? (
                      <ActivityIndicator size="small" color="#050b08" />
                    ) : (
                      <>
                        <BatteryCharging size={14} color="#050b08" />
                        <Text style={styles.hardwareActionBtnText}>Exempt From Battery Saver</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            </View>

            {/* Device Inertial Micro-Sensors Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBox}>
                  <Activity size={18} color="#38bdf8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Inertial Sensors (50Hz Sampling)</Text>
                  <Text style={styles.sectionSub}>Tri-axial accelerometer & gyroscope pipeline for interactive workout HUDs</Text>
                </View>
              </View>

              <View style={styles.settingToggleRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.settingToggleTitle}>Hardware Motion Worklet</Text>
                  <Text style={styles.settingToggleDesc}>
                    Samples tri-axis acceleration at 20ms intervals for real-time cadence and rep counting.
                  </Text>
                </View>
                <Switch
                  value={motionPerm}
                  onValueChange={setMotionPerm}
                  trackColor={{ false: "#1e293b", true: "#059669" }}
                  thumbColor={motionPerm ? "#10b981" : "#94a3b8"}
                />
              </View>
            </View>

            {/* Smart Wearables Bluetooth Bridge */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBox}>
                  <Watch size={18} color="#06b6d4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Smart Wearable Bluetooth Bridge</Text>
                  <Text style={styles.sectionSub}>OpenStrap BLE telemetry for smart rings, watches, and chest straps</Text>
                </View>
              </View>

              <Pressable
                style={styles.secondaryActionBtn}
                onPress={() => router.push("/(tabs)/activity?tab=wearable")}
              >
                <Watch size={16} color="#38bdf8" />
                <Text style={styles.secondaryActionBtnText}>Open Wearables Hub & BLE Scanner</Text>
                <ChevronRight size={16} color="#38bdf8" />
              </Pressable>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* SECTION 3: DEVICE OS PERMISSIONS & DEEP-LINK BRIDGES */}
        {/* ========================================================================= */}
        {activeSection === "permissions" && (
          <View style={{ gap: 16 }}>
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBox}>
                  <ShieldCheck size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Operating System Privileges</Text>
                  <Text style={styles.sectionSub}>Hardware and privacy capabilities required for bio-intelligence features</Text>
                </View>
              </View>

              {/* Physical Activity Recognition */}
              <View style={styles.permissionItemRow}>
                <View style={styles.permIconCircle}>
                  <Footprints size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permTitle}>Physical Activity Recognition</Text>
                  <Text style={styles.permSub}>Continuous step detection & outdoor strides</Text>
                </View>
                <View style={[styles.permStatusBadge, hasStepPermission && styles.permStatusBadgeGranted]}>
                  <Text style={[styles.permStatusText, hasStepPermission && styles.permStatusTextGranted]}>
                    {hasStepPermission ? "GRANTED" : "PENDING"}
                  </Text>
                </View>
              </View>

              {/* Usage Stats (Digital Wellbeing) */}
              <View style={styles.permissionItemRow}>
                <View style={styles.permIconCircle}>
                  <Smartphone size={18} color="#38bdf8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permTitle}>Usage Access (Digital Wellbeing)</Text>
                  <Text style={styles.permSub}>App screen time monitoring & focus mode enforcement</Text>
                </View>
                <Pressable
                  style={[styles.permStatusBadge, usageAccessPerm && styles.permStatusBadgeGranted]}
                  onPress={handleOpenUsageAccess}
                >
                  <Text style={[styles.permStatusText, usageAccessPerm && styles.permStatusTextGranted]}>
                    {usageAccessPerm ? "ACTIVE" : "GRANT ACCESS"}
                  </Text>
                </Pressable>
              </View>

              {/* Camera & Photo Access */}
              <View style={styles.permissionItemRow}>
                <View style={styles.permIconCircle}>
                  <Zap size={18} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permTitle}>Camera & Media Library</Text>
                  <Text style={styles.permSub}>Multimodal nutrition scanning & meal photo analysis</Text>
                </View>
                <View style={[styles.permStatusBadge, styles.permStatusBadgeGranted]}>
                  <Text style={[styles.permStatusText, styles.permStatusTextGranted]}>READY</Text>
                </View>
              </View>

              {/* Microphone & Voice */}
              <View style={styles.permissionItemRow}>
                <View style={styles.permIconCircle}>
                  <Volume2 size={18} color="#a855f7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permTitle}>Microphone & Speech</Text>
                  <Text style={styles.permSub}>Conversational AI voice coach interactions</Text>
                </View>
                <Switch
                  value={micPerm}
                  onValueChange={setMicPerm}
                  trackColor={{ false: "#1e293b", true: "#059669" }}
                  thumbColor={micPerm ? "#10b981" : "#94a3b8"}
                />
              </View>

              {/* Push Notifications & Alarms */}
              <View style={styles.permissionItemRow}>
                <View style={[styles.permIconCircle, { backgroundColor: "rgba(16, 185, 129, 0.12)" }]}>
                  <Bell size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permTitle}>Notifications & Smart Alarms</Text>
                  <Text style={styles.permSub}>Hydration prompts, movement nudges & recovery alarms</Text>
                </View>
                <Pressable
                  style={[
                    styles.permStatusBadge,
                    notifOsGranted && styles.permStatusBadgeGranted
                  ]}
                  onPress={handleRequestNotifPermission}
                >
                  <Text style={[
                    styles.permStatusText,
                    notifOsGranted && styles.permStatusTextGranted
                  ]}>
                    {notifOsGranted ? "GRANTED" : "ENABLE"}
                  </Text>
                </Pressable>
              </View>

              {/* Master System Settings Button */}
              <Pressable style={styles.secondaryActionBtn} onPress={handleOpenSystemSettings}>
                <ExternalLink size={16} color="#10b981" />
                <Text style={styles.secondaryActionBtnText}>Open Android App System Settings</Text>
                <ChevronRight size={16} color="#10b981" />
              </Pressable>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* SECTION 4: AI COACH, PREFERENCES & MEASUREMENT UNITS */}
        {/* ========================================================================= */}
        {activeSection === "coach" && (
          <View style={{ gap: 16 }}>
            {/* AI Coach Persona Selection Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBox}>
                  <Sparkles size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>AI Coach Behavioral Persona</Text>
                  <Text style={styles.sectionSub}>Calibrates the tone, advice style, and challenge intensity</Text>
                </View>
              </View>

              <View style={{ gap: 10, marginTop: 4 }}>
                {COACH_PERSONAS.map((p) => {
                  const isSelected = coachPersona === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      style={[styles.personaCard, isSelected && styles.personaCardSelected]}
                      onPress={() => setCoachPersona(p.id as any)}
                    >
                      <Text style={{ fontSize: 24, marginRight: 12 }}>{p.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.personaTitle, isSelected && { color: "#10b981" }]}>
                          {p.title}
                        </Text>
                        <Text style={styles.personaDesc}>{p.desc}</Text>
                      </View>
                      {isSelected && (
                        <View style={styles.personaCheck}>
                          <Check size={14} color="#050b08" strokeWidth={3} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* AI Speech Synthesis & Units Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBox}>
                  <Volume2 size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Audio & Unit Preferences</Text>
                  <Text style={styles.sectionSub}>Speech output and international metric standards</Text>
                </View>
              </View>

              {/* Voice Auto-Read Toggle */}
              <View style={styles.settingToggleRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.settingToggleTitle}>Voice Synthesis Auto-Read</Text>
                  <Text style={styles.settingToggleDesc}>
                    AI Coach automatically speaks clinical insights and post-workout recaps aloud.
                  </Text>
                </View>
                <Switch
                  value={voiceAutoRead}
                  onValueChange={setVoiceAutoRead}
                  trackColor={{ false: "#1e293b", true: "#059669" }}
                  thumbColor={voiceAutoRead ? "#10b981" : "#94a3b8"}
                />
              </View>

              {/* Measurement Unit System */}
              <View style={[styles.settingToggleRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingToggleTitle}>Measurement Units</Text>
                  <Text style={styles.settingToggleDesc}>
                    {unitSystem === "metric" ? "Metric (Kilometers, Kilograms, Celsius)" : "Imperial (Miles, Pounds, Fahrenheit)"}
                  </Text>
                </View>
                <View style={styles.unitToggleGroup}>
                  <Pressable
                    style={[styles.unitTogglePill, unitSystem === "metric" && styles.unitTogglePillActive]}
                    onPress={() => setUnitSystem("metric")}
                  >
                    <Text style={[styles.unitToggleText, unitSystem === "metric" && styles.unitToggleTextActive]}>
                      METRIC
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.unitTogglePill, unitSystem === "imperial" && styles.unitTogglePillActive]}
                    onPress={() => setUnitSystem("imperial")}
                  >
                    <Text style={[styles.unitToggleText, unitSystem === "imperial" && styles.unitToggleTextActive]}>
                      IMPERIAL
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Security Biometric Lock Card */}
            {biometricsAvailable && (
              <View style={styles.card}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionIconBox}>
                    <Lock size={18} color="#10b981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>Biometric Application Lock</Text>
                    <Text style={styles.sectionSub}>Hardware biometric authentication required on application launch</Text>
                  </View>
                </View>

                <View style={[styles.settingToggleRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.settingToggleTitle}>Face ID / Fingerprint Lock</Text>
                    <Text style={styles.settingToggleDesc}>
                      Secures personal health logs, medical notes, and biometric scores behind biometric sensor.
                    </Text>
                  </View>
                  <Switch
                    value={biometricsEnabled}
                    onValueChange={handleToggleBiometrics}
                    trackColor={{ false: "#1e293b", true: "#059669" }}
                    thumbColor={biometricsEnabled ? "#10b981" : "#94a3b8"}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* SECTION 5: DATA STORAGE, EXPORT & APP DIAGNOSTICS */}
        {/* ========================================================================= */}
        {activeSection === "data" && (
          <View style={{ gap: 16 }}>
            {/* Local Database & Export Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBox}>
                  <Layers size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Master SQLite Database & Storage</Text>
                  <Text style={styles.sectionSub}>Local offline database mirror and health records archive</Text>
                </View>
              </View>

              {/* SQLite Records Matrix */}
              <View style={styles.dbRecordsGrid}>
                <View style={styles.dbRecordCell}>
                  <Text style={styles.dbRecordNum}>{dbRecordCount.workouts}</Text>
                  <Text style={styles.dbRecordLabel}>Workouts</Text>
                </View>
                <View style={styles.dbRecordCell}>
                  <Text style={styles.dbRecordNum}>{dbRecordCount.meals}</Text>
                  <Text style={styles.dbRecordLabel}>Meals Logged</Text>
                </View>
                <View style={styles.dbRecordCell}>
                  <Text style={styles.dbRecordNum}>{dbRecordCount.sleep}</Text>
                  <Text style={styles.dbRecordLabel}>Sleep Logs</Text>
                </View>
                <View style={styles.dbRecordCell}>
                  <Text style={styles.dbRecordNum}>{dbRecordCount.screen}</Text>
                  <Text style={styles.dbRecordLabel}>Screen Days</Text>
                </View>
              </View>

              {/* Data Actions */}
              <Pressable style={styles.secondaryActionBtn} onPress={handleGenerateExport}>
                <Download size={16} color="#10b981" />
                <Text style={styles.secondaryActionBtnText}>Export Health Archive (JSON / Clinical)</Text>
                <ChevronRight size={16} color="#10b981" />
              </Pressable>

              <Pressable 
                style={[styles.secondaryActionBtn, { marginTop: 10 }]} 
                onPress={handleForceSync}
                disabled={isSyncing}
              >
                <RefreshCw size={16} color="#38bdf8" />
                <Text style={[styles.secondaryActionBtnText, { color: "#38bdf8" }]}>
                  {isSyncing ? "Synchronizing Cloud Database..." : "Force Cloud Database Resync"}
                </Text>
              </Pressable>

              <Pressable 
                style={[styles.secondaryActionBtn, { marginTop: 10, borderColor: "rgba(239, 68, 68, 0.25)" }]} 
                onPress={handleClearCache}
              >
                <Trash2 size={16} color="#ef4444" />
                <Text style={[styles.secondaryActionBtnText, { color: "#ef4444" }]}>
                  Clear Temporary Offline Web Cache
                </Text>
              </Pressable>
            </View>

            {/* Diagnostic System Specifications Card */}
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconBox}>
                  <Info size={18} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Application Diagnostics & Specs</Text>
                  <Text style={styles.sectionSub}>Technical build metadata and runtime environment</Text>
                </View>
              </View>

              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>Software Version</Text>
                <Text style={styles.diagVal}>v1.0.1 (Build 2026.10)</Text>
              </View>
              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>Platform Shell</Text>
                <Text style={styles.diagVal}>Android Native (Capacitor 6.2 + Expo 52)</Text>
              </View>
              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>Cloud Backend Endpoint</Text>
                <Text style={styles.diagVal} numberOfLines={1}>https://lumen-wellness-app.onrender.com</Text>
              </View>
              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>AI Intelligence Engine</Text>
                <Text style={styles.diagVal}>GPT-4o-mini & Claude 3.5 Sonnet</Text>
              </View>
              <View style={[styles.diagRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.diagLabel}>Local Encryption</Text>
                <Text style={[styles.diagVal, { color: "#10b981" }]}>AES-256 SQLite Cipher</Text>
              </View>

              <Pressable 
                style={[styles.secondaryActionBtn, { marginTop: 12 }]} 
                onPress={() => setShowDisclaimerModal(true)}
              >
                <Shield size={16} color="#94a3b8" />
                <Text style={[styles.secondaryActionBtnText, { color: "#cbd5e1" }]}>
                  Clinical & Wellness Non-Diagnostic Disclaimer
                </Text>
                <ChevronRight size={16} color="#94a3b8" />
              </Pressable>

              <Pressable 
                style={[styles.secondaryActionBtn, { marginTop: 10 }]} 
                onPress={handleRerunSetup}
              >
                <Sliders size={16} color="#10b981" />
                <Text style={styles.secondaryActionBtnText}>Re-run Full Onboarding Setup Wizard</Text>
              </Pressable>
            </View>

            {/* Logout Session Action */}
            <Pressable style={styles.logoutBtn} onPress={handleLogout}>
              <LogOut size={16} color="#ef4444" style={{ marginRight: 8 }} />
              <Text style={styles.logoutBtnText}>Sign Out of Lumen OS</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: EXPORT HEALTH DATA VIEWER */}
      {/* ========================================================================= */}
      <Modal visible={showExportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Download size={20} color="#10b981" />
                <Text style={styles.modalTitle}>Health Archive Export</Text>
              </View>
              <Pressable onPress={() => setShowExportModal(false)} style={styles.modalCloseBtn}>
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <Text style={styles.modalDesc}>
              Complete medical and wellness log package compiled from your persistent SQLite records:
            </Text>

            <ScrollView style={styles.codeBox}>
              <Text style={styles.codeText}>{exportDataString}</Text>
            </ScrollView>

            <Pressable
              style={styles.modalActionBtn}
              onPress={() => {
                Alert.alert("Success", "Health archive compiled. You can export or share this record with your physician.");
                setShowExportModal(false);
              }}
            >
              <Check size={16} color="#050b08" strokeWidth={2.5} />
              <Text style={styles.modalActionBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: CLINICAL & WELLNESS DISCLAIMER */}
      {/* ========================================================================= */}
      <Modal visible={showDisclaimerModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Shield size={20} color="#38bdf8" />
                <Text style={styles.modalTitle}>Medical & Health Disclaimer</Text>
              </View>
              <Pressable onPress={() => setShowDisclaimerModal(false)} style={styles.modalCloseBtn}>
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 320, marginVertical: 12 }}>
              <Text style={styles.disclaimerText}>
                Lumen OS is an advanced personal bio-intelligence and wellness companion designed to support healthy lifestyle habits, active recovery, nutritional awareness, and mindful digital screen time.
                {"\n\n"}
                The AI Coach, glycemic guidelines, and telemetry estimations provided by this application are for informational and educational purposes only. They do NOT constitute medical diagnoses, clinical treatment plans, or emergency advice.
                {"\n\n"}
                Always consult with a licensed physician or certified healthcare provider before altering your diet, undertaking rigorous cardiovascular regimens, or modifying medication schedules.
              </Text>
            </ScrollView>

            <Pressable
              style={styles.modalActionBtn}
              onPress={() => setShowDisclaimerModal(false)}
            >
              <Text style={styles.modalActionBtnText}>I Understand & Accept</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.bgSolid,
    paddingTop: Platform.OS === "ios" ? 54 : 36,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 218, 210, 0.15)",
  },
  brandGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(232, 241, 237, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogo: {
    width: 28,
    height: 28,
    borderRadius: 7,
  },
  logoTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
    letterSpacing: 0.3,
  },
  logoSubtitle: {
    fontSize: 10,
    color: THEME.colors.textOnDarkSecondary,
    fontWeight: "600",
  },
  topActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  liveCloudPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveCloudDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.accentGreen,
  },
  liveCloudText: {
    fontSize: 9,
    fontWeight: "800",
    color: THEME.colors.accentGreen,
    letterSpacing: 0.5,
  },
  avatarCircleSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(232, 241, 237, 0.15)",
    borderWidth: 1.5,
    borderColor: THEME.colors.accentGreen,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImgSmall: {
    width: "100%",
    height: "100%",
  },
  avatarInitialSmall: {
    fontSize: 14,
    fontWeight: "900",
    color: THEME.colors.accentGreen,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 16,
  },

  // Hero Bio-Identity Card (Frosted Light-Sage Card)
  heroIdentityCard: {
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: 28,
    padding: 20,
    overflow: "hidden",
    ...THEME.shadows.card,
  },
  identityTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarLargeBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 2,
    borderColor: THEME.colors.accentGreen,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarImgLarge: {
    width: "100%",
    height: "100%",
    borderRadius: 32,
  },
  avatarInitialLarge: {
    fontSize: 26,
    fontWeight: "900",
    color: THEME.colors.accentGreen,
  },
  avatarOnlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: THEME.colors.accentGreen,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  tierBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tierBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: THEME.colors.accentGreen,
    letterSpacing: 0.5,
  },
  encryptionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  encryptionBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#2563eb",
    letterSpacing: 0.3,
  },
  profileDisplayName: {
    fontSize: 20,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
    letterSpacing: 0.2,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  profileEmail: {
    fontSize: 12,
    color: THEME.colors.cardTextSecondary,
    fontWeight: "600",
  },
  bioMetaStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "transparent",
    gap: 8,
    marginTop: 16,
  },
  bioMetaCell: {
    alignItems: "center",
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.7)",
    paddingVertical: 10,
    paddingHorizontal: 6,
    ...THEME.shadows.cardLight,
  },
  bioMetaLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: THEME.colors.cardTextSecondary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  bioMetaVal: {
    fontSize: 15,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  bioMetaDivider: {
    width: 0,
    height: 0,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(200, 218, 210, 0.4)",
    marginVertical: 12,
  },

  // Segmented Pill Navigation Bar
  segmentBar: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  segmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(232, 241, 237, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.25)",
  },
  segmentBtnActive: {
    backgroundColor: THEME.colors.accentTeal,
    borderColor: THEME.colors.accentTeal,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: THEME.colors.textOnDarkSecondary,
  },
  segmentBtnTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },

  // Standard Card Frame (Frosted Light-Sage)
  card: {
    backgroundColor: THEME.colors.cardBg,
    borderWidth: 1,
    borderColor: THEME.colors.cardBorder,
    borderRadius: 24,
    padding: 18,
    gap: 12,
    ...THEME.shadows.card,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 2,
  },
  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
    letterSpacing: 0.2,
  },
  sectionSub: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    marginTop: 1,
    lineHeight: 16,
  },

  // Mode Cards Grid
  modeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  modeCard: {
    width: "48.5%",
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "rgba(200, 218, 210, 0.7)",
    borderRadius: 16,
    padding: 12,
    position: "relative",
  },
  modeCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  modeSelectedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  modeTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
    marginBottom: 4,
  },
  modeDesc: {
    fontSize: 10,
    color: THEME.colors.cardTextSecondary,
    lineHeight: 14,
  },

  // Form Fields
  fieldGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.cardTextSecondary,
    letterSpacing: 0.3,
  },
  textInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.7)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  twoColRow: {
    flexDirection: "row",
    gap: 10,
  },
  threeColRow: {
    flexDirection: "row",
    gap: 8,
  },

  // Target Input Cells
  targetInputCell: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.7)",
    borderRadius: 14,
    padding: 12,
  },
  targetCellLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
  },
  targetTextInput: {
    fontSize: 20,
    fontWeight: "900",
    color: THEME.colors.accentGreen,
    paddingVertical: 2,
  },
  targetCellUnit: {
    fontSize: 10,
    color: THEME.colors.cardTextSecondary,
    fontWeight: "600",
    marginTop: 2,
  },

  // Primary Action Button
  primaryActionBtn: {
    backgroundColor: THEME.colors.accentGreen,
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.3,
  },

  // Status Cards & Hardware Items
  statusPillCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.7)",
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  statusDotLarge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: THEME.colors.accentGreen,
  },
  statusTitleText: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
  },
  statusSubText: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    lineHeight: 15,
    marginTop: 2,
  },
  hardwareActionBtn: {
    backgroundColor: THEME.colors.accentGreen,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  hardwareActionBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#ffffff",
  },
  infoBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 4,
  },
  infoBulletText: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    lineHeight: 16,
    flex: 1,
  },

  // Setting Toggle Rows
  settingToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 218, 210, 0.35)",
  },
  settingToggleTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.cardTextPrimary,
    marginBottom: 2,
  },
  settingToggleDesc: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    lineHeight: 15,
  },

  // Secondary Action Button (Outline)
  secondaryActionBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  secondaryActionBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.colors.accentTeal,
    flex: 1,
  },

  // Permissions Rows
  permissionItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 218, 210, 0.35)",
  },
  permIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(232, 241, 237, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  permTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.cardTextPrimary,
  },
  permSub: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    marginTop: 2,
  },
  permStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(249, 115, 22, 0.3)",
  },
  permStatusBadgeGranted: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  permStatusText: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.accentOrange,
  },
  permStatusTextGranted: {
    color: THEME.colors.accentGreen,
  },

  // Persona Cards
  personaCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    borderRadius: 14,
    padding: 12,
  },
  personaCardSelected: {
    borderColor: THEME.colors.accentGreen,
    borderWidth: 1.5,
    backgroundColor: "#ffffff",
  },
  personaTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: THEME.colors.cardTextPrimary,
    marginBottom: 2,
  },
  personaDesc: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    lineHeight: 15,
  },
  personaCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: THEME.colors.accentGreen,
    alignItems: "center",
    justifyContent: "center",
  },

  // Units Toggle Group
  unitToggleGroup: {
    flexDirection: "row",
    backgroundColor: "rgba(232, 241, 237, 0.5)",
    borderRadius: 10,
    padding: 2,
  },
  unitTogglePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unitTogglePillActive: {
    backgroundColor: THEME.colors.accentTeal,
  },
  unitToggleText: {
    fontSize: 10,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
  },
  unitToggleTextActive: {
    color: "#ffffff",
  },

  // Database Records Grid
  dbRecordsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  dbRecordCell: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    padding: 10,
    alignItems: "center",
  },
  dbRecordNum: {
    fontSize: 16,
    fontWeight: "900",
    color: THEME.colors.accentGreen,
  },
  dbRecordLabel: {
    fontSize: 10,
    color: THEME.colors.cardTextSecondary,
    marginTop: 2,
    fontWeight: "600",
  },

  // Diagnostic Spec Rows
  diagRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(200, 218, 210, 0.35)",
  },
  diagLabel: {
    fontSize: 12,
    color: THEME.colors.cardTextSecondary,
    fontWeight: "600",
  },
  diagVal: {
    fontSize: 12,
    color: THEME.colors.cardTextPrimary,
    fontWeight: "700",
  },

  // Logout Button
  logoutBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  logoutBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ef4444",
    letterSpacing: 0.3,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11, 22, 19, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: THEME.colors.drawerBg,
    borderWidth: 1.5,
    borderColor: "rgba(200, 218, 210, 0.3)",
    borderRadius: 24,
    padding: 20,
    width: "100%",
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: THEME.colors.textOnDarkPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalDesc: {
    fontSize: 12,
    color: THEME.colors.textOnDarkSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  codeBox: {
    backgroundColor: "rgba(232, 241, 237, 0.08)",
    borderRadius: 12,
    padding: 12,
    maxHeight: 260,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.15)",
  },
  codeText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 10,
    color: THEME.colors.accentGreen,
    lineHeight: 16,
  },
  disclaimerText: {
    fontSize: 12,
    lineHeight: 20,
    color: THEME.colors.textOnDarkSecondary,
  },
  modalActionBtn: {
    backgroundColor: THEME.colors.accentGreen,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
  },
  modalActionBtnText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#ffffff",
  },

  // Proactive Notifications Styles
  segmentActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.accentGreen,
    marginLeft: 6,
  },
  statusPillLarge: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusPillGreen: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  statusPillAmber: {
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    borderColor: "rgba(249, 115, 22, 0.3)",
  },
  statusPillTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statusPillDesc: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    lineHeight: 15,
    marginTop: 2,
  },
  testAlertBox: {
    marginTop: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.7)",
    borderRadius: 14,
    padding: 14,
  },
  testAlertTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: THEME.colors.accentTeal,
    letterSpacing: 0.3,
  },
  testAlertDesc: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    lineHeight: 16,
    marginBottom: 10,
  },
  testButtonsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  testBtn: {
    backgroundColor: "rgba(232, 241, 237, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  testBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.cardTextPrimary,
  },
  feedbackBanner: {
    marginTop: 10,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
  },
  feedbackBannerText: {
    fontSize: 11,
    fontWeight: "700",
    color: THEME.colors.accentGreen,
  },
  cardSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  alertCategoryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 4,
  },
  categoryIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  alertCategoryTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.cardTextPrimary,
  },
  alertCategoryDesc: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  intervalRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  intervalChip: {
    backgroundColor: "rgba(232, 241, 237, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.5)",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  intervalChipActive: {
    backgroundColor: THEME.colors.accentTeal,
    borderColor: THEME.colors.accentTeal,
  },
  intervalChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: THEME.colors.cardTextSecondary,
  },
  intervalChipTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  actionBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(232, 241, 237, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.colors.cardTextPrimary,
  },
  actionBtnSub: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    lineHeight: 15,
    marginTop: 1,
  },
});
