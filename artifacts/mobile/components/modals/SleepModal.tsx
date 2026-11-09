import React, { useState, memo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { Moon, X, Minus, Plus, Check } from "lucide-react-native";
import THEME from "@/constants/theme";
import { SleepRecord, saveSleepSession } from "@/services/db";
import { storage } from "@/services/storage";

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

export interface SleepModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: (record: SleepRecord) => void;
  initialHours?: number;
  initialQuality?: string;
}

export const SleepModal = memo(function SleepModal({
  visible,
  onClose,
  onSaved,
  initialHours = 7.5,
  initialQuality = "Restorative",
}: SleepModalProps) {
  const [sleepHoursLogged, setSleepHoursLogged] = useState(initialHours);
  const [sleepQuality, setSleepQuality] = useState(initialQuality);

  const handleSaveSleepSession = async () => {
    triggerHaptic("success");
    const sleepRecord: SleepRecord = {
      id: `sleep-${Date.now()}`,
      durationHours: sleepHoursLogged,
      quality: sleepQuality,
      deepSleepHours: Math.round(sleepHoursLogged * 0.22 * 10) / 10,
      remSleepHours: Math.round(sleepHoursLogged * 0.25 * 10) / 10,
      loggedAt: new Date().toISOString(),
    };

    try {
      await saveSleepSession(sleepRecord);
      await storage.setItem(
        "lumen_sleep_session",
        JSON.stringify({
          hours: sleepHoursLogged,
          quality: sleepQuality,
          loggedAt: new Date().toISOString(),
        })
      );
    } catch (err) {
      console.warn("[SleepModal] Save error:", err);
    }

    if (onSaved) {
      onSaved(sleepRecord);
    }
    onClose();
    Alert.alert("Sleep Logged", `Recorded ${sleepHoursLogged}h of ${sleepQuality.toLowerCase()} sleep.`);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[styles.modalIconBox, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                <Moon size={18} color="#f59e0b" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Sleep & Recovery Session</Text>
                <Text style={styles.modalSub}>Log hours and nightly restoration</Text>
              </View>
            </View>
            <Pressable style={styles.modalCloseBtn} onPress={onClose}>
              <X size={16} color="#0b1612" />
            </Pressable>
          </View>

          {/* Quick Hours Selector */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Text style={styles.modalSectionLabel}>DURATION SLEPT</Text>
            {sleepHoursLogged > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Pressable
                  style={styles.sleepStepperBtn}
                  onPress={() => {
                    triggerHaptic();
                    setSleepHoursLogged((prev) => Math.max(1, Number((prev - 0.5).toFixed(1))));
                  }}
                >
                  <Minus size={12} color="#f59e0b" />
                </Pressable>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#f59e0b" }}>
                  {sleepHoursLogged} hrs selected
                </Text>
                <Pressable
                  style={styles.sleepStepperBtn}
                  onPress={() => {
                    triggerHaptic();
                    setSleepHoursLogged((prev) => Math.min(16, Number((prev + 0.5).toFixed(1))));
                  }}
                >
                  <Plus size={12} color="#f59e0b" />
                </Pressable>
              </View>
            )}
          </View>
          <View style={styles.hoursChipsRow}>
            {[4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 10.0].map((h) => {
              const isSelected = sleepHoursLogged === h;
              return (
                <Pressable
                  key={h}
                  style={[styles.hoursChip, isSelected && styles.hoursChipActive]}
                  onPress={() => {
                    triggerHaptic();
                    setSleepHoursLogged(h);
                  }}
                >
                  <Text style={[styles.hoursChipText, isSelected && styles.hoursChipTextActive]}>
                    {h}h
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Sleep Quality Selector */}
          <Text style={[styles.modalSectionLabel, { marginTop: 16 }]}>SLEEP QUALITY</Text>
          <View style={styles.qualityGrid}>
            {[
              { id: "Restorative", desc: "Woke up fully charged" },
              { id: "Deep", desc: "Long undisturbed rest" },
              { id: "Normal", desc: "Standard sleep cycle" },
              { id: "Restless", desc: "Woke up multiple times" },
            ].map((q) => {
              const isSelected = sleepQuality === q.id;
              return (
                <Pressable
                  key={q.id}
                  style={[styles.qualityCard, isSelected && styles.qualityCardActive]}
                  onPress={() => {
                    triggerHaptic();
                    setSleepQuality(q.id);
                  }}
                >
                  <Text style={[styles.qualityTitle, isSelected && styles.qualityTitleActive]}>
                    {q.id}
                  </Text>
                  <Text style={styles.qualityDesc}>{q.desc}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Stage breakdown telemetry */}
          <View style={styles.telemetryCard}>
            <View style={styles.telemetryRow}>
              <Text style={styles.telemetryLabel}>Estimated Deep Sleep</Text>
              <Text style={styles.telemetryVal}>
                {Math.round(sleepHoursLogged * 0.22 * 10) / 10}h (22%)
              </Text>
            </View>
            <View style={styles.telemetryRow}>
              <Text style={styles.telemetryLabel}>Estimated REM Sleep</Text>
              <Text style={styles.telemetryVal}>
                {Math.round(sleepHoursLogged * 0.25 * 10) / 10}h (25%)
              </Text>
            </View>
          </View>

          {/* Save Button */}
          <Pressable style={styles.modalPrimaryBtn} onPress={handleSaveSleepSession}>
            <Check size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.modalPrimaryBtnText}>Save Sleep Session</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  modalPanel: {
    backgroundColor: THEME.colors.cardBgSolid,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: THEME.colors.cardBorder,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 44 : 28,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  modalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: THEME.colors.cardTextPrimary,
  },
  modalSub: {
    fontSize: 11,
    color: THEME.colors.cardTextSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(11, 22, 18, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(11, 22, 18, 0.12)",
  },
  modalSectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: THEME.colors.cardTextSecondary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  hoursChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  hoursChip: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.7)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  hoursChipActive: {
    backgroundColor: THEME.colors.accentTeal,
    borderColor: THEME.colors.accentTeal,
  },
  hoursChipText: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  hoursChipTextActive: {
    color: "#ffffff",
  },
  sleepStepperBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  qualityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  qualityCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    borderRadius: 12,
    padding: 10,
  },
  qualityCardActive: {
    borderColor: "#b45309",
    backgroundColor: "rgba(180, 83, 9, 0.08)",
  },
  qualityTitle: {
    color: THEME.colors.cardTextPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  qualityTitleActive: {
    color: "#b45309",
  },
  qualityDesc: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 10.5,
    marginTop: 2,
  },
  telemetryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(200, 218, 210, 0.6)",
    gap: 6,
  },
  telemetryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  telemetryLabel: {
    color: THEME.colors.cardTextSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  telemetryVal: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "800",
  },
  modalPrimaryBtn: {
    flexDirection: "row",
    backgroundColor: THEME.colors.accentTeal,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  modalPrimaryBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});
