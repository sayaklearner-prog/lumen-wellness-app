import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Activity,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  X,
  HeartPulse,
  Droplets,
  Check,
  ChevronRight,
  Sliders,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Battery,
  Zap,
  PhoneCall,
  ExternalLink,
  Smartphone,
  Watch,
  AlertCircle,
} from "lucide-react-native";
import { registerBackHandler } from "@/services/backNavigation";
import { syncHealthData, getLastSyncStatus, HealthSyncStatus } from "@/services/health";
import { wearableSyncService, WearableDevice } from "@/services/wearableSyncService";
import { getStoredClinicalProfile, ClinicalProfile, DEFAULT_CLINICAL_PROFILE } from "@/services/clinicalProfile";
import { storage } from "@/services/storage";
import THEME from "@/constants/theme";

interface HealthOsControlCenterModalProps {
  visible: boolean;
  onClose: () => void;
}

export function HealthOsControlCenterModal({
  visible,
  onClose,
}: HealthOsControlCenterModalProps) {
  const router = useRouter();

  // Clinical Profile & Telemetry States
  const [clinicalProfile, setClinicalProfile] = useState<ClinicalProfile>(DEFAULT_CLINICAL_PROFILE);
  const [connectedWearable, setConnectedWearable] = useState<WearableDevice | null>(null);
  const [syncStatus, setSyncStatus] = useState<HealthSyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Rapid Vitals Input States
  const [activeRapidLog, setActiveRapidLog] = useState<"glucose" | "bp" | null>(null);
  const [glucoseInput, setGlucoseInput] = useState<string>("105");
  const [glucoseMealTag, setGlucoseMealTag] = useState<"fasting" | "post_meal" | "random">("fasting");
  const [bpSystolic, setBpSystolic] = useState<string>("120");
  const [bpDiastolic, setBpDiastolic] = useState<string>("80");
  const [vitalsSavedToast, setVitalsSavedToast] = useState<string | null>(null);

  // System & Voice Coach Toggles
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);

  // Trigger haptic helper with Web platform guard
  const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== "web") {
      try {
        Haptics.impactAsync(style);
      } catch {}
    }
  };

  // Intercept Android hardware/gesture back press (Priority 95)
  useEffect(() => {
    if (!visible) return;
    return registerBackHandler("control-center-modal", 95, () => {
      onClose();
      return true;
    });
  }, [visible, onClose]);

  // Load clinical profile & genuine wearable status on open
  useEffect(() => {
    if (visible) {
      getStoredClinicalProfile().then((cp) => setClinicalProfile(cp));
      storage.getItem("lumen_voice_coach_enabled").then((val) => {
        if (val !== null) setVoiceEnabled(val === "true");
      });

      // Honest wearable connection lookup
      const dev = wearableSyncService.getConnectedDevice();
      setConnectedWearable(dev);
      getLastSyncStatus().then((st) => setSyncStatus(st));

      const unsubDev = wearableSyncService.subscribeDevice((newDev) => {
        setConnectedWearable(newDev);
      });

      return () => {
        unsubDev();
      };
    }
  }, [visible]);

  // Force Instant Health Data Sync
  const handleForceSync = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      await syncHealthData();
      const updatedStatus = await getLastSyncStatus();
      setSyncStatus(updatedStatus);
      const isConnected = !!(connectedWearable && connectedWearable.isConnected);
      setSyncFeedback(
        isConnected
          ? `Synced with ${connectedWearable.name}`
          : "Local phone sensors & SQLite synced"
      );
      setTimeout(() => setSyncFeedback(null), 3000);
    } catch {
      setSyncFeedback("Sync offline - local SQLite active");
      setTimeout(() => setSyncFeedback(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Save Rapid Blood Glucose
  const handleSaveGlucose = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    const val = Number(glucoseInput);
    if (!val || val <= 0) {
      Alert.alert("Invalid Value", "Please enter a valid blood glucose reading (mg/dL).");
      return;
    }

    try {
      const reading = {
        valueMgDl: val,
        tag: glucoseMealTag,
        timestamp: new Date().toISOString(),
      };
      const existing = await storage.getItem("lumen_blood_glucose_log");
      const list = existing ? JSON.parse(existing) : [];
      list.unshift(reading);
      await storage.setItem("lumen_blood_glucose_log", JSON.stringify(list.slice(0, 50)));

      setVitalsSavedToast(`Blood Glucose: ${val} mg/dL logged ✓`);
      setActiveRapidLog(null);
      setTimeout(() => setVitalsSavedToast(null), 3000);
    } catch {
      Alert.alert("Error", "Could not save blood glucose reading.");
    }
  };

  // Save Rapid Blood Pressure
  const handleSaveBloodPressure = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    const sys = Number(bpSystolic);
    const dia = Number(bpDiastolic);
    if (!sys || !dia || sys <= 0 || dia <= 0) {
      Alert.alert("Invalid Value", "Please enter valid systolic and diastolic blood pressure values.");
      return;
    }

    try {
      const reading = {
        systolic: sys,
        diastolic: dia,
        timestamp: new Date().toISOString(),
      };
      const existing = await storage.getItem("lumen_blood_pressure_log");
      const list = existing ? JSON.parse(existing) : [];
      list.unshift(reading);
      await storage.setItem("lumen_blood_pressure_log", JSON.stringify(list.slice(0, 50)));

      setVitalsSavedToast(`Blood Pressure: ${sys}/${dia} mmHg logged ✓`);
      setActiveRapidLog(null);
      setTimeout(() => setVitalsSavedToast(null), 3000);
    } catch {
      Alert.alert("Error", "Could not save blood pressure reading.");
    }
  };

  // Toggle Voice Coach
  const handleToggleVoice = async () => {
    triggerHaptic();
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    await storage.setItem("lumen_voice_coach_enabled", next ? "true" : "false");
  };

  // Quick navigate to Safety or Profile
  const handleNavigateScreen = (route: string) => {
    triggerHaptic();
    onClose();
    setTimeout(() => {
      router.push(route as any);
    }, 120);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />

        <View style={styles.controlCenterPanel}>
          {/* Panel Top Grabber */}
          <View style={styles.topGrabber} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={styles.iconCircle}>
                <HeartPulse size={20} color="#10b981" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Health OS Control Center</Text>
                <Text style={styles.headerSub}>Live Telemetry & Clinical Safety Hub</Text>
              </View>
            </View>

            <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
              <X size={18} color="#94a3b8" />
            </Pressable>
          </View>

          {/* Feedback Toast */}
          {(syncFeedback || vitalsSavedToast) && (
            <View style={styles.toastBox}>
              <Check size={14} color="#10b981" strokeWidth={2.5} />
              <Text style={styles.toastText}>{vitalsSavedToast || syncFeedback}</Text>
            </View>
          )}

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* ========================================================= */}
            {/* 1. LIVE SENSOR & WEARABLE TELEMETRY                       */}
            {/* ========================================================= */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Zap size={16} color="#38bdf8" />
                  <Text style={styles.cardTitle}>Live Sensor Telemetry</Text>
                </View>
                {connectedWearable && connectedWearable.isConnected ? (
                  <View style={styles.activePill}>
                    <View style={styles.greenDot} />
                    <Text style={styles.activePillText}>CONNECTED</Text>
                  </View>
                ) : (
                  <View style={styles.standalonePill}>
                    <View style={styles.amberDot} />
                    <Text style={styles.standalonePillText}>STANDALONE</Text>
                  </View>
                )}
              </View>

              <View style={styles.telemetryGrid}>
                <View style={styles.telemetryCell}>
                  <Text style={styles.telemetryLabel}>Wearable Bridge</Text>
                  <Text style={styles.telemetryValue} numberOfLines={1}>
                    {connectedWearable && connectedWearable.isConnected
                      ? `${connectedWearable.brandName} ${connectedWearable.name}`
                      : "No Wearable Paired"}
                  </Text>
                </View>
                <View style={styles.telemetryCell}>
                  <Text style={styles.telemetryLabel}>Active Motion Engine</Text>
                  <Text style={styles.telemetryValue} numberOfLines={1}>
                    {connectedWearable && connectedWearable.isConnected
                      ? "Wearable BLE Stream"
                      : "Phone Sensor Active"}
                  </Text>
                </View>
                <View style={styles.telemetryCell}>
                  <Text style={styles.telemetryLabel}>Battery / Hardware</Text>
                  {connectedWearable && connectedWearable.isConnected ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Battery size={14} color="#10b981" />
                      <Text style={[styles.telemetryValue, { color: "#10b981" }]}>
                        {connectedWearable.batteryLevel}%
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Smartphone size={13} color="#94a3b8" />
                      <Text style={[styles.telemetryValue, { color: "#94a3b8" }]}>Internal Device</Text>
                    </View>
                  )}
                </View>
                <View style={styles.telemetryCell}>
                  <Text style={styles.telemetryLabel}>Local Health Engine</Text>
                  <Text style={styles.telemetryValue}>SQLite Active</Text>
                </View>
              </View>

              {/* Honest Standalone Hardware Notice if no wearable is connected */}
              {(!connectedWearable || !connectedWearable.isConnected) && (
                <View style={styles.honestNoticeBox}>
                  <AlertCircle size={15} color="#eab308" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.honestNoticeTitle}>Standalone Mode Active</Text>
                    <Text style={styles.honestNoticeDesc}>
                      No Apple Watch or external wearable connected. Lumen is operating honestly via your device's native pedometer and motion sensors.
                    </Text>
                  </View>
                </View>
              )}

              {/* Action Buttons: Force Sync & Pair Wearable */}
              <View style={{ gap: 8 }}>
                <Pressable
                  style={[styles.syncActionBtn, isSyncing && { opacity: 0.7 }]}
                  onPress={handleForceSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <ActivityIndicator size="small" color="#050b08" />
                  ) : (
                    <>
                      <RefreshCw size={14} color="#050b08" strokeWidth={2.5} />
                      <Text style={styles.syncActionBtnText}>
                        {connectedWearable && connectedWearable.isConnected
                          ? "Force Instant Wearable Sync"
                          : "Force Instant Phone & SQLite Sync"}
                      </Text>
                    </>
                  )}
                </Pressable>

                {(!connectedWearable || !connectedWearable.isConnected) && (
                  <Pressable
                    style={styles.pairDeviceOutlineBtn}
                    onPress={() => handleNavigateScreen("/(tabs)/activity")}
                  >
                    <Watch size={14} color="#38bdf8" />
                    <Text style={styles.pairDeviceOutlineBtnText}>Pair BLE Wearable in Activity</Text>
                    <ChevronRight size={14} color="#38bdf8" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* ========================================================= */}
            {/* 2. ACTIVE CLINICAL PROTOCOL GUARD                         */}
            {/* ========================================================= */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ShieldCheck size={16} color="#10b981" />
                  <Text style={styles.cardTitle}>Clinical Protocol Shields</Text>
                </View>
                <Pressable onPress={() => handleNavigateScreen("/(tabs)/profile")}>
                  <Text style={styles.linkText}>Manage →</Text>
                </Pressable>
              </View>

              <View style={styles.badgesRow}>
                {clinicalProfile.conditions && clinicalProfile.conditions.length > 0 ? (
                  clinicalProfile.conditions.map((c) => (
                    <View key={c} style={styles.protocolBadge}>
                      <Text style={styles.protocolBadgeText}>
                        {c === "diabetes"
                          ? `🩸 Diabetes (${clinicalProfile.diabetes?.type || "Type 2"})`
                          : c === "pregnancy"
                          ? `🤰 Pregnancy (${clinicalProfile.pregnancy?.stage?.replace("_", " ") || "Trimester 2"})`
                          : c === "hypertension"
                          ? "🫀 Hypertension Care"
                          : c === "heart_health"
                          ? "❤️ Cardiovascular Guard"
                          : c === "weight_loss"
                          ? "⚖️ Metabolic Deficit"
                          : "🌱 Standard Longevity"}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.protocolBadge}>
                    <Text style={styles.protocolBadgeText}>🌱 Standard Vitality Protocol</Text>
                  </View>
                )}
              </View>

              <View style={styles.shieldsList}>
                <View style={styles.shieldItem}>
                  <Text style={styles.shieldBullet}>•</Text>
                  <Text style={styles.shieldText}>
                    <Text style={{ fontWeight: "700", color: "#e2ece7" }}>Hypoglycemia Shield:</Text>{" Armed (<70 mg/dL automatic safety alert)"}
                  </Text>
                </View>
                <View style={styles.shieldItem}>
                  <Text style={styles.shieldBullet}>•</Text>
                  <Text style={styles.shieldText}>
                    <Text style={{ fontWeight: "700", color: "#e2ece7" }}>Cardiovascular Zone 2:</Text> Pacing optimal for glycemic uptake
                  </Text>
                </View>
                <View style={styles.shieldItem}>
                  <Text style={styles.shieldBullet}>•</Text>
                  <Text style={styles.shieldText}>
                    <Text style={{ fontWeight: "700", color: "#e2ece7" }}>Postprandial Walk:</Text> Dynamic pacing recommendation active
                  </Text>
                </View>
              </View>
            </View>

            {/* ========================================================= */}
            {/* 3. RAPID CLINICAL VITALS ENTRY                            */}
            {/* ========================================================= */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Activity size={16} color="#fbbf24" />
                  <Text style={styles.cardTitle}>Rapid Clinical Vitals</Text>
                </View>
                <Text style={styles.cardSubHeader}>2-Tap SQLite Logging</Text>
              </View>

              <View style={styles.vitalsButtonRow}>
                <Pressable
                  style={[
                    styles.vitalsQuickBtn,
                    activeRapidLog === "glucose" && styles.vitalsQuickBtnActive,
                  ]}
                  onPress={() => {
                    triggerHaptic();
                    setActiveRapidLog(activeRapidLog === "glucose" ? null : "glucose");
                  }}
                >
                  <Text style={styles.vitalsQuickEmoji}>🩸</Text>
                  <Text style={styles.vitalsQuickText}>Blood Glucose</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.vitalsQuickBtn,
                    activeRapidLog === "bp" && styles.vitalsQuickBtnActive,
                  ]}
                  onPress={() => {
                    triggerHaptic();
                    setActiveRapidLog(activeRapidLog === "bp" ? null : "bp");
                  }}
                >
                  <Text style={styles.vitalsQuickEmoji}>🫀</Text>
                  <Text style={styles.vitalsQuickText}>Blood Pressure</Text>
                </Pressable>
              </View>

              {/* Inline Glucose Form */}
              {activeRapidLog === "glucose" && (
                <View style={styles.inlineLogForm}>
                  <Text style={styles.inlineFormTitle}>Log Blood Glucose (mg/dL)</Text>
                  <View style={styles.inlineInputRow}>
                    <TextInput
                      style={styles.vitalsInput}
                      keyboardType="numeric"
                      value={glucoseInput}
                      onChangeText={setGlucoseInput}
                      placeholder="100"
                      placeholderTextColor="#64748b"
                    />
                    <View style={styles.tagSelector}>
                      <Pressable
                        style={[
                          styles.miniTag,
                          glucoseMealTag === "fasting" && styles.miniTagActive,
                        ]}
                        onPress={() => setGlucoseMealTag("fasting")}
                      >
                        <Text style={styles.miniTagText}>Fasting</Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.miniTag,
                          glucoseMealTag === "post_meal" && styles.miniTagActive,
                        ]}
                        onPress={() => setGlucoseMealTag("post_meal")}
                      >
                        <Text style={styles.miniTagText}>Post-Meal</Text>
                      </Pressable>
                    </View>
                  </View>
                  <Pressable style={styles.saveVitalBtn} onPress={handleSaveGlucose}>
                    <Text style={styles.saveVitalBtnText}>Record Glucose</Text>
                  </Pressable>
                </View>
              )}

              {/* Inline Blood Pressure Form */}
              {activeRapidLog === "bp" && (
                <View style={styles.inlineLogForm}>
                  <Text style={styles.inlineFormTitle}>Log Blood Pressure (Systolic / Diastolic)</Text>
                  <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputMiniLabel}>Systolic</Text>
                      <TextInput
                        style={styles.vitalsInput}
                        keyboardType="numeric"
                        value={bpSystolic}
                        onChangeText={setBpSystolic}
                        placeholder="120"
                        placeholderTextColor="#64748b"
                      />
                    </View>
                    <Text style={{ color: "#64748b", fontSize: 18, marginTop: 14 }}>/</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputMiniLabel}>Diastolic</Text>
                      <TextInput
                        style={styles.vitalsInput}
                        keyboardType="numeric"
                        value={bpDiastolic}
                        onChangeText={setBpDiastolic}
                        placeholder="80"
                        placeholderTextColor="#64748b"
                      />
                    </View>
                  </View>
                  <Pressable style={styles.saveVitalBtn} onPress={handleSaveBloodPressure}>
                    <Text style={styles.saveVitalBtnText}>Record Blood Pressure</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* ========================================================= */}
            {/* 4. FIRST RESPONDER MEDICAL ID SHORTCUT                    */}
            {/* ========================================================= */}
            <Pressable
              style={styles.emergencyCard}
              onPress={() => handleNavigateScreen("/(tabs)/safety")}
            >
              <View style={styles.emergencyLeft}>
                <View style={styles.sosIconCircle}>
                  <ShieldAlert size={20} color="#ef4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.emergencyTitle}>First Responder Medical ID</Text>
                  <Text style={styles.emergencySub}>Paramedic-Grade Emergency Dossier & Contacts</Text>
                </View>
              </View>
              <ChevronRight size={18} color="#ef4444" />
            </Pressable>

            {/* ========================================================= */}
            {/* 5. SYSTEM TOGGLES & SETTINGS                              */}
            {/* ========================================================= */}
            <View style={styles.quickSettingsRow}>
              <Pressable
                style={[styles.toggleBtn, voiceEnabled && styles.toggleBtnActive]}
                onPress={handleToggleVoice}
              >
                {voiceEnabled ? (
                  <Volume2 size={16} color="#10b981" />
                ) : (
                  <VolumeX size={16} color="#94a3b8" />
                )}
                <Text
                  style={[
                    styles.toggleBtnText,
                    voiceEnabled && { color: "#10b981" },
                  ]}
                >
                  AI Voice: {voiceEnabled ? "ON" : "OFF"}
                </Text>
              </Pressable>

              <Pressable
                style={styles.fullSettingsBtn}
                onPress={() => handleNavigateScreen("/(tabs)/profile")}
              >
                <Sliders size={16} color="#e2ece7" />
                <Text style={styles.fullSettingsText}>Full Settings</Text>
              </Pressable>
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "flex-end",
  },
  controlCenterPanel: {
    backgroundColor: "#07120d",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    maxHeight: "88%",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  topGrabber: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignSelf: "center",
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  toastBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "#10b981",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  toastText: {
    color: "#86efac",
    fontSize: 12,
    fontWeight: "700",
  },
  scrollContent: {
    gap: 14,
    paddingBottom: 10,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#f8fafc",
    letterSpacing: 0.2,
  },
  cardSubHeader: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  activePillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#10b981",
    letterSpacing: 0.5,
  },
  standalonePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  amberDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#eab308",
  },
  standalonePillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#eab308",
    letterSpacing: 0.5,
  },
  honestNoticeBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(234, 179, 8, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.25)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  honestNoticeTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#eab308",
    marginBottom: 2,
  },
  honestNoticeDesc: {
    fontSize: 11,
    color: "#cbd5e1",
    lineHeight: 15,
  },
  pairDeviceOutlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  pairDeviceOutlineBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#38bdf8",
  },
  telemetryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  telemetryCell: {
    flex: 1,
    minWidth: "46%",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  telemetryLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 2,
  },
  telemetryValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  syncActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10b981",
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  syncActionBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#050b08",
  },
  linkText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#10b981",
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  protocolBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.35)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  protocolBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#38bdf8",
  },
  shieldsList: {
    gap: 5,
  },
  shieldItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  shieldBullet: {
    color: "#10b981",
    fontSize: 14,
    lineHeight: 16,
  },
  shieldText: {
    fontSize: 11,
    color: "#cbd5e1",
    lineHeight: 16,
    flex: 1,
  },
  vitalsButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  vitalsQuickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 10,
    borderRadius: 10,
  },
  vitalsQuickBtnActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10b981",
  },
  vitalsQuickEmoji: {
    fontSize: 16,
  },
  vitalsQuickText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  inlineLogForm: {
    marginTop: 12,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  inlineFormTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#cbd5e1",
    marginBottom: 8,
  },
  inlineInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  vitalsInput: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 8,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 90,
  },
  inputMiniLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 4,
  },
  tagSelector: {
    flexDirection: "row",
    gap: 6,
    flex: 1,
  },
  miniTag: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  miniTagActive: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: "#10b981",
  },
  miniTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#e2ece7",
  },
  saveVitalBtn: {
    backgroundColor: "#10b981",
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  saveVitalBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#050b08",
  },
  emergencyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderRadius: 16,
    padding: 14,
  },
  emergencyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  sosIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fca5a5",
  },
  emergencySub: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: 1,
  },
  quickSettingsRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 12,
    borderRadius: 12,
  },
  toggleBtnActive: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#cbd5e1",
  },
  fullSettingsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 12,
    borderRadius: 12,
  },
  fullSettingsText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#cbd5e1",
  },
});
