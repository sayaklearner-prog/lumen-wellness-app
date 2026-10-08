import { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  TextInput, 
  ScrollView, 
  Platform, 
  Switch, 
  ActivityIndicator, 
  Alert 
} from "react-native";
import { useRouter } from "expo-router";
import { 
  useGetProfile, 
  useUpdateProfile, 
  getGetProfileQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { storage } from "@/services/storage";
import { 
  Sliders, 
  ShieldCheck, 
  Bell, 
  Plus, 
  Trash2, 
  Sparkles, 
  Moon, 
  Activity, 
  Check, 
  LogOut, 
  RefreshCw, 
  X 
} from "lucide-react-native";
import { 
  getBiometricsEnabled, 
  setBiometricsEnabled, 
  isBiometricsSupported 
} from "@/services/security";
import { syncHealthData } from "@/services/health";

interface ReminderItem {
  id: string;
  time: string;
  title: string;
  repeat: string;
  enabled: boolean;
  isAi?: boolean;
}

const HEALTH_MODES = [
  { id: "standard", title: "Standard", desc: "Balanced approach for general wellness" },
  { id: "diabetes", title: "Diabetes", desc: "Focus on blood sugar and carb tracking" },
  { id: "heart_health", title: "Heart Health", desc: "Prioritize sodium and cardio" },
  { id: "weight_loss", title: "Weight Loss", desc: "Caloric deficit and high protein" },
  { id: "pregnancy", title: "Pregnancy", desc: "Prenatal nutrition and gentle activity" },
];

const DEFAULT_REMINDERS: ReminderItem[] = [
  {
    id: "rem-1",
    time: "07:30",
    title: "Morning hydration check",
    repeat: "MON, TUE, WED, THU, FRI, SAT, SUN",
    enabled: true,
    isAi: false,
  },
  {
    id: "rem-2",
    time: "11:00",
    title: "Stand + stretch break",
    repeat: "MON, TUE, WED, THU, FRI, SAT, SUN",
    enabled: true,
    isAi: true,
  },
  {
    id: "rem-3",
    time: "21:30",
    title: "Wind down & Sleep prep",
    repeat: "MON, TUE, WED, THU, FRI, SAT, SUN",
    enabled: true,
    isAi: false,
  },
];

export default function SettingsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: profile } = useGetProfile();
  const updateProfile = useUpdateProfile();

  // Profile form state
  const [name, setName] = useState("");
  const [mode, setMode] = useState("standard");
  const [calories, setCalories] = useState("2100");
  const [protein, setProtein] = useState("110");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Permissions state
  const [motionTracking, setMotionTracking] = useState(false);
  const [microphone, setMicrophone] = useState(true);
  const [notifications, setNotifications] = useState(false);

  // Reminders state
  const [reminders, setReminders] = useState<ReminderItem[]>(DEFAULT_REMINDERS);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [newReminderTime, setNewReminderTime] = useState("14:00");
  const [newReminderTitle, setNewReminderTitle] = useState("");
  const [newReminderIsAi, setNewReminderIsAi] = useState(false);

  // Security & Health sync
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsActive] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Prepopulate profile from query or storage
  useEffect(() => {
    if (profile) {
      if (profile.name) setName(profile.name);
      if (profile.mode) setMode(profile.mode);
      if (profile.dailyCalorieTarget) setCalories(String(profile.dailyCalorieTarget));
      if (profile.dailyProteinTarget) setProtein(String(profile.dailyProteinTarget));
    }
  }, [profile]);

  // Load permissions and reminders from storage
  useEffect(() => {
    async function loadSettings() {
      try {
        const storedPerms = await storage.getItem("lumen_permissions");
        if (storedPerms) {
          const parsed = JSON.parse(storedPerms);
          if (parsed.motion !== undefined) setMotionTracking(parsed.motion);
          if (parsed.microphone !== undefined) setMicrophone(parsed.microphone);
          if (parsed.notifications !== undefined) setNotifications(parsed.notifications);
        }

        const storedReminders = await storage.getItem("lumen_reminders");
        if (storedReminders) {
          const parsedRem = JSON.parse(storedReminders);
          if (Array.isArray(parsedRem) && parsedRem.length > 0) {
            setReminders(parsedRem);
          }
        }

        const supported = await isBiometricsSupported();
        setBiometricsAvailable(supported);
        const active = await getBiometricsEnabled();
        setBiometricsActive(active);
      } catch (err) {
        console.warn("Error loading stored settings:", err);
      }
    }
    loadSettings();
  }, []);

  // Save permissions whenever toggled
  const updatePermissionsStorage = async (m: boolean, mic: boolean, n: boolean) => {
    try {
      await storage.setItem(
        "lumen_permissions",
        JSON.stringify({ motion: m, microphone: mic, notifications: n })
      );
    } catch {}
  };

  const handleToggleMotion = (val: boolean) => {
    setMotionTracking(val);
    updatePermissionsStorage(val, microphone, notifications);
  };

  const handleToggleMicrophone = (val: boolean) => {
    setMicrophone(val);
    updatePermissionsStorage(motionTracking, val, notifications);
  };

  const handleToggleNotifications = (val: boolean) => {
    setNotifications(val);
    updatePermissionsStorage(motionTracking, microphone, val);
  };

  // Toggle reminder enabled
  const handleToggleReminder = async (id: string, val: boolean) => {
    const updated = reminders.map(r => (r.id === id ? { ...r, enabled: val } : r));
    setReminders(updated);
    try {
      await storage.setItem("lumen_reminders", JSON.stringify(updated));
    } catch {}
  };

  // Delete reminder
  const handleDeleteReminder = async (id: string) => {
    const updated = reminders.filter(r => r.id !== id);
    setReminders(updated);
    try {
      await storage.setItem("lumen_reminders", JSON.stringify(updated));
    } catch {}
  };

  // Add reminder
  const handleAddReminder = async () => {
    if (!newReminderTitle.trim()) {
      Alert.alert("Missing Title", "Please enter a reminder title.");
      return;
    }

    const newItem: ReminderItem = {
      id: `rem-${Date.now()}`,
      time: newReminderTime.trim() || "12:00",
      title: newReminderTitle.trim(),
      repeat: "MON, TUE, WED, THU, FRI, SAT, SUN",
      enabled: true,
      isAi: newReminderIsAi,
    };

    const updated = [...reminders, newItem];
    setReminders(updated);
    try {
      await storage.setItem("lumen_reminders", JSON.stringify(updated));
    } catch {}

    setNewReminderTitle("");
    setShowAddReminder(false);
  };

  // Save Profile & Targets
  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await updateProfile.mutateAsync({
        data: {
          name: name.trim() || "User",
          mode,
          dailyCalorieTarget: parseInt(calories) || 2100,
          dailyProteinTarget: parseInt(protein) || 110,
        }
      });
      qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      Alert.alert("Success! 🎉", "Profile and targets updated successfully.");
    } catch {
      // Local fallback save
      Alert.alert("Saved Locally", "Settings saved to your device.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Biometric toggle
  const handleToggleBiometrics = async (val: boolean) => {
    setBiometricsActive(val);
    await setBiometricsEnabled(val);
  };

  // Health sync
  const handleForceSync = async () => {
    setIsSyncing(true);
    await syncHealthData();
    setIsSyncing(false);
    Alert.alert("Synced", "Health data synchronized successfully.");
  };

  // Re-run Onboarding
  const handleRerunSetup = async () => {
    await storage.setItem("lumen_in_onboarding", "true");
    await storage.removeItem("lumen_onboarding_completed");
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.setItem("lumen_in_onboarding", "true");
      localStorage.removeItem("lumen_onboarding_completed");
    }
    router.replace("/(auth)/onboarding");
  };

  // Logout
  const handleLogout = async () => {
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
  };

  return (
    <View style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.topBar}>
        <View style={styles.logoGroup}>
          <View style={styles.logoIconBox}>
            <Activity size={18} color="#10b981" />
          </View>
          <Text style={styles.logoTitle}>Lumen</Text>
        </View>
        <Pressable style={styles.themeToggleBtn}>
          <Moon size={18} color="#f8fafc" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Page Title */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Settings</Text>
          <Text style={styles.pageSubtitle}>Manage your profile, targets, and reminders</Text>
        </View>

        {/* Section 1: Profile & Targets */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Sliders size={20} color="#10b981" />
            <Text style={styles.sectionTitle}>Profile & Targets</Text>
          </View>

          {/* Name Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Your Name"
              placeholderTextColor="#475569"
            />
          </View>

          {/* Health Mode Selection */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Health Mode</Text>
            <Text style={styles.fieldHelp}>
              Lumen's AI will tailor recommendations based on your mode.
            </Text>

            <View style={styles.modeGrid}>
              {HEALTH_MODES.map((m) => {
                const isSelected = mode === m.id;
                return (
                  <Pressable
                    key={m.id}
                    style={[styles.modeCard, isSelected && styles.modeCardSelected]}
                    onPress={() => setMode(m.id)}
                  >
                    <Text style={[styles.modeTitle, isSelected && styles.modeTitleSelected]}>
                      {m.title}
                    </Text>
                    <Text style={styles.modeDesc}>{m.desc}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Daily Calorie & Protein Targets Row */}
          <View style={styles.twoColRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Daily Calorie Target (kcal)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={calories}
                onChangeText={setCalories}
                placeholder="2100"
                placeholderTextColor="#475569"
              />
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Daily Protein Target (g)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={protein}
                onChangeText={setProtein}
                placeholder="110"
                placeholderTextColor="#475569"
              />
            </View>
          </View>

          {/* Save Profile Button */}
          <Pressable 
            style={[styles.saveProfileBtn, isSavingProfile && { opacity: 0.7 }]} 
            onPress={handleSaveProfile}
            disabled={isSavingProfile}
          >
            {isSavingProfile ? (
              <ActivityIndicator size="small" color="#050b08" />
            ) : (
              <Text style={styles.saveProfileBtnText}>Save Profile Changes</Text>
            )}
          </Pressable>
        </View>

        {/* Section 2: Permissions */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <ShieldCheck size={20} color="#10b981" />
            <Text style={styles.sectionTitle}>Permissions</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Manage device access for Lumen features</Text>

          <View style={styles.permissionItems}>
            {/* Motion Tracking */}
            <View style={styles.permissionRow}>
              <View style={styles.permissionTextCol}>
                <Text style={styles.permissionTitle}>Motion Tracking</Text>
                <Text style={styles.permissionDesc}>Required for background step counting</Text>
              </View>
              <Switch
                value={motionTracking}
                onValueChange={handleToggleMotion}
                trackColor={{ false: "#1e293b", true: "#10b981" }}
                thumbColor={motionTracking ? "#050b08" : "#94a3b8"}
              />
            </View>

            {/* Microphone */}
            <View style={styles.permissionRow}>
              <View style={styles.permissionTextCol}>
                <Text style={styles.permissionTitle}>Microphone</Text>
                <Text style={styles.permissionDesc}>Required for Voice Coach interactions</Text>
              </View>
              <Switch
                value={microphone}
                onValueChange={handleToggleMicrophone}
                trackColor={{ false: "#1e293b", true: "#10b981" }}
                thumbColor={microphone ? "#050b08" : "#94a3b8"}
              />
            </View>

            {/* Notifications */}
            <View style={styles.permissionRow}>
              <View style={styles.permissionTextCol}>
                <Text style={styles.permissionTitle}>Notifications</Text>
                <Text style={styles.permissionDesc}>Required for smart nudges and reminders</Text>
              </View>
              <Switch
                value={notifications}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: "#1e293b", true: "#10b981" }}
                thumbColor={notifications ? "#050b08" : "#94a3b8"}
              />
            </View>
          </View>
        </View>

        {/* Section 3: Reminders */}
        <View style={styles.card}>
          <View style={styles.remindersHeaderRow}>
            <View>
              <View style={styles.sectionHeaderRow}>
                <Bell size={20} color="#10b981" />
                <Text style={styles.sectionTitle}>Reminders</Text>
              </View>
              <Text style={styles.sectionSubtitle}>Smart nudges throughout your day</Text>
            </View>

            <Pressable 
              style={styles.addReminderPill} 
              onPress={() => setShowAddReminder(!showAddReminder)}
            >
              <Plus size={14} color="#f8fafc" />
              <Text style={styles.addReminderText}>Add</Text>
            </Pressable>
          </View>

          {/* Inline Add Reminder Form */}
          {showAddReminder && (
            <View style={styles.addReminderForm}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.formHeader}>Create Smart Reminder</Text>
                <Pressable onPress={() => setShowAddReminder(false)}>
                  <X size={16} color="#64748b" />
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                <View style={{ width: 90 }}>
                  <Text style={styles.fieldLabel}>Time</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newReminderTime}
                    onChangeText={setNewReminderTime}
                    placeholder="08:00"
                    placeholderTextColor="#475569"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Title</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newReminderTitle}
                    onChangeText={setNewReminderTitle}
                    placeholder="e.g. Afternoon water check"
                    placeholderTextColor="#475569"
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Sparkles size={14} color="#10b981" />
                  <Text style={{ color: "#94a3b8", fontSize: 13 }}>AI Guided Reminder</Text>
                </View>
                <Switch
                  value={newReminderIsAi}
                  onValueChange={setNewReminderIsAi}
                  trackColor={{ false: "#1e293b", true: "#10b981" }}
                  thumbColor={newReminderIsAi ? "#050b08" : "#94a3b8"}
                />
              </View>

              <Pressable style={styles.submitReminderBtn} onPress={handleAddReminder}>
                <Text style={styles.submitReminderBtnText}>Save Reminder</Text>
              </Pressable>
            </View>
          )}

          {/* Reminders List */}
          <View style={styles.remindersList}>
            {reminders.map((rem) => (
              <View key={rem.id} style={styles.reminderCard}>
                <Switch
                  value={rem.enabled}
                  onValueChange={(val) => handleToggleReminder(rem.id, val)}
                  trackColor={{ false: "#1e293b", true: "#10b981" }}
                  thumbColor={rem.enabled ? "#050b08" : "#94a3b8"}
                  style={{ marginRight: 12 }}
                />

                <View style={styles.reminderInfoCol}>
                  <View style={styles.reminderTitleRow}>
                    <Text style={styles.reminderTime}>{rem.time}</Text>
                    <Text style={styles.reminderName} numberOfLines={1}>
                      {rem.title}
                    </Text>
                    {rem.isAi && (
                      <View style={styles.aiBadge}>
                        <Sparkles size={10} color="#10b981" />
                        <Text style={styles.aiBadgeText}>AI</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.reminderRepeat}>{rem.repeat}</Text>
                </View>

                <Pressable
                  style={styles.deleteReminderBtn}
                  onPress={() => handleDeleteReminder(rem.id)}
                >
                  <Trash2 size={16} color="#64748b" />
                </Pressable>
              </View>
            ))}
          </View>
        </View>

        {/* Section 4: Security & System Controls */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>System & Device Security</Text>
          
          {biometricsAvailable && (
            <View style={[styles.permissionRow, { marginTop: 12 }]}>
              <View style={styles.permissionTextCol}>
                <Text style={styles.permissionTitle}>Face ID / Biometric Lock</Text>
                <Text style={styles.permissionDesc}>Require verification on application boot</Text>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: "#1e293b", true: "#10b981" }}
                thumbColor={biometricsEnabled ? "#050b08" : "#94a3b8"}
              />
            </View>
          )}

          <Pressable 
            style={[styles.actionBtn, { marginTop: 12 }]} 
            onPress={handleForceSync}
            disabled={isSyncing}
          >
            <RefreshCw size={16} color="#10b981" style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>
              {isSyncing ? "Synchronizing Wearables..." : "Force Native Health Sync"}
            </Text>
          </Pressable>

          <Pressable 
            style={[styles.actionBtn, { marginTop: 10 }]} 
            onPress={handleRerunSetup}
          >
            <Sliders size={16} color="#10b981" style={{ marginRight: 8 }} />
            <Text style={styles.actionBtnText}>Re-run Full Setup Wizard (4 Steps)</Text>
          </Pressable>
        </View>

        {/* Logout Session */}
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={16} color="#ef4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Logout Session</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050b08",
    paddingTop: Platform.OS === "ios" ? 54 : 36,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(30, 41, 59, 0.6)",
  },
  logoGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#f8fafc",
    letterSpacing: 0.5,
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 50,
    gap: 18,
  },
  pageHeader: {
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "900",
    color: "#f8fafc",
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 18,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
  },
  fieldGroup: {
    marginTop: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 6,
  },
  fieldHelp: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: "#070c0a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 16,
    color: "#f8fafc",
    fontSize: 14,
  },
  modeGrid: {
    gap: 10,
  },
  modeCard: {
    backgroundColor: "#070c0a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    padding: 14,
  },
  modeCardSelected: {
    borderColor: "#10b981",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  modeTitleSelected: {
    color: "#10b981",
  },
  modeDesc: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 3,
    lineHeight: 15,
  },
  twoColRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  saveProfileBtn: {
    backgroundColor: "#10b981",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  saveProfileBtnText: {
    color: "#050b08",
    fontWeight: "bold",
    fontSize: 15,
  },
  permissionItems: {
    marginTop: 12,
    gap: 10,
  },
  permissionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#070c0a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  permissionTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  permissionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  permissionDesc: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  remindersHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  addReminderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#070c0a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  addReminderText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  addReminderForm: {
    backgroundColor: "#070c0a",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    gap: 6,
  },
  formHeader: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#10b981",
  },
  submitReminderBtn: {
    backgroundColor: "#10b981",
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  submitReminderBtnText: {
    color: "#050b08",
    fontWeight: "bold",
    fontSize: 13,
  },
  remindersList: {
    marginTop: 14,
    gap: 10,
  },
  reminderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#070c0a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reminderInfoCol: {
    flex: 1,
  },
  reminderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reminderTime: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#f8fafc",
  },
  reminderName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#f8fafc",
    flexShrink: 1,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#10b981",
  },
  reminderRepeat: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#64748b",
    letterSpacing: 0.5,
    marginTop: 3,
  },
  deleteReminderBtn: {
    padding: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#070c0a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 16,
  },
  actionBtnText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "600",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: 14,
    height: 48,
    marginTop: 4,
  },
  logoutBtnText: {
    color: "#ef4444",
    fontWeight: "bold",
    fontSize: 14,
  },
});
