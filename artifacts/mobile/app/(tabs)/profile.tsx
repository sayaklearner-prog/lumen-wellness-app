import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Platform, Switch } from "react-native";
import { useRouter } from "expo-router";
import { useGetMyProfile, useUpdateMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { storage } from "@/services/storage";
import { Settings, LogOut, ShieldAlert, Award, ShieldCheck } from "lucide-react-native";
import { getBiometricsEnabled, setBiometricsEnabled, isBiometricsSupported } from "@/services/security";
import { syncHealthData } from "@/services/health";

export default function ProfileScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: profile } = useGetMyProfile();
  const updateProfile = useUpdateMyProfile();

  const [name, setName] = useState(profile?.name || "");
  const [mode, setMode] = useState(profile?.mode || "standard");
  const [calories, setCalories] = useState(profile?.dailyCalorieTarget?.toString() || "2100");
  const [steps, setSteps] = useState(profile?.dailyStepsTarget?.toString() || "9000");

  // Biometrics preferences
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsEnabled, setBiometricsActive] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    async function loadSecuritySettings() {
      const supported = await isBiometricsSupported();
      setBiometricsAvailable(supported);
      const active = await getBiometricsEnabled();
      setBiometricsActive(active);
    }
    loadSecuritySettings();
  }, []);

  const handleToggleBiometrics = async (val: boolean) => {
    setBiometricsActive(val);
    await setBiometricsEnabled(val);
  };

  const handleUpdate = async () => {
    try {
      await updateProfile.mutateAsync({
        data: {
          name,
          mode,
          dailyCalorieTarget: parseInt(calories) || 2100,
          dailyStepsTarget: parseInt(steps) || 9000
        }
      });
      qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      alert("Settings updated successfully!");
    } catch {
      alert("Failed to update settings");
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    await syncHealthData();
    setIsSyncing(false);
    alert("Health data synchronized successfully!");
  };

  const handleLogout = async () => {
    await storage.removeItem("lumen_auth_token");
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.removeItem("lumen_authenticated");
    }
    qc.clear();
    router.replace("/(auth)/welcome");
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerSub}>User Settings</Text>
        <Text style={styles.headerTitle}>Bio Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Settings cards */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Profile Details</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Calorie Baseline Target (kcal)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={calories} onChangeText={setCalories} />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Steps Target</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={steps} onChangeText={setSteps} />
          </View>
          <Pressable style={styles.saveBtn} onPress={handleUpdate}>
            <Text style={styles.saveBtnText}>Save Settings</Text>
          </Pressable>
        </View>

        {/* Security & Sync Config */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Security & Synchronization</Text>
          {biometricsAvailable && (
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>Face ID / Biometric Lock</Text>
                <Text style={styles.toggleDesc}>Require verification on application boot.</Text>
              </View>
              <Switch 
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: "#1e293b", true: "#10b981" }}
                thumbColor={biometricsEnabled ? "#050b08" : "#94a3b8"}
              />
            </View>
          )}
          
          <Pressable style={styles.syncBtn} onPress={handleForceSync} disabled={isSyncing}>
            <ShieldCheck size={16} color="#050b08" style={{ marginRight: 6 }} />
            <Text style={styles.syncBtnText}>
              {isSyncing ? "Synchronizing Wearables..." : "Force Native Health Sync"}
            </Text>
          </Pressable>
        </View>

        {/* Privacy / About */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Privacy & Info</Text>
          <View style={styles.infoRow}>
            <ShieldAlert size={16} color="#10b981" />
            <Text style={styles.infoText}>On-Device Database Storage enabled.</Text>
          </View>
          <View style={styles.infoRow}>
            <Award size={16} color="#10b981" />
            <Text style={styles.infoText}>Lumen Health OS premium license active.</Text>
          </View>
        </View>

        {/* Logout */}
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
  card: {
    backgroundColor: "#0b1310",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 24,
    padding: 20,
    gap: 15,
  },
  cardHeader: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "bold",
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    paddingBottom: 10,
  },
  inputGroup: {
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
    borderRadius: 12,
    height: 44,
    color: "#f8fafc",
    paddingHorizontal: 14,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: "#10b981",
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
  },
  saveBtnText: {
    color: "#050b08",
    fontSize: 14,
    fontWeight: "bold",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "bold",
  },
  toggleDesc: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  syncBtn: {
    backgroundColor: "#10b981",
    height: 40,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
  },
  syncBtnText: {
    color: "#050b08",
    fontSize: 13,
    fontWeight: "bold",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  logoutBtn: {
    height: 48,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.03)",
    marginTop: 10,
  },
  logoutBtnText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "bold",
  },
});
